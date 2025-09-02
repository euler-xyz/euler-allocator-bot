import ANNEALING_CONSTANTS from '@/constants/annealingConstants';
import ENV from '@/constants/constants';
import {
  Allocation,
  EulerEarn,
  ReturnsDetails,
  StrategyDetails,
  type AllocationDetails,
} from '@/types/types';
import { parseNumberToBigIntWithScale } from '@/utils/common/parser';
import { computeGreedyReturns } from '@/utils/greedyStrategy/computeGreedyReturns';
import { Address, zeroAddress } from 'viem';

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
 * @param currentAllocation Current allocation state
 * @param vaultDetails Details of all vaults
 * @param temperature Current annealing temperature
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

  return newAllocation;
}

/**
 * @notice Main simulated annealing optimization function
 * @param assetDecimals The decimal precision of the asset
 * @param vaultDetails Details of all vaults including constraints and APYs
 * @param initialAllocation Starting allocation state
 * @param initialReturns Returns from initial allocation
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

      if (Math.random() < Math.exp((newReturns - currentReturns) / currentTemp)) {
        currentAllocation = structuredClone(newAllocation);
        currentReturns = newReturns;

        acceptedMoves++;
        consecutiveFailures = 0;

        if (
          isBetterAllocation(
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
  oldReturns: number,
  oldReturnsDetails: ReturnsDetails,
  newReturns: number,
  newReturnsDetails: ReturnsDetails,
  initialReturnsDetails: ReturnsDetails,
) => {
  const getMaxAPYDiff = (returnsDetails: ReturnsDetails) => {
    const low = Object.values(returnsDetails).reduce((accu, val) => {
      const apy = val.interestAPY + val.rewardsAPY;
      return apy > 0 && apy < accu ? apy : accu; // TODO find idle vault
    }, Infinity);
    const high = Object.values(returnsDetails).reduce((accu, val) => {
      const apy = val.interestAPY + val.rewardsAPY;
      return apy > 0 && apy > accu ? apy : accu; // TODO find idle vault
    }, 0);

    if (low > high) throw new Error('High/low apy');

    return high - low;
  };
  if (newReturns > oldReturns) {
    if (ENV.MAX_STRATEGY_APY_DIFF) {
      const initialMaxDiff = getMaxAPYDiff(initialReturnsDetails);
      const newMaxDiff = getMaxAPYDiff(newReturnsDetails);
      const oldMaxDiff = getMaxAPYDiff(oldReturnsDetails);

      const maxAllowedDiff = ENV.MAX_STRATEGY_APY_DIFF;

      if (initialMaxDiff > maxAllowedDiff) {
        // prioritize reducing the diff if over the threshold
        return (newMaxDiff < maxAllowedDiff) || (newMaxDiff < initialMaxDiff && newMaxDiff < oldMaxDiff);
      } else {
        // initial diff was in range, check the new one is as well
        return newMaxDiff < maxAllowedDiff;
      }
    }

    return true;
  }
  return false;
};
