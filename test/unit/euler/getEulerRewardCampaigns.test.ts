import { PublicClient, zeroAddress } from 'viem';
import { getEulerRewardCampaigns } from '../../../src/utils/euler/getEulerRewardCampaigns';

jest.mock('@/utils/notifications/telegram', () => {
  const actualModule = jest.requireActual('@/utils/notifications/telegram');
  return {
    ...actualModule,
    sendTelegramMessage: jest.fn(() => []),
  };
});

jest.mock('@/utils/euler/getEulerBalanceOf', () => {
  const actualModule = jest.requireActual('@/utils/euler/getEulerBalanceOf');
  return {
    ...actualModule,
    getEulerBalanceOf: jest.fn(() => BigInt(100)),
  };
});

jest.mock('@/utils/common/getTokenPrice', () => {
  const actualModule = jest.requireActual('@/utils/common/getTokenPrice');
  return {
    ...actualModule,
    getTokenPrice: jest.fn(() => 1),
  };
});

describe('getEulerRewardCampaigns', () => {
  const chainId = 1;

  const mockRpcClient = {} as unknown as PublicClient;

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

  global.fetch = jest.fn();

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('case - chain not found', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const result = await getEulerRewardCampaigns({
      chainId,
      vaultAddress: zeroAddress,
      cash: BigInt(0),
      totalBorrows: BigInt(0),
      totalShares: BigInt(0),
      rpcClient: mockRpcClient,
    });
    expect(result).toEqual([]);
  });

  it('case - parse error', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            ...mockMerklData,
            amount: 100000000000000000000,
          },
        ]),
    });

    await expect(
      getEulerRewardCampaigns({
        chainId,
        vaultAddress: zeroAddress,
        cash: BigInt(0),
        totalBorrows: BigInt(0),
        totalShares: BigInt(0),
        rpcClient: mockRpcClient,
      }),
    ).rejects.toThrow();
  });

  it('case - normal', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            ...mockMerklData,
            amount: '100000000000000000000',
            endTimestamp: 100,
          }, // will be excluded because of endTimestamp
          {
            ...mockMerklData,
            amount: '400000000000000000000',
            subType: 1,
          }, // will be excluded because of campaignSubType
          {
            ...mockMerklData,
            amount: '200000000000000000000',
            params: {
              ...mockMerklData.params,
              whitelist: [zeroAddress],
            },
          }, // will be excluded because of whitelist
          {
            ...mockMerklData,
            amount: '500000000000000000000',
            params: {
              ...mockMerklData.params,
              evkAddress: '0x0000000000000000000000000000000000012345',
            },
          }, // will be excluded because of evkAddress mismatch
          {
            ...mockMerklData,
            amount: '300000000000000000000',
            params: {
              ...mockMerklData.params,
              blacklist: [zeroAddress, zeroAddress],
            },
          },
        ]),
    });

    const result = await getEulerRewardCampaigns({
      chainId,
      vaultAddress: zeroAddress,
      cash: BigInt(0),
      totalBorrows: BigInt(0),
      totalShares: BigInt(0),
      rpcClient: mockRpcClient,
    });
    expect(
      result.map(campaign => ({
        ...campaign,
        blacklistedSupply: campaign.blacklistedSupply.toString(),
      })),
    ).toEqual([
      {
        dailyReward: 6480,
        blacklistedSupply: '200',
      },
    ]);
  });
});
