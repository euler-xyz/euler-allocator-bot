import { EulerEarnVaultLensAbi } from '@/constants/EulerEarnVaultLensAbi';
import {
  Allocation,
  EulerEarn,
  OptimizationMode,
  protocolSchema,
  ReturnsDetails,
  type StrategyConstants,
} from '@/types/types';
import {
  checkAllocationTotals,
  checkStrategyAmountsDiff,
  checkVaultDetailsDiff,
} from '@/utils/common/checkSnapshotDiff';
import { executeRebalance } from '@/utils/common/executeRebalance';
import { getCurrentAllocation } from '@/utils/common/getCurrentAllocation';
import { getRunLog, logger } from '@/utils/common/log';
import { parseContractAddress } from '@/utils/common/parser';
import { getVaultLabel } from '@/utils/common/vaultLabels';
import { getEulerEarnInternalBalance } from '@/utils/euler/getEulerEarnInternalBalance';
import { getEulerVaultDetails } from '@/utils/euler/getEulerVaultDetails';
import { computeGreedyInitAlloc } from '@/utils/greedyStrategy/computeGreedyInitAlloc';
import { computeGreedyReturns } from '@/utils/greedyStrategy/computeGreedyReturns';
import {
  computeGreedySimAnnealing,
  isFullyOverUtilized,
  isOutsideSoftCap,
  isOverUtilized,
} from '@/utils/greedyStrategy/computeGreedySimAnnealing';
import {
  calculateApySpread,
  computeUnifiedApyAllocation,
} from '@/utils/greedyStrategy/computeUnifiedApyAllocation';
import { notifyRun } from '@/utils/notifications/sendNotifications';
import { type Address, type Hex, type PublicClient } from 'viem';

const APY_SPREAD_EPSILON = 1e-6;

type AllocationContext = {
  vault: EulerEarn;
  currentAllocation: Allocation;
  currentReturns: number;
  currentReturnsDetails: ReturnsDetails;
  allocatableAmount: bigint;
  cashAmount: bigint;
  requiresSpreadCheck: boolean;
  currentSpread?: number;
  mode: OptimizationMode;
};

type OptimizationOutcome = {
  finalAllocation: Allocation;
  finalReturns: number;
  finalReturnsDetails: ReturnsDetails;
  finalSpread?: number;
};

/**
 * @title Allocator
 * @notice Handles allocation of funds across multiple lending protocols and vaults
 */
class Allocator {
  private allocationDiffTolerance: number;
  private allocatorPrivateKey: Hex;
  private cashPercentage: bigint;
  private chainId: number;
  private earnVaultAddress: Address;
  private evcAddress: Address;
  private evkVaultLensAddress: Address;
  private eulerEarnLensAddress: Address;
  private strategiesOverride?: StrategyConstants[];
  private rpcClient: PublicClient;
  private broadcast: boolean;
  private optimizationMode: OptimizationMode;
  private apySpreadTolerance: number;
  private noIdleVault: boolean;

