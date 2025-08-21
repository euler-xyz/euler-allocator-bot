import { describe, expect, it } from '@jest/globals';
import { zeroAddress } from 'viem';
import { protocolSchema } from '../../../src/types/types';
import { computeGreedyInitAlloc } from '../../../src/utils/greedyStrategy/computeGreedyInitAlloc';

describe('computeGreedyInitAlloc', () => {
  const defaultVaultProps = {
    vault: '0x0',
    protocol: protocolSchema.Enum.euler,
    borrowAPY: 0,
    supplyAPY: 0,
    rewardCampaigns: [],
    rewardAPY: 0,
    cash: BigInt(0),
    totalBorrows: BigInt(0),
    totalShares: BigInt(0),
    interestFee: 0,
    irmConfig: {
      type: 'irm' as const,
      baseRate: BigInt(0),
      kink: BigInt(0),
      slope1: BigInt(0),
      slope2: BigInt(0),
    },
  };

  it('no constraints', () => {
    const vaultDetails = {
      '0x1': {
        ...defaultVaultProps,
        vault: '0x1',
        supplyAPY: 0.1,
        rewardAPY: 0.1,
        supplyCap: BigInt(10000),
        cash: BigInt(3000),
        totalBorrows: BigInt(3000),
      },
      '0x2': {
        ...defaultVaultProps,
        vault: '0x2',
        supplyAPY: 0.2,
        rewardAPY: 0.2,
        supplyCap: BigInt(15000),
        cash: BigInt(9000),
        totalBorrows: BigInt(1000),
      },
    };
    const strategyAmounts = {
      [zeroAddress]: BigInt(100),
      '0x1': BigInt(300),
      '0x2': BigInt(500),
    };
    const allocatableAmount = BigInt(800);
    const cashAmount = BigInt(100);

    const allocations = computeGreedyInitAlloc({
      vaultDetails,
      strategyAmounts,
      allocatableAmount,
      cashAmount,
    });
    expect(allocations[zeroAddress]).toStrictEqual({
      oldAmount: BigInt(100),
      newAmount: BigInt(100),
      diff: BigInt(0),
    });
    expect(allocations['0x1']).toStrictEqual({
      oldAmount: BigInt(300),
      newAmount: BigInt(0),
      diff: BigInt(-300),
    });
    expect(allocations['0x2']).toStrictEqual({
      oldAmount: BigInt(500),
      newAmount: BigInt(800),
      diff: BigInt(300),
    });
  });
  it('supply cap constraint, enough space in 2nd vault', () => {
    const vaultDetails = {
      '0x1': {
        ...defaultVaultProps,
        vault: '0x1',
        supplyAPY: 0.1,
        rewardAPY: 0.1,
        supplyCap: BigInt(6300),
        cash: BigInt(3000),
        totalBorrows: BigInt(3000),
      },
      '0x2': {
        ...defaultVaultProps,
        vault: '0x2',
        supplyAPY: 0.2,
        rewardAPY: 0.2,
        supplyCap: BigInt(10200),
        cash: BigInt(9000),
        totalBorrows: BigInt(1000),
      },
    };
    const strategyAmounts = {
      [zeroAddress]: BigInt(400),
      '0x1': BigInt(300),
      '0x2': BigInt(500),
    };
    const allocatableAmount = BigInt(1100);
    const cashAmount = BigInt(100);

    const allocations = computeGreedyInitAlloc({
      vaultDetails,
      strategyAmounts,
      allocatableAmount,
      cashAmount,
    });
    expect(allocations[zeroAddress]).toStrictEqual({
      oldAmount: BigInt(400),
      newAmount: BigInt(100),
      diff: BigInt(-300),
    });
    expect(allocations['0x1']).toStrictEqual({
      oldAmount: BigInt(300),
      newAmount: BigInt(400),
      diff: BigInt(100),
    });
    expect(allocations['0x2']).toStrictEqual({
      oldAmount: BigInt(500),
      newAmount: BigInt(700),
      diff: BigInt(200),
    });
  });
  it('supply cap constraint in both vaults', () => {
    const vaultDetails = {
      '0x1': {
        ...defaultVaultProps,
        vault: '0x1',
        supplyAPY: 0.1,
        rewardAPY: 0.1,
        supplyCap: BigInt(6050),
        cash: BigInt(3000),
        totalBorrows: BigInt(3000),
      },
      '0x2': {
        ...defaultVaultProps,
        vault: '0x2',
        supplyAPY: 0.2,
        rewardAPY: 0.2,
        supplyCap: BigInt(10200),
        cash: BigInt(9000),
        totalBorrows: BigInt(1000),
      },
    };
    const strategyAmounts = {
      [zeroAddress]: BigInt(400),
      '0x1': BigInt(300),
      '0x2': BigInt(500),
    };
    const allocatableAmount = BigInt(1100);
    const cashAmount = BigInt(100);

    const allocations = computeGreedyInitAlloc({
      vaultDetails,
      strategyAmounts,
      allocatableAmount,
      cashAmount,
    });
    expect(allocations[zeroAddress]).toStrictEqual({
      oldAmount: BigInt(400),
      newAmount: BigInt(150),
      diff: BigInt(-250),
    });
    expect(allocations['0x1']).toStrictEqual({
      oldAmount: BigInt(300),
      newAmount: BigInt(350),
      diff: BigInt(50),
    });
    expect(allocations['0x2']).toStrictEqual({
      oldAmount: BigInt(500),
      newAmount: BigInt(700),
      diff: BigInt(200),
    });
  });
  it('not enough cash in 2nd vault but enough in 1st to offset', () => {
    const vaultDetails = {
      '0x1': {
        ...defaultVaultProps,
        vault: '0x1',
        supplyAPY: 0.1,
        rewardAPY: 0.1,
        supplyCap: BigInt(6050),
        cash: BigInt(100),
        totalBorrows: BigInt(3000),
      },
      '0x2': {
        ...defaultVaultProps,
        vault: '0x2',
        supplyAPY: 0.2,
        rewardAPY: 0.2,
        supplyCap: BigInt(12000),
        cash: BigInt(9000),
        totalBorrows: BigInt(1000),
      },
    };
    const strategyAmounts = {
      [zeroAddress]: BigInt(100),
      '0x1': BigInt(300),
      '0x2': BigInt(500),
    };
    const allocatableAmount = BigInt(800);
    const cashAmount = BigInt(100);

    const allocations = computeGreedyInitAlloc({
      vaultDetails,
      strategyAmounts,
      allocatableAmount,
      cashAmount,
    });
    expect(allocations[zeroAddress]).toStrictEqual({
      oldAmount: BigInt(100),
      newAmount: BigInt(100),
      diff: BigInt(0),
    });
    expect(allocations['0x1']).toStrictEqual({
      oldAmount: BigInt(300),
      newAmount: BigInt(200),
      diff: BigInt(-100),
    });
    expect(allocations['0x2']).toStrictEqual({
      oldAmount: BigInt(500),
      newAmount: BigInt(600),
      diff: BigInt(100),
    });
  });
  it('not enough cash in both vaults, cashAmount is decreased', () => {
    const vaultDetails = {
      '0x1': {
        ...defaultVaultProps,
        vault: '0x1',
        supplyAPY: 0.1,
        rewardAPY: 0.1,
        supplyCap: BigInt(6050),
        cash: BigInt(100),
        totalBorrows: BigInt(3000),
      },
      '0x2': {
        ...defaultVaultProps,
        vault: '0x2',
        supplyAPY: 0.2,
        rewardAPY: 0.2,
        supplyCap: BigInt(12000),
        cash: BigInt(9000),
        totalBorrows: BigInt(1000),
      },
    };
    const strategyAmounts = {
      [zeroAddress]: BigInt(30),
      '0x1': BigInt(300),
      '0x2': BigInt(500),
    };
    const allocatableAmount = BigInt(680);
    const cashAmount = BigInt(150);

    const allocations = computeGreedyInitAlloc({
      vaultDetails,
      strategyAmounts,
      allocatableAmount,
      cashAmount,
    });
    expect(allocations[zeroAddress]).toStrictEqual({
      oldAmount: BigInt(30),
      newAmount: BigInt(130),
      diff: BigInt(100),
    });
    expect(allocations['0x1']).toStrictEqual({
      oldAmount: BigInt(300),
      newAmount: BigInt(200),
      diff: BigInt(-100),
    });
    expect(allocations['0x2']).toStrictEqual({
      oldAmount: BigInt(500),
      newAmount: BigInt(500),
      diff: BigInt(0),
    });
  });
});
