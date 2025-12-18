import ANNEALING_CONSTANTS from '@/constants/annealingConstants';
import ENV from '@/constants/constants';
import { Allocation, EulerEarn, ReturnsDetails, type AllocationDetails } from '@/types/types';
import { parseNumberToBigIntWithScale } from '@/utils/common/parser';
import { computeGreedyReturns } from '@/utils/greedyStrategy/computeGreedyReturns';
import { Address, getAddress, isAddressEqual, maxUint256 } from 'viem';

/**
 * @notice Computes amount to transfer between vaults during annealing
 * @returns Amount to transfer between vaults, given constraints and temperature
 */
function computeTransferAmount(
  vault: EulerEarn,
  srcVault: Address,
  destVault: Address,
  srcVaultAllocation: AllocationDetails,
  destVaultAllocation: AllocationDetails,
  temperature: number,
) {
  const srcCurrentAmount = srcVaultAllocation.newAmount;
  const srcDetails = vault.strategies[srcVault].details;
  const destDetails = vault.strategies[destVault].details;
  const srvVaultMaxWithdraw = srcDetails.cash + srcVaultAllocation.diff;
  const destSupplyCap =
    destDetails.supplyCap - destDetails.totalBorrows - destDetails.cash - destVaultAllocation.diff;
  const destStrategyCap = vault.strategies[destVault].cap - destVaultAllocation.newAmount;

  // if any of the caps is negative, no transfer is possible
  if (destSupplyCap < 0n || destStrategyCap < 0n || srvVaultMaxWithdraw < 0n) return 0n;

  let softCap = maxUint256;
  if (ENV.SOFT_CAPS[destVault]) {
    softCap =
      destVaultAllocation.newAmount < ENV.SOFT_CAPS[destVault].max
        ? ENV.SOFT_CAPS[destVault].max - destVaultAllocation.newAmount
        : 0n;
  }

  const maxTransfer = [
    srcCurrentAmount,
    srvVaultMaxWithdraw,
    destSupplyCap,
    destStrategyCap,
    softCap,
  ].reduce((min, curr) => (curr < min ? curr : min));
  const maxTransferTempAdj =
    (maxTransfer * parseNumberToBigIntWithScale(temperature, 18)) / BigInt(10) ** BigInt(18);

  let amount =
    (maxTransferTempAdj * parseNumberToBigIntWithScale(Math.random(), 18)) /
    BigInt(10) ** BigInt(18);

  // correct for rounding
  if (amount < maxTransferTempAdj && Math.random() > 0.5) amount += 1n;

  return amount;
}

/**
 * @notice Generates a neighboring solution by transferring funds between two random vaults
 * @returns New allocation state after transfer
 */
export function generateNeighbor(
  vault: EulerEarn,
  currentAllocation: Allocation,
  temperature: number,
) {
  const newAllocation = structuredClone(currentAllocation);
  const vaultList = vault.initialAllocationQueue.filter(v => v !== vault.idleVaultAddress);

  const sourceIdx = Math.floor(Math.random() * vault.initialAllocationQueue.length);
  const destIdx =
    (sourceIdx + 1 + Math.floor(Math.random() * (vault.initialAllocationQueue.length - 1))) %
    vaultList.length;
  const srcVaultAddress = vault.initialAllocationQueue[sourceIdx];
  const destVaultAddress = vaultList[destIdx];

  const transferAmount = computeTransferAmount(
    vault,
    srcVaultAddress,
    destVaultAddress,
    newAllocation[srcVaultAddress],
    newAllocation[destVaultAddress],
    temperature,
  );

  if (transferAmount === BigInt(0)) return newAllocation;

  newAllocation[srcVaultAddress].newAmount -= transferAmount;
  newAllocation[srcVaultAddress].diff -= transferAmount;
  newAllocation[destVaultAddress].newAmount += transferAmount;
  newAllocation[destVaultAddress].diff += transferAmount;
  return newAllocation;
}

/**
 * @notice Main simulated annealing optimization function
 * @returns Tuple of [best allocation found, best returns achieved]
 */
