import { Address, zeroAddress } from 'viem';
import ENV from '../../../src/constants/constants';
import { protocolSchema } from '../../../src/types/types';
import { computeUnifiedApyAllocation } from '../../../src/utils/greedyStrategy/computeUnifiedApyAllocation';

jest.mock('../../../src/constants/constants', () => ({
  __esModule: true,
  default: {
    SOFT_CAPS: {},
    MAX_STRATEGY_APY_DIFF: 0,
    MAX_UTILIZATION: 0,
  },
}));

const computeGreedyReturnsMock = jest.fn();

jest.mock('../../../src/utils/greedyStrategy/computeGreedyReturns', () => ({
  computeGreedyReturns: (...args: unknown[]) => computeGreedyReturnsMock(...args),
}));

const baseStrategyDetails = {
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

const strategies = {
  low: '0x0000000000000000000000000000000000000001' as Address,
  high: '0x0000000000000000000000000000000000000002' as Address,
};

const baseApy: Record<Address, number> = {
  [strategies.low]: 4,
  [strategies.high]: 9,
};

const slope: Record<Address, number> = {
  [strategies.low]: 0.002,
  [strategies.high]: 0.004,
};

const buildVault = (allowedStrategies: Address[] = [strategies.low, strategies.high]) => ({
  strategies: {
    [strategies.low]: {
      cap: 10_000n,
      protocol: protocolSchema.Enum.euler,
      allocation: 500n,
      details: {
        ...baseStrategyDetails,
        vault: strategies.low,
        cash: 2_000n,
        totalBorrows: 500n,
        supplyCap: 12_000n,
      },
    },
    [strategies.high]: {
      cap: 10_000n,
      protocol: protocolSchema.Enum.euler,
      allocation: 500n,
      details: {
        ...baseStrategyDetails,
        vault: strategies.high,
        cash: 2_000n,
        totalBorrows: 500n,
        supplyCap: 12_000n,
      },
    },
  },
  idleVaultAddress: zeroAddress,
  assetDecimals: 6,
  initialAllocationQueue: allowedStrategies,
});

const apyForAllocation = (address: Address, amount: bigint) =>
  Math.max(0, baseApy[address] - slope[address] * Number(amount));

beforeEach(() => {
  computeGreedyReturnsMock.mockImplementation(
    ({ allocation }: { allocation: Record<string, { newAmount: bigint }> }) => {
      let totalAmount = 0;
      let weightedReturns = 0;
      const details = Object.fromEntries(
        Object.entries(allocation).map(([strategy, { newAmount }]) => {
          const address = strategy as Address;
          const apy =
            baseApy[address] !== undefined
              ? Math.max(0, baseApy[address] - slope[address] * Number(newAmount))
              : 0;
          const amountNumber = Number(newAmount);
          totalAmount += amountNumber;
          weightedReturns += amountNumber * apy;

          return [
            address,
            {
              interestAPY: apy,
              rewardsAPY: 0,
              utilization: 0.4,
            },
          ];
        }),
      ) as Record<Address, { interestAPY: number; rewardsAPY: number; utilization: number }>;

      const totalReturns = totalAmount > 0 ? weightedReturns / totalAmount : 0;

      return {
        totalReturns,
        details,
      };
    },
  );

  computeGreedyReturnsMock.mockClear();
  ENV.SOFT_CAPS = {};
  ENV.MAX_STRATEGY_APY_DIFF = 0;
});

describe('computeUnifiedApyAllocation', () => {
  it('reduces APY spread by reallocating between strategies', () => {
    const vault = buildVault();
    const initialAllocation = {
      [strategies.low]: {
        oldAmount: 500n,
        newAmount: 500n,
        diff: 0n,
      },
      [strategies.high]: {
        oldAmount: 500n,
        newAmount: 500n,
        diff: 0n,
      },
    };

    const initialSpread =
      apyForAllocation(strategies.high, initialAllocation[strategies.high].newAmount) -
      apyForAllocation(strategies.low, initialAllocation[strategies.low].newAmount);

    const result = computeUnifiedApyAllocation({
      vault,
      initialAllocation,
    });

    expect(result.spread).toBeLessThan(initialSpread);
    expect(Number(result.allocation[strategies.low].newAmount)).toBeLessThan(
      Number(initialAllocation[strategies.low].newAmount),
    );
    expect(Number(result.allocation[strategies.high].newAmount)).toBeGreaterThan(
      Number(initialAllocation[strategies.high].newAmount),
    );

    const totalInitial =
      Number(initialAllocation[strategies.low].newAmount) +
      Number(initialAllocation[strategies.high].newAmount);
    const totalFinal =
      Number(result.allocation[strategies.low].newAmount) +
      Number(result.allocation[strategies.high].newAmount);
    expect(totalFinal).toBe(totalInitial);
  });

  it('stops adjusting when spread is within target threshold', () => {
    const vault = buildVault();
    const initialAllocation = {
      [strategies.low]: {
        oldAmount: 500n,
        newAmount: 500n,
        diff: 0n,
      },
      [strategies.high]: {
        oldAmount: 500n,
        newAmount: 500n,
        diff: 0n,
      },
    };

    const initialSpread =
      apyForAllocation(strategies.high, initialAllocation[strategies.high].newAmount) -
      apyForAllocation(strategies.low, initialAllocation[strategies.low].newAmount);

    ENV.MAX_STRATEGY_APY_DIFF = initialSpread + 1;

    const result = computeUnifiedApyAllocation({
      vault,
      initialAllocation,
    });

    expect(result.spread).toBeCloseTo(initialSpread);
    expect(result.allocation).toEqual(initialAllocation);
  });

  it('respects strategy overrides when smoothing APYs', () => {
    const vault = buildVault([strategies.low]);
    const initialAllocation = {
      [strategies.low]: {
        oldAmount: 500n,
        newAmount: 500n,
        diff: 0n,
      },
      [strategies.high]: {
        oldAmount: 500n,
        newAmount: 500n,
        diff: 0n,
      },
    };

    const result = computeUnifiedApyAllocation({
      vault,
      initialAllocation,
    });

    expect(result.allocation).toEqual(initialAllocation);
    expect(result.spread).toBe(0);
  });
});
