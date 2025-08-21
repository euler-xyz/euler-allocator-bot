import {
  computeEulerAdaptiveInterestRate,
  computeEulerInterestRate,
  convertEulerSharesToAssets,
  resolveEulerBorrowAPY,
  resolveEulerSupplyAPY,
  resolveEulerSupplyCap,
} from '../../../src/utils/euler/resolveEulerUnits';

describe('resolveEulerUnits', () => {
  describe('resolveSupplyCap', () => {
    it('case - amountCap = 0', () => {
      const result = resolveEulerSupplyCap(0);
      expect(result.toString()).toBe(
        '115792089237316195423570985008687907853269984665640564039457584007913129639935',
      );
    });
    it('case 1 - amountCap > 0', () => {
      const result = resolveEulerSupplyCap(28813);
      expect(result.toString()).toBe('45000000000000');
    });
    it('case 2 - amountCap > 0', () => {
      const result = resolveEulerSupplyCap(32013);
      expect(result.toString()).toBe('50000000000000');
    });
  });

  describe('resolveBorrowAPY', () => {
    it('case - interestRate = 0', () => {
      const result = resolveEulerBorrowAPY(BigInt(0));
      expect(result).toBe(0);
    });
    it('case 1 - interestRate > 0', () => {
      const result = resolveEulerBorrowAPY(BigInt('5533034129750742200'));
      expect(result).toBeCloseTo(19.07765, 3);
    });
    it('case 2 - interestRate > 0', () => {
      const result = resolveEulerBorrowAPY(BigInt('2290021605521508540'));
      expect(result).toBeCloseTo(7.49413, 3);
    });
  });

  describe('resolveSupplyAPY', () => {
    const defaultVaultProps = {
      assetDecimals: 6,
      borrowAPY: 15,
      cash: BigInt(0),
      interestFee: 0,
      totalBorrows: BigInt(0),
    };
    it('case - utilization = 0', () => {
      const props = {
        ...defaultVaultProps,
      };
      const result = resolveEulerSupplyAPY(props);
      expect(result).toBe(0);
    });
    it('case - utilization > 0, no fees', () => {
      const props = {
        ...defaultVaultProps,
        cash: BigInt('10000000000'),
        totalBorrows: BigInt('10000000000'),
      };
      const result = resolveEulerSupplyAPY(props);
      expect(result).toBe(7.5);
    });
    it('case - utilization > 0, 10% fees', () => {
      const props = {
        ...defaultVaultProps,
        cash: BigInt('10000000000'),
        totalBorrows: BigInt('10000000000'),
        interestFee: 1000,
      };
      const result = resolveEulerSupplyAPY(props);
      expect(result).toBe(6.75);
    });
  });

  describe('convertSharesToAssets', () => {
    it('case - shares = 0', () => {
      const shares = BigInt('1000000000000000000');
      const result = convertEulerSharesToAssets({
        shares,
        cash: BigInt(1000),
        totalBorrows: BigInt(1000),
        totalShares: BigInt(0),
      });
      expect(result.toString()).toBe('1002000000000000000');
    });
    it('case - cash + totalBorrows = 0', () => {
      const shares = BigInt('1000000000000000000');
      const result = convertEulerSharesToAssets({
        shares,
        cash: BigInt(0),
        totalBorrows: BigInt(0),
        totalShares: BigInt(1000),
      });
      expect(result.toString()).toBe('999000999000999000');
    });
    it('case - normal', () => {
      const shares = BigInt('1000000000000000000');
      const result = convertEulerSharesToAssets({
        shares,
        cash: BigInt(1000),
        totalBorrows: BigInt(1000),
        totalShares: BigInt(1000),
      });
      expect(result.toString()).toBe('1000999000999000999');
    });
  });

  describe('computeEulerInterestRate', () => {
    it('case - utilization = 0', () => {
      const result = computeEulerInterestRate({
        cash: BigInt(0),
        totalBorrows: BigInt(0),
        irmConfig: {
          type: 'irm',
          baseRate: BigInt('3020253667084197485'),
          kink: BigInt('3951369912'),
          slope1: BigInt('863158601'),
          slope2: BigInt('45210010787'),
        },
      });
      expect(result.toString()).toBe('3020253667084197485');
    });
    it('case - utilization < kink', () => {
      const result = computeEulerInterestRate({
        cash: BigInt('5151523736830'),
        totalBorrows: BigInt('11838253218233'),
        irmConfig: {
          type: 'irm',
          baseRate: BigInt('3020253667084197485'),
          kink: BigInt('3951369912'),
          slope1: BigInt('863158601'),
          slope2: BigInt('45210010787'),
        },
      });
      expect(result.toString()).toBe('5603408339543631230');
    });
    it('case - utilization > kink', () => {
      const result = computeEulerInterestRate({
        cash: BigInt('1151523736830'),
        totalBorrows: BigInt('11838253218233'),
        irmConfig: {
          type: 'irm',
          baseRate: BigInt('3020253667084197485'),
          kink: BigInt('3951369912'),
          slope1: BigInt('863158601'),
          slope2: BigInt('45210010787'),
        },
      });
      expect(result.toString()).toBe('6398850687830828338');
    });
    it('case - utilization = max utilization', () => {
      const result = computeEulerInterestRate({
        cash: BigInt(0),
        totalBorrows: BigInt('11838253218233'),
        irmConfig: {
          type: 'irm',
          baseRate: BigInt('3020253667084197485'),
          kink: BigInt('3951369912'),
          slope1: BigInt('863158601'),
          slope2: BigInt('45210010787'),
        },
      });
      expect(result.toString()).toBe('21964953984174581018');
    });
  });

  describe('computeEulerAdaptiveInterestRate', () => {
    it('case - utilization = 0', () => {
      const result = computeEulerAdaptiveInterestRate({
        cash: BigInt(0),
        totalBorrows: BigInt(0),
        irmConfig: {
          type: 'adaptiveIrm',
          rateAtTarget: BigInt('634195839'),
          targetUtilization: BigInt('900000000000000000'),
          initialRateAtTarget: BigInt('634195839'),
          minRateAtTarget: BigInt('31709791'),
          maxRateAtTarget: BigInt('63419583967'),
          curveSteepness: BigInt('4000000000000000000'),
          adjustmentSpeed: BigInt('1585489599188'),
        },
      });
      expect(result.toString()).toBe('158548959000000000');
    });
    it('case - utilization < target utilization', () => {
      const result = computeEulerAdaptiveInterestRate({
        cash: BigInt(100 * 1e6),
        totalBorrows: BigInt(100 * 1e6),
        irmConfig: {
          type: 'adaptiveIrm',
          rateAtTarget: BigInt('634195839'),
          targetUtilization: BigInt('900000000000000000'),
          initialRateAtTarget: BigInt('634195839'),
          minRateAtTarget: BigInt('31709791'),
          maxRateAtTarget: BigInt('63419583967'),
          curveSteepness: BigInt('4000000000000000000'),
          adjustmentSpeed: BigInt('1585489599188'),
        },
      });
      expect(result.toString()).toBe('422797226000000000');
    });
    it('case - utilization > target utilization', () => {
      const result = computeEulerAdaptiveInterestRate({
        cash: BigInt(30 * 1e6),
        totalBorrows: BigInt(170 * 1e6),
        irmConfig: {
          type: 'adaptiveIrm',
          rateAtTarget: BigInt('634195839'),
          targetUtilization: BigInt('900000000000000000'),
          initialRateAtTarget: BigInt('634195839'),
          minRateAtTarget: BigInt('31709791'),
          maxRateAtTarget: BigInt('63419583967'),
          curveSteepness: BigInt('4000000000000000000'),
          adjustmentSpeed: BigInt('1585489599188'),
        },
      });
      expect(result.toString()).toBe('607771012000000000');
    });
    it('case - utilization = max utilization', () => {
      const result = computeEulerAdaptiveInterestRate({
        cash: BigInt(0),
        totalBorrows: BigInt(170 * 1e6),
        irmConfig: {
          type: 'adaptiveIrm',
          rateAtTarget: BigInt('634195839'),
          targetUtilization: BigInt('900000000000000000'),
          initialRateAtTarget: BigInt('634195839'),
          minRateAtTarget: BigInt('31709791'),
          maxRateAtTarget: BigInt('63419583967'),
          curveSteepness: BigInt('4000000000000000000'),
          adjustmentSpeed: BigInt('1585489599188'),
        },
      });
      expect(result.toString()).toBe('2536783356000000000');
    });
  });
});
