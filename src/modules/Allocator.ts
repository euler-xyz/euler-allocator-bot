import { EulerEarnVaultLensAbi } from '@/constants/EulerEarnVaultLensAbi';
import { Allocation, EulerEarn, protocolSchema, type StrategyConstants } from '@/types/types';
import {
  checkAllocationDiff,
  checkAllocationTotals,
  checkStrategyAmountsDiff,
  checkVaultDetailsDiff,
} from '@/utils/common/checkSnapshotDiff';
import { executeRebalance } from '@/utils/common/executeRebalance';
import { getCurrentAllocation } from '@/utils/common/getCurrentAllocation';
import { getRunLog, logger } from '@/utils/common/log';
import { parseContractAddress } from '@/utils/common/parser';
import { getEulerEarnInternalBalance } from '@/utils/euler/getEulerEarnInternalBalance';
import { getEulerVaultDetails } from '@/utils/euler/getEulerVaultDetails';
import { computeGreedyInitAlloc } from '@/utils/greedyStrategy/computeGreedyInitAlloc';
import { computeGreedyReturns } from '@/utils/greedyStrategy/computeGreedyReturns';
import { computeGreedySimAnnealing } from '@/utils/greedyStrategy/computeGreedySimAnnealing';
import { notifyRun } from '@/utils/notifications/sendNotifications';
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
  private cashPercentage: bigint;
  private chainId: number;
  private earnVaultAddress: Address;
  private evcAddress: Address;
  private evkVaultLensAddress: Address;
  private eulerEarnLensAddress: Address;
  private strategiesOverride?: StrategyConstants[];
  private rpcClient: PublicClient;
  private broadcast: boolean;

  /**
   * @notice Creates a new Allocator instance
   */
  constructor({
    allocationDiffTolerance,
    allocatorPrivateKey,
    amountSnapshotTolerance,
    apyTolerance,
    cashPercentage,
    chainId,
    earnVaultAddress,
    evcAddress,
    evkVaultLensAddress,
    eulerEarnLensAddress,
    strategiesOverride,
    rpcClient,
    broadcast,
  }: {
    allocationDiffTolerance: number;
    allocatorPrivateKey: Hex;
    amountSnapshotTolerance: number;
    apyTolerance: number;
    cashPercentage: bigint;
    chainId: number;
    earnVaultAddress: Address;
    evcAddress: Address;
    evkVaultLensAddress: Address;
    eulerEarnLensAddress: Address;
    strategiesOverride?: StrategyConstants[];
    rpcClient: PublicClient;
    broadcast: boolean;
  }) {
    this.allocationDiffTolerance = allocationDiffTolerance;
    this.allocatorPrivateKey = allocatorPrivateKey;
    this.amountSnapshotTolerance = amountSnapshotTolerance;
    this.apyTolerance = apyTolerance;
    this.cashPercentage = cashPercentage;
    this.chainId = chainId;
    this.earnVaultAddress = earnVaultAddress;
    this.evcAddress = evcAddress;
    this.evkVaultLensAddress = evkVaultLensAddress;
    this.eulerEarnLensAddress = eulerEarnLensAddress;
    this.strategiesOverride = strategiesOverride;
    this.rpcClient = rpcClient;
    this.broadcast = broadcast;
  }

  /**
   * @notice Gets the current amount of assets allocated to each strategy
   * @param vaultDetails Record of vault details indexed by vault address
   * @returns Record mapping strategy addresses to their allocated amounts
   */
  private async getEulerEarn() {
    const lensData = await this.rpcClient.readContract({
      address: this.eulerEarnLensAddress,
      abi: EulerEarnVaultLensAbi,
      functionName: 'getVaultInfoFull',
      args: [this.earnVaultAddress],
    });

    const strategiesDetails = await Promise.all(
      lensData.strategies.map(async strategy => {
        if (strategy.info.isEVault) {
          const details = await getEulerVaultDetails({
            assetDecimals: Number(lensData.assetDecimals),
            chainId: this.chainId,
            vaultAddress: parseContractAddress(strategy.strategy),
            vaultSymbol: strategy.info.vaultSymbol,
            lensAddress: this.evkVaultLensAddress,
            rpcClient: this.rpcClient,
          });

          const allocation = await getEulerEarnInternalBalance({
            address: this.earnVaultAddress,
            vaultAddress: parseContractAddress(strategy.strategy),
            cash: details.cash,
            totalBorrows: details.totalBorrows,
            totalShares: details.totalShares,
            chainId: this.chainId,
            rpcClient: this.rpcClient,
          });
          return [strategy.strategy, { allocation, details }] as const;
        } else {
          // Can add more protocols here
          throw new Error(`Unknown protocol ${strategy.strategy}`);
        }
      }),
    ).then(results => Object.fromEntries(results.filter(entry => entry !== undefined)));

    const config: EulerEarn = {
      strategies: Object.fromEntries(
        lensData.strategies.map(strategy => {
          return [
            strategy.strategy,
            {
              cap: strategy.currentAllocationCap,
              protocol: protocolSchema.Enum.euler, // TODO handle
              ...strategiesDetails[strategy.strategy],
            },
          ];
        }),
      ),
      idleVaultAddress: (lensData.supplyQueue.length > 0
        ? lensData.supplyQueue.at(-1)
        : zeroAddress) as Address,
      initialAllocationQueue: [...lensData.strategies].reverse().map(s => s.strategy),
      assetDecimals: Number(lensData.assetDecimals),
    };

    if (this.strategiesOverride) {
      this.strategiesOverride.forEach(s => {
        if (!config.strategies[s.vaultAddress])
          throw new Error(`Invalid strategies override entry ${s.vaultAddress}`);
      });

      config.initialAllocationQueue = this.strategiesOverride.map(s => s.vaultAddress);
    }

    return config;
  }

  /**
   * @notice Calculates the total amount available for allocation and required cash reserve
   * @dev Cash percentage is in 18 decimal fixed point format
   * @returns Tuple containing [allocatable amount, cash reserve amount]
   */
  private getAllocatableAmount(vault: EulerEarn) {
    const totalAllocatableAmount = Object.values(vault.strategies).reduce(
      (total, { allocation }) => total + allocation,
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
  private async verifyAllocation(vault: EulerEarn, finalAllocation: Allocation) {
    /** Check if all assets are allocated */
    if (checkAllocationTotals(vault, finalAllocation)) {
      throw new Error('Total assets / total allocated mismatch');
    }

    /** Check if allocation changes are significant */
    if (
      checkAllocationDiff({
        assetDecimals: vault.assetDecimals,
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
    /** Get EulerEarn configuration and current allocations */
    const vault = await this.getEulerEarn();

    const currentAllocation = getCurrentAllocation(vault);

    const { totalReturns: currentReturns, details: currentReturnsDetails } = computeGreedyReturns({
      vault,
      allocation: currentAllocation,
    }); // Can change returns computation

    /** Get allocatable amount and cash amount based on target cash reserve percentage */
    const [allocatableAmount, cashAmount] = this.getAllocatableAmount(vault);

    if (allocatableAmount + cashAmount === BigInt(0)) return;

    /** Compute initial allocation */
    const initialAllocation = computeGreedyInitAlloc({
      vault,
      allocatableAmount,
      cashAmount,
    }); // Can change initial allocation strategies

    /** Compute initial returns */
    const { totalReturns: initialReturns } = computeGreedyReturns({
      vault,
      allocation: initialAllocation,
    }); // Can change returns computation

    /** Compute final allocation and returns using simulated annealing */
    const [finalAllocation] = computeGreedySimAnnealing({
      vault,
      initialAllocation,
      initialReturns,
    }); // Can change optimization algo/params/etc

    const { totalReturns: finalReturns, details: finalReturnsDetails } = computeGreedyReturns({
      vault,
      allocation: finalAllocation,
    }); // Can change returns computation

    /** Check if reallocation shouldn't occur */
    const shouldStop = await this.verifyAllocation(vault, finalAllocation);

    const runLog = getRunLog(
      currentAllocation,
      currentReturns,
      currentReturnsDetails,
      finalAllocation,
      finalReturns,
      finalReturnsDetails,
      allocatableAmount,
      cashAmount,
    );

    if (shouldStop) {
      runLog.result = "abort"
      return;
    }

    /** Execute rebalance */
    try {
      runLog.result = await executeRebalance({
        allocation: finalAllocation,
        allocatorPrivateKey: this.allocatorPrivateKey,
        earnVaultAddress: this.earnVaultAddress,
        evcAddress: this.evcAddress,
        rpcClient: this.rpcClient,
        broadcast: this.broadcast,
      });
    } catch (error) {
      runLog.result = "error";
      runLog.error = error;
    }
    logger.info(runLog)
    await notifyRun(runLog)
  }
}

export default Allocator;
