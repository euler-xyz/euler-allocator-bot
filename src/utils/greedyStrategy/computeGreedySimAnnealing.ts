import ANNEALING_CONSTANTS from '@/constants/annealingConstants';
import ENV from '@/constants/constants';
import {
  Allocation,
  EulerEarn,
  ReturnsDetails,
  type AllocationDetails,
} from '@/types/types';
import { parseNumberToBigIntWithScale } from '@/utils/common/parser';
import { computeGreedyReturns } from '@/utils/greedyStrategy/computeGreedyReturns';
import { Address, isAddressEqual, zeroAddress } from 'viem';

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
  const destStrategyCap = vault.strategies[destVault].cap - destVaultAllocation.diff;

  const maxTransfer = [
    srcCurrentAmount,
    srvVaultMaxWithdraw,
    destSupplyCap,
    destStrategyCap,
  ].reduce((min, curr) => (curr < min ? curr : min));
  const maxTransferTempAdj =
    (maxTransfer * parseNumberToBigIntWithScale(temperature, 18)) / BigInt(10) ** BigInt(18);

  return (
    (maxTransferTempAdj * parseNumberToBigIntWithScale(Math.random(), 18)) /
    BigInt(10) ** BigInt(18)
  );
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

  const sourceIdx = Math.floor(Math.random() * vaultList.length);
  const destIdx =
    (sourceIdx + 1 + Math.floor(Math.random() * (vaultList.length - 1))) % vaultList.length;
  const srcVaultAddress = vaultList[sourceIdx];
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
  // if (srcVaultAddress === '0x6aFB8d3F6D4A34e9cB2f217317f4dc8e05Aa673b' && destVaultAddress == '0x05d28A86E057364F6ad1a88944297E58Fc6160b3') {
  //   if (transferAmount > 120000000000n && transferAmount < 200000000000n) {
  //     console.log(newAllocation);
  //   }
  // }
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

      if (Math.random() < Math.exp((newReturns - currentReturns) / currentTemp) && !isOverUtilized(newReturnsDetails)) {
        currentAllocation = structuredClone(newAllocation);
        currentReturns = newReturns;

        acceptedMoves++;
        consecutiveFailures = 0;

        if (
          isBetterAllocation(
            vault,
            bestReturns,
            bestReturnsDetails,
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
  oldReturns: number,
  oldReturnsDetails: ReturnsDetails,
  newReturns: number,
  newReturnsDetails: ReturnsDetails,
  initialReturnsDetails: ReturnsDetails,
) => {
  const getMaxAPYDiff = (returnsDetails: ReturnsDetails) => {
    const low = Object.entries(returnsDetails).reduce((accu, [strategy, val]) => {
      const apy = val.interestAPY + val.rewardsAPY;
      return !isAddressEqual(strategy as Address, vault.idleVaultAddress) && apy < accu
        ? apy
        : accu;
    }, Infinity);
    const high = Object.entries(returnsDetails).reduce((accu, [strategy, val]) => {
      const apy = val.interestAPY + val.rewardsAPY;
      return !isAddressEqual(strategy as Address, vault.idleVaultAddress) && apy > accu
        ? apy
        : accu;
    }, 0);

    if (low > high) throw new Error('High/low apy');

    return high - low;
  };

  // if current utilization is higher than allowed, the priority is to lower it
  // TODO handle case where reallocation lowering below max is not possible
  // TODO use actual kink
  if (isOverUtilized(oldReturnsDetails)) {
    return !isOverUtilized(newReturnsDetails);
  }

  if (newReturns > oldReturns && !isOverUtilized(newReturnsDetails)) {
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
  for (const rd of Object.values(returnsDetails)) {
    if (rd.utilization > ENV.MAX_UTILIZATION) return true;
  }
  return false;
};
