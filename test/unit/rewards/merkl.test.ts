import { zeroAddress } from 'viem';
import { computeMerklDailyReward, computeMerklRewardAPY } from '../../../src/utils/rewards/merkl';

describe('computeMerklDailyReward', () => {
  const assetDecimals = 6;

  describe('computeMerklDailyReward', () => {
    const mockMerklData = {
      amount: '100000000000000000000',
      startTimestamp: Math.floor(Date.now() / 1000) - 1000,
      endTimestamp: Math.floor(Date.now() / 1000) + 1000,
      subType: 0,
      params: {
        evkAddress: zeroAddress,
        addressAsset: zeroAddress,
        duration: 2000,
        whitelist: [],
        blacklist: [],
      },
      rewardToken: {
        decimals: 18,
        price: 0.5,
      },
    };

    it('compute the daily reward', () => {
      const result = computeMerklDailyReward({
        data: mockMerklData,
        priceUnderlyingToken: 0.1,
      });
      expect(result).toBe(21600);
    });
  });

  describe('computeMerklRewardAPY', () => {
    it('compute the reward APY - no diff', () => {
      const result = computeMerklRewardAPY({
        assetDecimals,
        cash: BigInt(1200 * 1e6),
        totalBorrows: BigInt(1000 * 1e6),
        rewardCampaigns: [
          {
            dailyReward: 1,
            blacklistedSupply: BigInt(200 * 1e6),
          },
          {
            dailyReward: 2,
            blacklistedSupply: BigInt(740 * 1e6),
          },
        ],
      });
      expect(result).toBe(68.25);
    });
  });
});