export function computeGreedySimAnnealing({
  vault,
  initialAllocation,
}: {
  vault: EulerEarn;
  initialAllocation: Allocation;
}) {
  let currentAllocation = structuredClone(initialAllocation);
  let bestAllocation = structuredClone(initialAllocation);

  const { totalReturns: initialReturns, details: initialReturnsDetails } = computeGreedyReturns({
    vault,
    allocation: initialAllocation,
  });

  let currentReturns = initialReturns;
  let currentReturnsDetails = initialReturnsDetails;
  let bestReturns = initialReturns;
  let bestReturnsDetails = initialReturnsDetails;

  let currentTemp = ANNEALING_CONSTANTS.INITIAL_TEMP;
  let consecutiveFailures = 0;
  while (
    currentTemp > ANNEALING_CONSTANTS.MIN_TEMP &&
    consecutiveFailures < ANNEALING_CONSTANTS.MAX_CONSECUTIVE_FAILURES
  ) {
    let acceptedMoves = 0;
    for (let i = 0; i < ANNEALING_CONSTANTS.ITERATIONS_PER_TEMP; i++) {
      const newAllocation = generateNeighbor(vault, currentAllocation, currentTemp);
      const { totalReturns: newReturns, details: newReturnsDetails } = computeGreedyReturns({
        vault,
        allocation: newAllocation,
      });

      if (
        Math.random() < Math.exp((newReturns - currentReturns) / currentTemp) &&
        isAllocationAllowed(
          currentAllocation,
          currentReturnsDetails,
          newAllocation,
          newReturnsDetails,
        )
      ) {
        currentAllocation = structuredClone(newAllocation);
        currentReturns = newReturns;
        currentReturnsDetails = newReturnsDetails;

        acceptedMoves++;
        consecutiveFailures = 0;

        if (
          isBetterAllocation(
            vault,
            bestAllocation,
            bestReturns,
            bestReturnsDetails,
            newAllocation,
            newReturns,
            newReturnsDetails,
            initialReturnsDetails,
          )
        ) {
          bestAllocation = structuredClone(newAllocation);
          bestReturns = newReturns;
          bestReturnsDetails = newReturnsDetails;
        }
      } else {
        consecutiveFailures++;
      }
    }

    currentTemp *= ANNEALING_CONSTANTS.COOLING_RATE;

    if (
      acceptedMoves / ANNEALING_CONSTANTS.ITERATIONS_PER_TEMP <
      ANNEALING_CONSTANTS.MIN_ACCEPTANCE_RATE
    ) {
      consecutiveFailures += ANNEALING_CONSTANTS.ITERATIONS_PER_TEMP;
    }
  }

  return [bestAllocation, bestReturns] as const;
}

const isBetterAllocation = (
  vault: EulerEarn,
  oldAllocation: Allocation,
  oldReturns: number,
  oldReturnsDetails: ReturnsDetails,
  newAllocation: Allocation,
  newReturns: number,
  newReturnsDetails: ReturnsDetails,
  initialReturnsDetails: ReturnsDetails,
) => {
  const getMaxAPYDiff = (returnsDetails: ReturnsDetails) => {
    let low = Object.entries(returnsDetails).reduce((accu, [strategy, val]) => {
      const apy = val.interestAPY + val.rewardsAPY;
      return !isAddressEqual(strategy as Address, vault.idleVaultAddress) &&
        !isMinAllocation(getAddress(strategy), newAllocation) &&
        apy < accu
        ? apy
        : accu;
    }, Infinity);
    const high = Object.entries(returnsDetails).reduce((accu, [strategy, val]) => {
      const apy = val.interestAPY + val.rewardsAPY;
      return !isAddressEqual(strategy as Address, vault.idleVaultAddress) &&
        !isMinAllocation(getAddress(strategy), newAllocation) &&
        apy > accu
        ? apy
        : accu;
    }, 0);

    if (low == Infinity && high == 0) low = 0;
    if (low > high) throw new Error('High/low apy');

    return high - low;
  };

  // if current utilization is not allowed, the priority is to find an allowed one
  // TODO handle case where reallocation lowering below max utilization is not possible
  // TODO use actual kink
  if (isOverUtilized(oldReturnsDetails)) {
    return !isOverUtilized(newReturnsDetails);
  }

  if (isOutsideSoftCap(oldAllocation)) {
    return isSoftCapImproved(oldAllocation, newAllocation);
  }

  if (
    newReturns > oldReturns &&
    isAllocationAllowed(oldAllocation, oldReturnsDetails, newAllocation, newReturnsDetails)
  ) {
    if (ENV.MAX_STRATEGY_APY_DIFF) {
      const initialMaxDiff = getMaxAPYDiff(initialReturnsDetails);
      const newMaxDiff = getMaxAPYDiff(newReturnsDetails);
      const oldMaxDiff = getMaxAPYDiff(oldReturnsDetails);

      const maxAllowedDiff = ENV.MAX_STRATEGY_APY_DIFF;

      if (initialMaxDiff > maxAllowedDiff) {
        // prioritize reducing the diff if over the threshold
        return (
          newMaxDiff < maxAllowedDiff || (newMaxDiff < initialMaxDiff && newMaxDiff < oldMaxDiff)
        );
      } else {
        // initial diff was in range, check the new one is as well
        return newMaxDiff < maxAllowedDiff;
      }
    }

    return true;
  }
  return false;
};

