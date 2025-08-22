import { EulerEarnVaultLensAbi } from '@/constants/EulerEarnVaultLensAbi';
import {
  protocolSchema,
  Strategies,
  type AllocationDetails,
  type StrategyConstants,
  type VaultDetails,
} from '@/types/types';
import { checkDBUptime } from '@/utils/common/checkDBUptime';
import {
  checkAllocationDiff,
  checkAllocationTotals,
  checkStrategyAmountsDiff,
  checkVaultDetailsDiff,
} from '@/utils/common/checkSnapshotDiff';
import { executeRebalance } from '@/utils/common/executeRebalance';
import { parseContractAddress } from '@/utils/common/parser';
import { getEulerEarnInternalBalance } from '@/utils/euler/getEulerEarnInternalBalance';
import { getEulerVaultDetails } from '@/utils/euler/getEulerVaultDetails';
import { computeGreedyInitAlloc } from '@/utils/greedyStrategy/computeGreedyInitAlloc';
import { computeGreedyReturns } from '@/utils/greedyStrategy/computeGreedyReturns';
import { computeGreedySimAnnealing } from '@/utils/greedyStrategy/computeGreedySimAnnealing';
import { sendTelegramMessage } from '@/utils/notifications/telegram';
import { zeroAddress, type Address, type Hex, type PublicClient } from 'viem';

/**
 * @title Allocator
 * @notice Handles allocation of funds across multiple lending protocols and vaults
 */
class Allocator {
  private allocationDiffTolerance: number;
  private allocatorPrivateKey: Hex;
  private apyTolerance: number;
  private amountSnapshotTolerance: number;
  private assetContractAddress: Address;
  private assetDecimals: number;
  private cashPercentage: bigint;
  private chainId: number;
  private earnVaultAddress: Address;
  private evcAddress: Address;
  private evkVaultLensAddress: Address;
  private eulerEarnLensAddress: Address;
  private strategies: StrategyConstants[];
  private rpcClient: PublicClient;

  /**
   * @notice Creates a new Allocator instance
   */
  constructor({
    allocationDiffTolerance,
    allocatorPrivateKey,
    amountSnapshotTolerance,
    apyTolerance,
    assetContractAddress,
    assetDecimals,
    cashPercentage,
    chainId,
    earnVaultAddress,
    evcAddress,
    evkVaultLensAddress,
    eulerEarnLensAddress,
    strategies,
    rpcClient,
  }: {
    allocationDiffTolerance: number;
    allocatorPrivateKey: Hex;
    amountSnapshotTolerance: number;
    apyTolerance: number;
    assetContractAddress: Address;
    assetDecimals: number;
    cashPercentage: bigint;
    chainId: number;
    earnVaultAddress: Address;
    evcAddress: Address;
    evkVaultLensAddress: Address;
    eulerEarnLensAddress: Address;
    strategies: StrategyConstants[];
    rpcClient: PublicClient;
  }) {
    this.allocationDiffTolerance = allocationDiffTolerance;
    this.allocatorPrivateKey = allocatorPrivateKey;
    this.amountSnapshotTolerance = amountSnapshotTolerance;
    this.apyTolerance = apyTolerance;
    this.assetContractAddress = assetContractAddress;
    this.assetDecimals = assetDecimals;
    this.cashPercentage = cashPercentage;
    this.chainId = chainId;
    this.earnVaultAddress = earnVaultAddress;
    this.evcAddress = evcAddress;
    this.evkVaultLensAddress = evkVaultLensAddress;
    this.eulerEarnLensAddress = eulerEarnLensAddress;
    this.strategies = strategies;
    this.rpcClient = rpcClient;
  }

  /**
   * @notice Fetches details for all vaults configured in strategies
   * @return Record mapping vault addresses to their details (APY, cash, config, etc)
   */
  private async getVaultDetails() {
    return Promise.all(
      this.strategies.map(async strategy => {
        if (
          strategy.protocol === protocolSchema.Enum.euler &&
          strategy.vaultAddress !== zeroAddress
        ) {
          const vault = await getEulerVaultDetails({
            assetDecimals: this.assetDecimals,
            chainId: this.chainId,
            vaultAddress: parseContractAddress(strategy.vaultAddress),
            lensAddress: this.evkVaultLensAddress,
            rpcClient: this.rpcClient,
          });
          return [strategy.vaultAddress, vault] as const;
        } // Can add more protocols here
      }),
    ).then(results => Object.fromEntries(results.filter(entry => entry !== undefined)));
  }

  /**
   * @notice Gets the current amount of assets allocated to each strategy
   * @param vaultDetails Record of vault details indexed by vault address
   * @returns Record mapping strategy addresses to their allocated amounts
   */
  private async getStrategies(vaultDetails: Record<string, VaultDetails>) {
    const getCapsAndIdle = async () => {
      const lensData = await this.rpcClient.readContract({
        address: this.eulerEarnLensAddress,
        abi: EulerEarnVaultLensAbi,
        functionName: 'getVaultInfoFull',
        args: [this.earnVaultAddress],
      });

      return {
        caps: Object.fromEntries(
          lensData.strategies.map(strategy => {
            return [strategy.strategy, strategy.currentAllocationCap];
          }),
        ),
        idleVaultAddress: (lensData.supplyQueue.length > 0
          ? lensData.supplyQueue.at(-1)
          : zeroAddress) as Address,
      };
    };
    const getAllocations = async () => {
      return Promise.all(
        this.strategies.map(async strategy => {
          if (strategy.protocol === protocolSchema.Enum.euler) {
            const amount = await getEulerEarnInternalBalance({
              address: this.earnVaultAddress,
              vaultAddress: parseContractAddress(strategy.vaultAddress),
              cash: vaultDetails[strategy.vaultAddress].cash,
              totalBorrows: vaultDetails[strategy.vaultAddress].totalBorrows,
              totalShares: vaultDetails[strategy.vaultAddress].totalShares,
              chainId: this.chainId,
              rpcClient: this.rpcClient,
            });
            return [strategy.vaultAddress, amount] as const;
          } // Can add more protocols here
        }),
      ).then(results => Object.fromEntries(results.filter(entry => entry !== undefined)));
    };

    const [{ caps, idleVaultAddress }, allocations] = await Promise.all([
      getCapsAndIdle(),
      getAllocations(),
    ]);
    return {
      caps,
      allocations,
      idleVaultAddress,
    };
  }

