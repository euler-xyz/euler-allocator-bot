import {
  getReallocatedLiquidity,
  getTotalLiquidity,
  meetsMinReallocationPercentage,
} from '../../../src/utils/common/getReallocationSize';

describe('getReallocationSize', () => {
  const allocation = {
    '0x1': {
      oldAmount: 600n,
      newAmount: 550n,
      diff: -50n,
    },
    '0x2': {
      oldAmount: 300n,
      newAmount: 350n,
      diff: 50n,
    },
    '0x3': {
      oldAmount: 100n,
      newAmount: 100n,
      diff: 0n,
    },
  };

  it('computes total liquidity from the pre-rebalance allocation', () => {
    expect(getTotalLiquidity(allocation)).toBe(1_000n);
  });

  it('computes moved liquidity as the deposited side of the rebalance', () => {
    expect(getReallocatedLiquidity(allocation)).toBe(50n);
  });

  it('aborts when moved liquidity is below the configured minimum percentage', () => {
    expect(
      meetsMinReallocationPercentage({
        allocation,
        minReallocationPercentage: 0.06,
      }),
    ).toBe(false);
  });

  it('allows execution when moved liquidity meets the configured minimum percentage', () => {
    expect(
      meetsMinReallocationPercentage({
        allocation,
        minReallocationPercentage: 0.05,
      }),
    ).toBe(true);
  });
});