  /**
   * @notice Creates a new Allocator instance
   */
  constructor({
    allocationDiffTolerance,
    allocatorPrivateKey,
    cashPercentage,
    chainId,
    earnVaultAddress,
    evcAddress,
    evkVaultLensAddress,
    eulerEarnLensAddress,
    strategiesOverride,
    rpcClient,
    broadcast,
    optimizationMode,
    apySpreadTolerance,
    noIdleVault,
  }: {
    allocationDiffTolerance: number;
    allocatorPrivateKey: Hex;
    cashPercentage: bigint;
    chainId: number;
    earnVaultAddress: Address;
    evcAddress: Address;
    evkVaultLensAddress: Address;
    eulerEarnLensAddress: Address;
    strategiesOverride?: StrategyConstants[];
    rpcClient: PublicClient;
    broadcast: boolean;
    optimizationMode: OptimizationMode;
    apySpreadTolerance: number;
    noIdleVault: boolean;
  }) {
    this.allocationDiffTolerance = allocationDiffTolerance;
    this.allocatorPrivateKey = allocatorPrivateKey;
    this.cashPercentage = cashPercentage;
    this.chainId = chainId;
    this.earnVaultAddress = earnVaultAddress;
    this.evcAddress = evcAddress;
    this.evkVaultLensAddress = evkVaultLensAddress;
    this.eulerEarnLensAddress = eulerEarnLensAddress;
    this.strategiesOverride = strategiesOverride;
    this.rpcClient = rpcClient;
    this.broadcast = broadcast;
    this.optimizationMode = optimizationMode;
    this.apySpreadTolerance = apySpreadTolerance;
    this.noIdleVault = noIdleVault;
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
        const strategyAddress = parseContractAddress(strategy.strategy);
        if (strategy.info.isEVault) {
          const details = await getEulerVaultDetails({
            assetDecimals: Number(lensData.assetDecimals),
            chainId: this.chainId,
            vaultAddress: strategyAddress,
            vaultSymbol: strategy.info.vaultSymbol,
            lensAddress: this.evkVaultLensAddress,
            rpcClient: this.rpcClient,
          });

          const allocation = await getEulerEarnInternalBalance({
            address: this.earnVaultAddress,
            vaultAddress: strategyAddress,
            cash: details.cash,
            totalBorrows: details.totalBorrows,
            totalShares: details.totalShares,
            chainId: this.chainId,
            rpcClient: this.rpcClient,
          });
          const label = await getVaultLabel(strategyAddress, this.chainId);
          return [
            strategy.strategy,
            { allocation, details, metadata: { label: label?.name } },
          ] as const;
        } else {
          // Can add more protocols here
          throw new Error(`Unknown protocol ${strategy.strategy}`);
        }
      }),
    ).then(results => Object.fromEntries(results.filter(entry => entry !== undefined)));

    const earnVaultLabel = await getVaultLabel(this.earnVaultAddress, this.chainId);

    const discoveredIdleVault =
      lensData.supplyQueue.length > 0 ? (lensData.supplyQueue.at(-1) as Address) : undefined;
    const idleVaultAddress = this.noIdleVault ? undefined : discoveredIdleVault;

    const config: EulerEarn = {
      strategies: Object.fromEntries(
        lensData.strategies.map(strategy => {
          return [
            strategy.strategy,
            {
              cap: strategy.currentAllocationCap,
              protocol: protocolSchema.Enum.euler, // TODO handle
              ...strategiesDetails[strategy.strategy],
              metadata: {
                name: strategy.info.vaultName,
                label: strategiesDetails[strategy.strategy]?.metadata?.label,
              },
            },
          ];
        }),
      ),
      initialAllocationQueue: [...lensData.strategies].reverse().map(s => s.strategy),
      assetDecimals: Number(lensData.assetDecimals),
      metadata: {
        name: lensData.vaultName,
        label: earnVaultLabel?.name,
      },
    };
    if (idleVaultAddress) {
      config.idleVaultAddress = idleVaultAddress;
    }

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
   * @returns True if reallocation shouldn't occur, false otherwise (boolean)
   */
  private async verifyAllocation(
    vault: EulerEarn,
    currentAllocation: Allocation,
    finalAllocation: Allocation,
    currentReturns: number,
    currentReturnsDetails: ReturnsDetails,
    newReturns: number,
    newReturnsDetails: ReturnsDetails,
    spreads?: { current?: number; final?: number },
  ) {
    /** Check if all assets are allocated */
    if (checkAllocationTotals(vault, finalAllocation)) {
      throw new Error('Total assets / total allocated mismatch');
    }

    if (
      isOverUtilized(currentReturnsDetails) &&
      !isFullyOverUtilized(currentReturnsDetails) &&
      isOverUtilized(newReturnsDetails)
    ) {
      throw new Error('Over-utilization unresolved');
    }

    if (isOverUtilized(currentReturnsDetails)) return !isOverUtilized(newReturnsDetails);
    if (isOutsideSoftCap(currentAllocation)) return !isOutsideSoftCap(finalAllocation);

    const meetsReturnTolerance = newReturns - currentReturns >= this.allocationDiffTolerance;
    const requiresSpreadCheck = this.optimizationMode !== 'annealing';
    const meetsSpreadTolerance = (() => {
      if (!requiresSpreadCheck) return true;
      const finalSpread = spreads?.final;
      if (finalSpread === undefined) return false;
      if (this.apySpreadTolerance > 0) {
        return finalSpread <= this.apySpreadTolerance;
      }
      const currentSpread = spreads?.current;
      if (currentSpread === undefined) return true;
      return finalSpread + APY_SPREAD_EPSILON < currentSpread;
    })();

    switch (this.optimizationMode) {
      case 'annealing':
        return meetsReturnTolerance;
      case 'equalization':
        return meetsSpreadTolerance;
      case 'combined':
        return meetsReturnTolerance && meetsSpreadTolerance;
      default:
        return meetsReturnTolerance;
    }
  }

  /**
   * @notice Computes optimal allocation across configured strategies
   */
  public async computeAllocation() {
    const context = await this.buildAllocationContext();

    if (context.allocatableAmount + context.cashAmount === BigInt(0)) {
      logger.info({ message: 'nothing to allocate' });
      return;
    }

    const outcome = this.runOptimization(context);

    await this.finalizeAllocationRun(context, outcome);
  }

  private async buildAllocationContext(): Promise<AllocationContext> {
    const vault = await this.getEulerEarn();
    const currentAllocation = getCurrentAllocation(vault);
    const { totalReturns: currentReturns, details: currentReturnsDetails } = computeGreedyReturns({
      vault,
      allocation: currentAllocation,
    });
    const [allocatableAmount, cashAmount] = this.getAllocatableAmount(vault);
    const requiresSpreadCheck = this.optimizationMode !== 'annealing';
    const currentSpread = requiresSpreadCheck
      ? calculateApySpread({
          vault,
          allocation: currentAllocation,
          returnsDetails: currentReturnsDetails,
        })
      : undefined;

    return {
      vault,
      currentAllocation,
      currentReturns,
      currentReturnsDetails,
      allocatableAmount,
      cashAmount,
      requiresSpreadCheck,
      currentSpread,
      mode: this.optimizationMode,
    };
  }

  private runOptimization(context: AllocationContext): OptimizationOutcome {
    const { vault, currentAllocation } = context;

    switch (this.optimizationMode) {
      case 'annealing': {
        const [annealedAllocation] = computeGreedySimAnnealing({
          vault,
          initialAllocation: currentAllocation,
        });
        const annealedReturns = computeGreedyReturns({
          vault,
          allocation: annealedAllocation,
        });
        return {
          finalAllocation: annealedAllocation,
          finalReturns: annealedReturns.totalReturns,
          finalReturnsDetails: annealedReturns.details,
        };
      }
      case 'equalization': {
        const equalization = computeUnifiedApyAllocation({
          vault,
          initialAllocation: currentAllocation,
        });
        return {
          finalAllocation: equalization.allocation,
          finalReturns: equalization.totalReturns,
          finalReturnsDetails: equalization.details,
          finalSpread: equalization.spread,
        };
      }
      case 'combined':
      default: {
        const [annealedAllocation] = computeGreedySimAnnealing({
          vault,
          initialAllocation: currentAllocation,
        });
        const equalization = computeUnifiedApyAllocation({
          vault,
          initialAllocation: annealedAllocation,
        });
        return {
          finalAllocation: equalization.allocation,
          finalReturns: equalization.totalReturns,
          finalReturnsDetails: equalization.details,
          finalSpread: equalization.spread,
        };
      }
    }
  }

  private async finalizeAllocationRun(
    context: AllocationContext,
    outcome: OptimizationOutcome,
  ): Promise<void> {
    const finalSpread = context.requiresSpreadCheck
      ? (outcome.finalSpread ??
        calculateApySpread({
          vault: context.vault,
          allocation: outcome.finalAllocation,
          returnsDetails: outcome.finalReturnsDetails,
        }))
      : undefined;

    const spreadSummary = context.requiresSpreadCheck
      ? {
          current: context.currentSpread,
          final: finalSpread,
          tolerance: this.apySpreadTolerance || undefined,
        }
      : undefined;

    const allocationVerified = await this.verifyAllocation(
      context.vault,
      context.currentAllocation,
      outcome.finalAllocation,
      context.currentReturns,
      context.currentReturnsDetails,
      outcome.finalReturns,
      outcome.finalReturnsDetails,
      spreadSummary ? { current: spreadSummary.current, final: spreadSummary.final } : undefined,
    );

    const strategyMetadata = Object.fromEntries(
      await Promise.all(
        Object.entries(context.vault.strategies).map(async ([address, strategy]) => {
          let labelName = strategy.metadata?.label;
          if (!labelName) {
            const label = await getVaultLabel(address as Address, this.chainId);
            labelName = label?.name;
          }
          return [
            address,
            {
              symbol: strategy.details.symbol,
              label: labelName,
              name: strategy.metadata?.name,
            },
          ] as const;
        }),
      ),
    );

    const runLog = getRunLog(
      context.currentAllocation,
      context.currentReturns,
      context.currentReturnsDetails,
      outcome.finalAllocation,
      outcome.finalReturns,
      outcome.finalReturnsDetails,
      context.allocatableAmount,
      context.cashAmount,
      context.mode,
      spreadSummary,
      {
        assetDecimals: context.vault.assetDecimals,
        strategies: strategyMetadata,
        earnVault: {
          name: context.vault.metadata?.name,
          label: context.vault.metadata?.label,
        },
      },
    );

    if (!allocationVerified) {
      runLog.result = 'abort';
    } else {
      try {
        runLog.result = await executeRebalance({
          allocation: outcome.finalAllocation,
          allocatorPrivateKey: this.allocatorPrivateKey,
          earnVaultAddress: this.earnVaultAddress,
          evcAddress: this.evcAddress,
          rpcClient: this.rpcClient,
          broadcast: this.broadcast,
        });
      } catch (error) {
        runLog.result = 'error';
        runLog.error = error;
      }
    }

    logger.info(runLog);
    await notifyRun(runLog);
  }
}

export default Allocator;
