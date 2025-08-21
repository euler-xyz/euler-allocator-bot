import { protocolSchema } from '../../../src/types/types';
import {
  checkAllocationDiff,
  checkStrategyAmountsDiff,
  checkVaultDetailsDiff,
} from '../../../src/utils/common/checkSnapshotDiff';

describe('checkSnapshotDiff', () => {
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
    supplyCap: BigInt(0),
    irmConfig: {
      type: 'irm' as const,
      baseRate: BigInt(0),
      kink: BigInt(0),
      slope1: BigInt(0),
      slope2: BigInt(0),
    },
  };

  describe('checkVaultDetailsDiff', () => {
    it('case - returns false', () => {
      const vaultDetails = {
        '0x1': {
          ...defaultVaultProps,
          supplyAPY: 1.3,
        },
        '0x2': {
          ...defaultVaultProps,
          supplyAPY: 2.5,
        },
      };
      const newVaultDetails = {
        '0x1': {
          ...defaultVaultProps,
          supplyAPY: 1.8,
        },
        '0x2': {
          ...defaultVaultProps,
          supplyAPY: 2.1,
        },
      };
      const tolerance = 0.8;

      const result = checkVaultDetailsDiff({
        vaultDetails,
        newVaultDetails,
        tolerance,
      });
      expect(result).toBe(false);
    });
    it('case - returns true', () => {
      const vaultDetails = {
        '0x1': {
          ...defaultVaultProps,
          supplyAPY: 1.7,
        },
        '0x2': {
          ...defaultVaultProps,
          supplyAPY: 2.5,
        },
      };
      const newVaultDetails = {
        '0x1': {
          ...defaultVaultProps,
          supplyAPY: 1.8,
        },
        '0x2': {
          ...defaultVaultProps,
          supplyAPY: 1.5,
        },
      };
      const tolerance = 0.8;

      const result = checkVaultDetailsDiff({
        vaultDetails,
        newVaultDetails,
        tolerance,
      });
      expect(result).toBe(true);
    });
  });

  describe('checkStrategyAmountsDiff', () => {
    const assetDecimals = 6;
    it('case - returns false', () => {
      const strategyAmounts = {
        '0x1': BigInt(900 * 1e6),
        '0x2': BigInt(2000 * 1e6),
      };
      const newStrategyAmounts = {
        '0x1': BigInt(1000 * 1e6),
        '0x2': BigInt(2100 * 1e6),
      };
      const tolerance = 0.12;

      const result = checkStrategyAmountsDiff({
        assetDecimals,
        strategyAmounts,
        newStrategyAmounts,
        tolerance,
      });
      expect(result).toBe(false);
    });
    it('case - returns true', () => {
      const strategyAmounts = {
        '0x1': BigInt(900 * 1e6),
        '0x2': BigInt(2000 * 1e6),
      };
      const newStrategyAmounts = {
        '0x1': BigInt(1000 * 1e6),
        '0x2': BigInt(2100 * 1e6),
      };
      const tolerance = 0.1;

      const result = checkStrategyAmountsDiff({
        assetDecimals,
        strategyAmounts,
        newStrategyAmounts,
        tolerance,
      });
      expect(result).toBe(true);
    });
  });

  describe('checkAllocationDiff', () => {
    const assetDecimals = 6;
    it('case - returns false', () => {
      const allocation = {
        '0x1': {
          oldAmount: BigInt(900 * 1e6),
          newAmount: BigInt(1000 * 1e6),
          diff: BigInt(100 * 1e6),
        },
        '0x2': {
          oldAmount: BigInt(2000 * 1e6),
          newAmount: BigInt(1900 * 1e6),
          diff: BigInt(-100 * 1e6),
        },
      };
      const tolerance = 0.12;

      const result = checkAllocationDiff({
        assetDecimals,
        allocation,
        tolerance,
      });
      expect(result).toBe(true);
    });
    it('case - returns true', () => {
      const allocation = {
        '0x1': {
          oldAmount: BigInt(900 * 1e6),
          newAmount: BigInt(1000 * 1e6),
          diff: BigInt(100 * 1e6),
        },
        '0x2': {
          oldAmount: BigInt(2000 * 1e6),
          newAmount: BigInt(1900 * 1e6),
          diff: BigInt(-100 * 1e6),
        },
      };
      const tolerance = 0.1;

      const result = checkAllocationDiff({
        assetDecimals,
        allocation,
        tolerance,
      });
      expect(result).toBe(false);
    });
  });
});
