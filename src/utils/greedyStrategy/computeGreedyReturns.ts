import { Allocation, EulerEarn, protocolSchema, ReturnsDetails } from '@/types/types';
import { parseBigIntToNumberWithScale } from '@/utils/common/parser';
import {
  resolveEulerBorrowAPY,
  resolveEulerInterestRate,
  resolveEulerSupplyAPY,
} from '@/utils/euler/resolveEulerUnits';
import { computeMerklRewardAPY } from '@/utils/rewards/merkl';

/**
 * @notice Computes the weighted average returns for an allocation across vaults
 * @dev Returns are weighted by allocation amount and account for post-impact APY
 * @returns Weighted average returns across all vaults (e.g. 5 = 5% APY)
 */
export function computeGreedyReturns({
  vault,
  allocation,
}: {
  vault: EulerEarn;
  allocation: Allocation;
}) {
  let returns = 0;
  let totalAllocation = 0;
  let details: ReturnsDetails = {};

  Object.entries(allocation).forEach(([strategy, allocationInfo]) => {
    const newAmount = parseBigIntToNumberWithScale(allocationInfo.newAmount, vault.assetDecimals);
    totalAllocation += newAmount;

    const strategyInfo = vault.strategies[strategy].details;
    if (strategyInfo.protocol === protocolSchema.Enum.euler) {
      const postImpactInterestRate = resolveEulerInterestRate({
        cash: strategyInfo.cash + allocationInfo.diff,
        totalBorrows: strategyInfo.totalBorrows,
        irmConfig: strategyInfo.irmConfig,
      });
      const postImpactAPY = resolveEulerSupplyAPY({
        assetDecimals: vault.assetDecimals,
        borrowAPY: resolveEulerBorrowAPY(postImpactInterestRate),
        cash: strategyInfo.cash + allocationInfo.diff,
        interestFee: strategyInfo.interestFee,
        totalBorrows: strategyInfo.totalBorrows,
      });
      const postImpactRewardAPY = computeMerklRewardAPY({
        assetDecimals: vault.assetDecimals,
        cash: strategyInfo.cash + allocationInfo.diff,
        totalBorrows: strategyInfo.totalBorrows,
        rewardCampaigns: strategyInfo.rewardCampaigns,
      });
      returns += newAmount * (postImpactAPY + postImpactRewardAPY);
      details[strategyInfo.vault] = {
        interestAPY: postImpactAPY,
        rewardsAPY: postImpactRewardAPY,
      };
    } // Can add more protocols here
  });

  const totalReturns = totalAllocation ? returns / totalAllocation : 0;

  return { totalReturns, details };
}
