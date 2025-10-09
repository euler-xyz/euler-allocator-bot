import { Address, zeroAddress } from 'viem';
import { protocolSchema } from '../../../src/types/types';
import { computeGreedyReturns } from '../../../src/utils/greedyStrategy/computeGreedyReturns';

jest.mock('@/utils/euler/resolveEulerUnits', () => {
  const actualModule = jest.requireActual('@/utils/euler/resolveEulerUnits');
  return {
    ...actualModule,
    resolveEulerBorrowAPY: jest.fn(() => 10),
    resolveEulerInterestRate: jest.fn(() => BigInt('634195839000000000')),
  };
});

describe('computeGreedyReturns', () => {
  const defaultVaultProps = {
    vault: zeroAddress as Address,
    symbol: 'SYM',
    protocol: protocolSchema.Enum.euler,
    borrowAPY: 0,
    supplyAPY: 0,
    rewardCampaigns: [],
    rewardAPY: 0,
    cash: BigInt(0),
    totalBorrows: BigInt(0),
    totalShares: BigInt(0),
    interestFee: 0,
    supplyCap: BigInt(0),
    irmConfig: {
      type: 'irm' as const,
      baseRate: BigInt(0),
      kink: BigInt(0),
      slope1: BigInt(0),
      slope2: BigInt(0),
    },
  };

  it('computes weighted returns for euler strategies', () => {
    const strategyDetails = {
      '0x1': {
        ...defaultVaultProps,
        vault: '0x1' as Address,
        cash: BigInt(1050 * 1e6),
        totalBorrows: BigInt(9100 * 1e6),
        interestFee: 1000,
        rewardCampaigns: [
          {
            dailyReward: 2,
            blacklistedSupply: BigInt(5000 * 1e6),
          },
        ],
      },
      '0x2': {
        ...defaultVaultProps,
        vault: '0x2' as Address,
        cash: BigInt(7000 * 1e6),
        totalBorrows: BigInt(3000 * 1e6),
      },
    };

    const initialQueue = Object.keys(strategyDetails) as Address[];

    const vault = {
      strategies: Object.fromEntries(
        Object.entries(strategyDetails).map(([address, details]) => [
          address,
          {
            cap: BigInt(0),
            protocol: protocolSchema.Enum.euler,
            allocation: BigInt(0),
            details,
          },
        ]),
      ),
      idleVaultAddress: zeroAddress,
      assetDecimals: 6,
      initialAllocationQueue: initialQueue,
    } as const;

    const allocation = {
      '0x1': {
        oldAmount: BigInt(450 * 1e6),
        newAmount: BigInt(300 * 1e6),
        diff: BigInt(-150 * 1e6),
      },
      '0x2': {
        oldAmount: BigInt(500 * 1e6),
        newAmount: BigInt(500 * 1e6),
        diff: BigInt(0),
      },
    };

    const { totalReturns, details } = computeGreedyReturns({
      vault,
      allocation,
    });

    expect(totalReturns).toBeCloseTo(10.42125, 5);
    expect(Object.keys(details)).toEqual(['0x1', '0x2']);
    expect(details['0x1'].utilization).toBeGreaterThan(0);
  });
});