export const isOverUtilized = (returnsDetails: ReturnsDetails) => {
  if (!ENV.MAX_UTILIZATION) return false;
  return Object.entries(returnsDetails).filter(([vault]) => {
    return !ENV.SOFT_CAPS[vault] || (ENV.SOFT_CAPS[vault].min + ENV.SOFT_CAPS[vault].max) !== 0n
  }).some(([_, rd]) => rd.utilization > ENV.MAX_UTILIZATION);
};

export const isFullyOverUtilized = (returnsDetails: ReturnsDetails) => {
  if (!ENV.MAX_UTILIZATION) return false;
  return Object.values(returnsDetails).every(rd => rd.utilization > ENV.MAX_UTILIZATION);
};

export const isOverUtilizationImproved = (
  oldAllocation: Allocation,
  oldReturnsDetails: ReturnsDetails,
  newAllocation: Allocation,
  newReturnsDetails: ReturnsDetails,
) => {
  if (!ENV.MAX_UTILIZATION) return false;

  const utilizationWeightedDeviation = (allocation: Allocation, returnsDetails: ReturnsDetails) =>
    Object.entries(allocation).reduce((accu, [strategy, a]) => {
      if (ENV.SOFT_CAPS[strategy]?.min === 0n) return accu
      const utilization = returnsDetails[strategy as Address].utilization;

      if (utilization > ENV.MAX_UTILIZATION) {
        const excess = BigInt(Math.floor((utilization - ENV.MAX_UTILIZATION)* 10000));
        return accu + (excess * a.newAmount);
      }
      return accu;
    }, 0n);


  return (
    utilizationWeightedDeviation(newAllocation, newReturnsDetails) <=
    utilizationWeightedDeviation(oldAllocation, oldReturnsDetails)
  );
};

export const isSoftCapImproved = (oldAllocation: Allocation, newAllocation: Allocation) => {
  if (!ENV.MAX_UTILIZATION) return false;

  const softCapExcess = (allocation: Allocation) =>
    Object.entries(allocation).reduce((accu, [strategy, a]) => {
      if (ENV.SOFT_CAPS[strategy]) {
        if (a.newAmount > ENV.SOFT_CAPS[strategy].max)
          return accu + a.newAmount - ENV.SOFT_CAPS[strategy].max;
        if (a.newAmount < ENV.SOFT_CAPS[strategy].min)
          return accu + ENV.SOFT_CAPS[strategy].min - a.newAmount;
      }
      return accu;
    }, 0n);

  return softCapExcess(newAllocation) < softCapExcess(oldAllocation);
};

export const isOutsideSoftCap = (allocation: Allocation) => {
  for (const vault in allocation) {
    if (
      ENV.SOFT_CAPS[vault] &&
      (ENV.SOFT_CAPS[vault].max < allocation[vault].newAmount ||
        ENV.SOFT_CAPS[vault].min > allocation[vault].newAmount)
    )
      return true;
  }
  return false;
};

export const isAllocationAllowed = (
  oldAllocation: Allocation,
  oldReturnsDetails: ReturnsDetails,
  newAllocation: Allocation,
  newReturnsDetails: ReturnsDetails,
) => {
  // if old allocation was within limits and the new one goes outside - don't allow
  if (
    (!isOverUtilized(oldReturnsDetails) && isOverUtilized(newReturnsDetails)) ||
    (!isOutsideSoftCap(oldAllocation) && isOutsideSoftCap(newAllocation))
  )
    return false;

  if (isOverUtilized(oldReturnsDetails)) {
    return isOverUtilizationImproved(
      oldAllocation,
      oldReturnsDetails,
      newAllocation,
      newReturnsDetails,
    );
  }

  if (isOutsideSoftCap(oldAllocation)) {
    return isSoftCapImproved(oldAllocation, newAllocation);
  }
  // TODO add soft caps improvement check

  if (Object.entries(newAllocation).some(([_, a]) => a.diff > 0 && a.diff < ENV.MIN_DEPOSIT))
    return false; // avoid zero shares error

  return !isOverUtilized(oldReturnsDetails) && !isOutsideSoftCap(newAllocation);
};

export const isMinAllocation = (strategy: Address, allocation: Allocation) => {
  const PERCENT_TOLERANCE = 10n;
  // if allocation is within 10% of the min, it's considered a forced allocation and is not checked for max apy diff
  const res =
    ENV.SOFT_CAPS[strategy]?.min &&
    ((allocation[strategy].newAmount - ENV.SOFT_CAPS[strategy].min) * 100n) /
      ENV.SOFT_CAPS[strategy].min >
      PERCENT_TOLERANCE;
  return Boolean(res);
};
