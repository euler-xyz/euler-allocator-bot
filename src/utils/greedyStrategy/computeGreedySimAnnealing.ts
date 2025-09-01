import ANNEALING_CONSTANTS from '@/constants/annealingConstants';
import { Allocation, EulerEarn, StrategyDetails, type AllocationDetails } from '@/types/types';
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
  initialReturns,
}: {
  vault: EulerEarn;
  initialAllocation: Allocation;
  initialReturns: number;
}) {
  let currentAllocation = structuredClone(initialAllocation);
  let bestAllocation = structuredClone(initialAllocation);

  let currentReturns = initialReturns;
  let bestReturns = initialReturns;

  let currentTemp = ANNEALING_CONSTANTS.INITIAL_TEMP;
  let consecutiveFailures = 0;
  while (
    currentTemp > ANNEALING_CONSTANTS.MIN_TEMP &&
    consecutiveFailures < ANNEALING_CONSTANTS.MAX_CONSECUTIVE_FAILURES
  ) {
    let acceptedMoves = 0;
    for (let i = 0; i < ANNEALING_CONSTANTS.ITERATIONS_PER_TEMP; i++) {
      const newAllocation = generateNeighbor(vault, currentAllocation, currentTemp);
      const { totalReturns: newReturns } = computeGreedyReturns({
        vault,
        allocation: newAllocation,
      });

      if (Math.random() < Math.exp((newReturns - currentReturns) / currentTemp)) {
        currentAllocation = structuredClone(newAllocation);
        currentReturns = newReturns;

        acceptedMoves++;
        consecutiveFailures = 0;

        if (newReturns > bestReturns) {
          bestAllocation = structuredClone(newAllocation);
          bestReturns = newReturns;
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
