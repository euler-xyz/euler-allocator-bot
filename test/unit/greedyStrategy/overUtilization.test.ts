import { Address, zeroAddress } from 'viem';

jest.mock('@/constants/constants', () => ({
  __esModule: true,
  default: {
    MAX_UTILIZATION: 0.9,
    SOFT_CAPS: {},
    MIN_DEPOSIT: 10,
    MAX_STRATEGY_APY_DIFF: 0,
  },
}));

import { protocolSchema, ReturnsDetails } from '@/types/types';
import {
  isAllocationAllowed,
  isOverUtilizationImproved,
} from '@/utils/greedyStrategy/computeGreedySimAnnealing';

describe('over utilization handling', () => {
  const overUtilizedVault = '0x0000000000000000000000000000000000000001' as Address;
  const otherVault = '0x0000000000000000000000000000000000000002' as Address;
  const baseDetails = {
    vault: zeroAddress as Address,
    symbol: 'SYM',
    protocol: protocolSchema.Enum.euler,
    borrowAPY: 0,
    supplyAPY: 0,
    rewardCampaigns: [],
    rewardAPY: 0,
    cash: 0n,
    totalBorrows: 0n,
    totalShares: 0n,
    interestFee: 0,
    supplyCap: 1_000_000n,
    irmConfig: {
      type: 'irm' as const,
      baseRate: 0n,
      kink: 0n,
      slope1: 0n,
      slope2: 0n,
    },
  };

  const vault = {
    strategies: {
      [overUtilizedVault]: {
        cap: 1_000_000n,
        protocol: protocolSchema.Enum.euler,
        allocation: 100n,
        details: {
          ...baseDetails,
          vault: overUtilizedVault,
          cash: 50n,
          totalBorrows: 950n,
        },
      },
      [otherVault]: {
        cap: 1_000_000n,
        protocol: protocolSchema.Enum.euler,
        allocation: 400n,
        details: {
          ...baseDetails,
          vault: otherVault,
          cash: 600n,
          totalBorrows: 400n,
        },
      },
    },
    idleVaultAddress: zeroAddress,
    assetDecimals: 6,
    initialAllocationQueue: [overUtilizedVault, otherVault],
  };

  const oldAllocation = {
    [overUtilizedVault]: { oldAmount: 100n, newAmount: 100n, diff: 0n },
    [otherVault]: { oldAmount: 400n, newAmount: 400n, diff: 0n },
  };

  const newAllocation = {
    [overUtilizedVault]: { oldAmount: 100n, newAmount: 140n, diff: 40n },
    [otherVault]: { oldAmount: 400n, newAmount: 360n, diff: -40n },
  };

  const oldReturns: ReturnsDetails = {
    [overUtilizedVault]: { interestAPY: 20, rewardsAPY: 0, utilization: 0.95 },
    [otherVault]: { interestAPY: 5, rewardsAPY: 0, utilization: 0.4 },
  };

  const newReturns: ReturnsDetails = {
    [overUtilizedVault]: { interestAPY: 15, rewardsAPY: 0, utilization: 0.913461 },
    [otherVault]: { interestAPY: 5, rewardsAPY: 0, utilization: 0.425531 },
  };

  it('treats additional liquidity to an over-utilized vault as an improvement', () => {
    expect(
      isOverUtilizationImproved(vault, oldAllocation, oldReturns, newAllocation, newReturns),
    ).toBe(true);
  });

  it('allows incremental steps that reduce utilization but do not yet reach the cap', () => {
    expect(isAllocationAllowed(vault, oldAllocation, oldReturns, newAllocation, newReturns)).toBe(
      true,
    );
  });
});
