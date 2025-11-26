import { describe, expect, it } from '@jest/globals';
import { Address, zeroAddress } from 'viem';
import { protocolSchema } from '../../../src/types/types';
import { computeGreedyInitAlloc } from '../../../src/utils/greedyStrategy/computeGreedyInitAlloc';

const baseStrategy = {
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
  supplyCap: 0n,
  irmConfig: {
    type: 'irm' as const,
    baseRate: 0n,
    kink: 0n,
    slope1: 0n,
    slope2: 0n,
  },
};

type StrategyConfig = {
  address: Address;
  supplyAPY: number;
  rewardAPY: number;
  supplyCap: bigint;
  cash: bigint;
  totalBorrows: bigint;
  allocation: bigint;
  cap?: bigint;
};

const createVault = (strategies: StrategyConfig[], idleAllocation: bigint) => {
  const entries = strategies.map(({ address, allocation, cap, ...rest }) => [
    address,
    {
      cap: cap ?? rest.supplyCap,
      protocol: protocolSchema.Enum.euler,
      allocation,
      details: {
        ...baseStrategy,
        ...rest,
        vault: address,
      },
    },
  ]);

  entries.push([
    zeroAddress,
    {
      cap: 0n,
      protocol: protocolSchema.Enum.euler,
      allocation: idleAllocation,
      details: {
        ...baseStrategy,
        vault: zeroAddress,
        supplyCap: 0n,
        cash: idleAllocation,
      },
    },
  ]);

  return {
    strategies: Object.fromEntries(entries),
    idleVaultAddress: zeroAddress,
    assetDecimals: 6,
    initialAllocationQueue: entries.map(([address]) => address as Address),
  };
};

const serializeAllocation = (
  allocation: Record<string, { oldAmount: bigint; newAmount: bigint; diff: bigint }>,
) =>
  Object.fromEntries(
    Object.entries(allocation).map(([address, values]) => [
      address,
      {
        oldAmount: values.oldAmount.toString(),
        newAmount: values.newAmount.toString(),
        diff: values.diff.toString(),
      },
    ]),
  );

describe('computeGreedyInitAlloc', () => {
  it('allocates additional amount to the highest APY strategy', () => {
    const vault = createVault(
      [
        {
          address: '0x0000000000000000000000000000000000000001' as Address,
          supplyAPY: 0.1,
          rewardAPY: 0.1,
          supplyCap: 10_000n,
          cash: 3_000n,
          totalBorrows: 3_000n,
          allocation: 300n,
        },
        {
          address: '0x0000000000000000000000000000000000000002' as Address,
          supplyAPY: 0.2,
          rewardAPY: 0.2,
          supplyCap: 15_000n,
          cash: 9_000n,
          totalBorrows: 1_000n,
          allocation: 500n,
        },
      ],
      100n,
    );

    const allocations = computeGreedyInitAlloc({
      vault,
      allocatableAmount: 800n,
      cashAmount: 100n,
    });

    expect(serializeAllocation(allocations)).toEqual(
      serializeAllocation({
        [zeroAddress]: { oldAmount: 100n, newAmount: 100n, diff: 0n },
        '0x0000000000000000000000000000000000000001': {
          oldAmount: 300n,
          newAmount: 0n,
          diff: -300n,
        },
        '0x0000000000000000000000000000000000000002': {
          oldAmount: 500n,
          newAmount: 800n,
          diff: 300n,
        },
      }),
    );
  });

  it('respects supply caps and available cash when reallocating', () => {
    const vault = createVault(
      [
        {
          address: '0x0000000000000000000000000000000000000001' as Address,
          supplyAPY: 0.1,
          rewardAPY: 0.1,
          supplyCap: 6_300n,
          cash: 150n,
          totalBorrows: 3_000n,
          allocation: 500n,
        },
        {
          address: '0x0000000000000000000000000000000000000002' as Address,
          supplyAPY: 0.2,
          rewardAPY: 0.2,
          supplyCap: 10_200n,
          cash: 9_000n,
          totalBorrows: 1_000n,
          allocation: 300n,
        },
      ],
      400n,
    );

    const allocations = computeGreedyInitAlloc({
      vault,
      allocatableAmount: 1_100n,
      cashAmount: 100n,
    });

    expect(serializeAllocation(allocations)).toEqual(
      serializeAllocation({
        [zeroAddress]: { oldAmount: 400n, newAmount: 100n, diff: -300n },
        '0x0000000000000000000000000000000000000001': {
          oldAmount: 500n,
          newAmount: 600n,
          diff: 100n,
        },
        '0x0000000000000000000000000000000000000002': {
          oldAmount: 300n,
          newAmount: 500n,
          diff: 200n,
        },
      }),
    );
  });
});