  /**
   * @notice Calculates the total amount available for allocation and required cash reserve
   * @dev Cash percentage is in 18 decimal fixed point format
   * @param strategyAmounts Record mapping strategy addresses to their current allocated amounts
   * @returns Tuple containing [allocatable amount, cash reserve amount]
   */
  private getAllocatableAmount(strategyAmounts: Record<string, bigint>) {
    const totalAllocatableAmount = Object.values(strategyAmounts).reduce(
      (total, amount) => total + amount,
      BigInt(0),
    );

    const cash = (totalAllocatableAmount * this.cashPercentage) / BigInt(10) ** BigInt(18);
    const allocatable = totalAllocatableAmount - cash;

    return [allocatable, cash] as const;
  }

  /**
   * @notice Checks if reallocation should occur
   * @param finalAllocation Record of final allocation details with old/new amounts and diffs
   * @returns True if reallocation shouldn't occur, false otherwise (boolean)
   */
  private async verifyAllocation(
    strategies: Strategies,
    finalAllocation: Record<string, AllocationDetails>,
  ) {
    /** Check if all assets are allocated */
    if (checkAllocationTotals(strategies, finalAllocation)) {
      throw new Error('Total assets / total allocated mismatch');
    }

    /** Check if allocation changes are significant */
    if (
      checkAllocationDiff({
        assetDecimals: this.assetDecimals,
        allocation: finalAllocation,
        tolerance: this.allocationDiffTolerance,
      })
    )
      return true;

    return false;
  }

  /**
   * @notice Computes optimal allocation across configured strategies
   */
  public async computeAllocation() {
    /** Get vault details, i.e., APY, cash, config, etc */
    const vaultDetails = await this.getVaultDetails();

    /** Get strategy allocations and caps */
    const strategies = await this.getStrategies(vaultDetails);

    const idleAmount = 30000000000000n;
    strategies.allocations['0xB93d4928f39fBcd6C89a7DFbF0A867E6344561bE'] = idleAmount;
    vaultDetails['0xB93d4928f39fBcd6C89a7DFbF0A867E6344561bE'].cash = idleAmount;

    console.log('strategyAmounts: ', strategies.allocations);

    /** Get allocatable amount and cash amount based on target cash reserve percentage */
    const [allocatableAmount, cashAmount] = this.getAllocatableAmount(strategies.allocations);
    console.log('allocatableAmount: ', allocatableAmount);
    console.log('cashAmount: ', cashAmount);
    if (allocatableAmount + cashAmount === BigInt(0)) return;

    /** Compute initial allocation */
    const initialAllocation = computeGreedyInitAlloc({
      vaultDetails,
      strategies,
      allocatableAmount,
      cashAmount,
      idleVaultAddress: strategies.idleVaultAddress,
    }); // Can change initial allocation strategies
    console.log('initialAllocation: ', initialAllocation);

    /** Compute initial returns */
    const initialReturns = computeGreedyReturns({
      assetDecimals: this.assetDecimals,
      vaultDetails,
      allocation: initialAllocation,
      log: true,
    }); // Can change returns computation
    console.log('initialReturns: ', initialReturns);

    /** Compute final allocation and returns using simulated annealing */
    const [finalAllocation] = computeGreedySimAnnealing({
      assetDecimals: this.assetDecimals,
      vaultDetails,
      strategies,
      initialAllocation,
      initialReturns,
    }); // Can change optimization algo/params/etc
    console.log('finalAllocation: ', finalAllocation);

    const finalReturns = computeGreedyReturns({
      assetDecimals: this.assetDecimals,
      vaultDetails,
      allocation: finalAllocation,
      log: true,
    }); // Can change returns computation
    console.log('finalReturns: ', finalReturns);

    /** Check if reallocation shouldn't occur */
    const shouldStop = await this.verifyAllocation(strategies, finalAllocation);
    console.log('shouldStop: ', shouldStop);
    if (shouldStop) return;

    /** Execute rebalance */
    const txHash = await executeRebalance({
      allocation: finalAllocation,
      allocatorPrivateKey: this.allocatorPrivateKey,
      assetDecimals: this.assetDecimals,
      earnVaultAddress: this.earnVaultAddress,
      evcAddress: this.evcAddress,
      rpcClient: this.rpcClient,
      idleVaultAddress: strategies.idleVaultAddress,
    });

    // /** Send notification */
    // await sendTelegramMessage({
    //   message: `Portfolio Rebalance\n https://basescan.org/tx/${txHash}`,
    //   type: 'info',
    // });
  }
}

export default Allocator;
