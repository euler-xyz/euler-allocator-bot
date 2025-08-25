import { EulerEarn, Strategies, type AllocationDetails, type VaultDetails } from '@/types/types';
import { parseBigIntToNumberWithScale } from '@/utils/common/parser';

/**
 * @notice Checks if any vault's supply APY has changed beyond the tolerance threshold
 * @param vaultDetails Previous vault details mapping
 * @param newVaultDetails Current vault details mapping
 * @param tolerance Maximum allowed absolute difference in APY
 * @returns True if any vault's APY change exceeds tolerance, false otherwise
 */
export function checkVaultDetailsDiff({
  vaultDetails,
  newVaultDetails,
  tolerance,
}: {
  vaultDetails: Record<string, VaultDetails>;
  newVaultDetails: Record<string, VaultDetails>;
  tolerance: number;
}) {
  for (const vaultAddress in vaultDetails) {
    const oldAPY = vaultDetails[vaultAddress].supplyAPY + vaultDetails[vaultAddress].rewardAPY;
    const newAPY =
      newVaultDetails[vaultAddress].supplyAPY + newVaultDetails[vaultAddress].rewardAPY;
    const currentDiff = Math.abs(newAPY - oldAPY);
    if (currentDiff > tolerance) return true;
  }
  return false;
}

/**
 * @notice Checks if any strategy's amount has changed beyond the tolerance threshold
 * @param assetDecimals The decimal precision of the asset
 * @param strategyAmounts Previous strategy amounts mapping
 * @param newStrategyAmounts Current strategy amounts mapping
 * @param tolerance Maximum allowed relative difference in amounts
 * @returns True if any strategy's amount change exceeds tolerance, false otherwise
 */
export function checkStrategyAmountsDiff({
  assetDecimals,
  strategyAmounts,
  newStrategyAmounts,
  tolerance,
}: {
  assetDecimals: number;
  strategyAmounts: Record<string, bigint>;
  newStrategyAmounts: Record<string, bigint>;
  tolerance: number;
}) {
  for (const strategyAddress in strategyAmounts) {
    const oldAmount = parseBigIntToNumberWithScale(strategyAmounts[strategyAddress], assetDecimals);
    const newAmount = parseBigIntToNumberWithScale(
      newStrategyAmounts[strategyAddress],
      assetDecimals,
    );
    const currentDiff = Math.abs(newAmount - oldAmount) / oldAmount;
    if (currentDiff > tolerance) return true;
  }
  return false;
}

/**
 * @notice Checks if allocation changes are bigger than the tolerance threshold
 * @param assetDecimals The decimal precision of the asset
 * @param allocation Mapping of vault addresses to allocation details
 * @param tolerance Maximum allowed relative difference in amounts
 * @returns True if all allocation changes are less than the tolerance, false otherwise
 */
export function checkAllocationDiff({
  assetDecimals,
  allocation,
  tolerance,
}: {
  assetDecimals: number;
  allocation: Record<string, AllocationDetails>;
  tolerance: number;
}) {
  for (const vaultAddress in allocation) {
    const oldAmount = parseBigIntToNumberWithScale(
      allocation[vaultAddress].oldAmount,
      assetDecimals,
    );
    const newAmount = parseBigIntToNumberWithScale(
      allocation[vaultAddress].newAmount,
      assetDecimals,
    );
    const currentDiff = Math.abs(newAmount - oldAmount) / oldAmount;
    if (currentDiff > tolerance) return false;
  }
  return true;
}

export function checkAllocationTotals(
  vault: EulerEarn,
  allocations: Record<string, AllocationDetails>,
) {
  const totalAssets = Object.values(vault.strategies).reduce(
    (accu, { allocation }) => accu + allocation,
    0n,
  );
  const totalAllocated = Object.values(allocations).reduce(
    (accu, allocation) => accu + allocation.newAmount,
    0n,
  );

  return totalAssets !== totalAllocated;
}
