import { type MerklData, type RewardCampaign } from '@/types/types';
import { parseBigIntToNumberWithScale } from '@/utils/common/parser';

const ONE_YEAR = 365;
const ONE_DAY_IN_SEC = 86400;

/**
 * @notice Calculates the daily reward amount for a Merkl campaign in target token terms
 * @param data The Merkl campaign data containing reward amounts, decimals and prices
 * @param priceUnderlyingToken The price of the underlying token in USD
 * @returns Daily reward amount denominated in target token
 */
export function computeMerklDailyReward({
  data,
  priceUnderlyingToken,
}: {
  data: MerklData;
  priceUnderlyingToken: number;
}) {
  const amount = parseBigIntToNumberWithScale(BigInt(data.amount), data.rewardToken.decimals);
  const amountInUSD = amount * data.rewardToken.price;
  const amountInTargetToken = amountInUSD / priceUnderlyingToken;

  return (amountInTargetToken * ONE_DAY_IN_SEC) / data.params.duration;
}

/**
 * @notice Calculates the annualized reward APY for a vault's Merkl campaigns
 * @param assetDecimals The decimal precision of the vault's asset
 * @param cash The cash balance of the vault
 * @param totalBorrows The total borrows of the vault
 * @param rewardCampaigns The list of Merkl campaigns for the vault
 * @returns Total reward APY as a percentage (e.g. 5 = 5% APY)
 */
export function computeMerklRewardAPY({
  assetDecimals,
  cash,
  totalBorrows,
  rewardCampaigns,
}: {
  assetDecimals: number;
  cash: bigint;
  totalBorrows: bigint;
  rewardCampaigns: RewardCampaign[];
}) {
  let rewardAPY = 0;
  const totalAssets = cash + totalBorrows;
  rewardCampaigns.forEach(campaign => {
    const nominator = campaign.dailyReward * ONE_YEAR;
    const denominator = parseBigIntToNumberWithScale(
      totalAssets - campaign.blacklistedSupply,
      assetDecimals,
    );

    rewardAPY += nominator / denominator;
  });

  return rewardAPY * 100;
}
