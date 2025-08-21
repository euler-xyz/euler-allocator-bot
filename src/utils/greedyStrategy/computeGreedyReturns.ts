import { protocolSchema, type AllocationDetails, type VaultDetails } from '@/types/types';
import { parseBigIntToNumberWithScale } from '@/utils/common/parser';
import {
  resolveEulerBorrowAPY,
  resolveEulerInterestRate,
  resolveEulerSupplyAPY,
} from '@/utils/euler/resolveEulerUnits';
import { computeMerklRewardAPY } from '@/utils/rewards/merkl';
import { zeroAddress } from 'viem';

/**
 * @notice Computes the weighted average returns for an allocation across vaults
 * @dev Returns are weighted by allocation amount and account for post-impact APY
 * @param assetDecimals The decimal precision of the asset
 * @param vaultDetails Record of vault details including protocol, cash, borrows etc
 * @param allocation Record of allocation details with old/new amounts and diffs
 * @returns Weighted average returns across all vaults (e.g. 5 = 5% APY)
 */
export function computeGreedyReturns({
  assetDecimals,
  vaultDetails,
  allocation,
  log = false,
}: {
  assetDecimals: number;
  vaultDetails: Record<string, VaultDetails>;
  allocation: Record<string, AllocationDetails>;
  log?: boolean;
}) {
  let returns = 0;
  let totalAllocation = 0;

  Object.entries(allocation).forEach(([vault, allocationInfo]) => {
    const newAmount = parseBigIntToNumberWithScale(allocationInfo.newAmount, assetDecimals);
    totalAllocation += newAmount;
    if (vault === zeroAddress) return;

    const vaultInfo = vaultDetails[vault];
    if (vaultInfo.protocol === protocolSchema.Enum.euler) {
      const postImpactInterestRate = resolveEulerInterestRate({
        cash: vaultInfo.cash + allocationInfo.diff,
        totalBorrows: vaultInfo.totalBorrows,
        irmConfig: vaultInfo.irmConfig,
      });
      const postImpactAPY = resolveEulerSupplyAPY({
        assetDecimals,
        borrowAPY: resolveEulerBorrowAPY(postImpactInterestRate),
        cash: vaultInfo.cash + allocationInfo.diff,
        interestFee: vaultInfo.interestFee,
        totalBorrows: vaultInfo.totalBorrows,
      });
      const postImpactRewardAPY = computeMerklRewardAPY({
        assetDecimals,
        cash: vaultInfo.cash + allocationInfo.diff,
        totalBorrows: vaultInfo.totalBorrows,
        rewardCampaigns: vaultInfo.rewardCampaigns,
      });
      returns += newAmount * (postImpactAPY + postImpactRewardAPY);

      if (log)
        console.log(
          'Returns',
          vaultInfo.vault,
          'Supply APY: ',
          postImpactAPY,
          'Rewards APY:',
          postImpactRewardAPY,
          'Total: ',
          postImpactAPY + postImpactRewardAPY,
        );
    } // Can add more protocols here
  });

  const totalRewards = totalAllocation ? returns / totalAllocation : 0;

  if (log) console.log('Total rewards', totalRewards);

  return totalRewards;
}
