import { Address, zeroAddress } from 'viem';
import { protocolSchema } from '../../../src/types/types';
import {
  computeGreedySimAnnealing,
  generateNeighbor,
} from '../../../src/utils/greedyStrategy/computeGreedySimAnnealing';

jest.mock('../../../src/constants/annealingConstants', () => ({
  __esModule: true,
  default: {
    INITIAL_TEMP: 0.1,
    MIN_TEMP: 0.001,
    COOLING_RATE: 0.01,
    ITERATIONS_PER_TEMP: 1,
    MIN_ACCEPTANCE_RATE: 0.01,
    MAX_CONSECUTIVE_FAILURES: 1000,
  },
}));

const computeGreedyReturnsMock = jest.fn();

jest.mock('../../../src/utils/greedyStrategy/computeGreedyReturns', () => ({
  computeGreedyReturns: (...args: unknown[]) => computeGreedyReturnsMock(...args),
}));

describe('computeGreedySimAnnealing', () => {
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

  const buildVault = (details: Record<string, typeof defaultVaultProps>) => {
    const addresses = Object.keys(details) as Address[];
    return {
      strategies: Object.fromEntries(
        addresses.map(address => [
          address,
          {
            cap: BigInt(10_000_000),
            protocol: protocolSchema.Enum.euler,
            allocation: BigInt(0),
            details: details[address],
          },
        ]),
      ),
      idleVaultAddress: zeroAddress,
      assetDecimals: 6,
      initialAllocationQueue: addresses,
    };
  };

  const buildReturns = (value: number, addresses: Address[]) => ({
    totalReturns: value,
    details: Object.fromEntries(
      addresses.map(address => [
        address,
        {
          interestAPY: value,
          rewardsAPY: 0,
          utilization: 0.5,
        },
      ]),
    ),
  });

  const stringifyAllocation = (
    allocation: Record<string, { newAmount: bigint; oldAmount: bigint; diff: bigint }>,
  ) =>
    Object.fromEntries(
      Object.entries(allocation).map(([address, values]) => [
        address,
        {
          newAmount: values.newAmount.toString(),
          oldAmount: values.oldAmount.toString(),
          diff: values.diff.toString(),
        },
      ]),
    );

  describe('neighbour generation', () => {
    let randomSpy: jest.SpyInstance<number, []>;

    beforeEach(() => {
      randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.4);
    });

    afterEach(() => {
      randomSpy.mockRestore();
    });

    it('case - no constraints', () => {
      const temperature = 1;
      const strategyDetails = {
        '0x1': {
          ...defaultVaultProps,
          vault: '0x1' as Address,
          cash: BigInt(3000),
        },
        '0x2': {
          ...defaultVaultProps,
          vault: '0x2' as Address,
          supplyCap: BigInt(15000),
          cash: BigInt(9000),
          totalBorrows: BigInt(1000),
        },
      };
      const vault = buildVault(strategyDetails);
      const currentAllocation = {
        '0x1': {
          newAmount: BigInt(700),
          oldAmount: BigInt(500),
          diff: BigInt(200),
        },
        '0x2': {
          newAmount: BigInt(250),
          oldAmount: BigInt(300),
          diff: BigInt(-50),
        },
      };

      const newAllocation = generateNeighbor(vault, currentAllocation, temperature);
      expect(stringifyAllocation(newAllocation)).toEqual(
        stringifyAllocation({
          '0x1': {
            newAmount: BigInt(420),
            oldAmount: BigInt(500),
            diff: BigInt(-80),
          },
          '0x2': {
            newAmount: BigInt(530),
            oldAmount: BigInt(300),
            diff: BigInt(230),
          },
        }),
      );
    });
    it('case - withdrawal constraint', () => {
      const temperature = 1;
      const strategyDetails = {
        '0x1': {
          ...defaultVaultProps,
          vault: '0x1' as Address,
          cash: BigInt(150),
        },
        '0x2': {
          ...defaultVaultProps,
          vault: '0x2' as Address,
          supplyCap: BigInt(15000),
          cash: BigInt(9000),
          totalBorrows: BigInt(1000),
        },
      };
      const vault = buildVault(strategyDetails);
      const currentAllocation = {
        '0x1': {
          newAmount: BigInt(400),
          oldAmount: BigInt(500),
          diff: BigInt(-100),
        },
        '0x2': {
          newAmount: BigInt(300),
          oldAmount: BigInt(300),
          diff: BigInt(0),
        },
      };

      const newAllocation = generateNeighbor(vault, currentAllocation, temperature);
      expect(stringifyAllocation(newAllocation)).toEqual(
        stringifyAllocation({
          '0x1': {
            newAmount: BigInt(380),
            oldAmount: BigInt(500),
            diff: BigInt(-120),
          },
          '0x2': {
            newAmount: BigInt(320),
            oldAmount: BigInt(300),
            diff: BigInt(20),
          },
        }),
      );
    });
    it('case - deposit constraint', () => {
      const temperature = 1;
      const strategyDetails = {
        '0x1': {
          ...defaultVaultProps,
          vault: '0x1' as Address,
          cash: BigInt(3000),
        },
        '0x2': {
          ...defaultVaultProps,
          vault: '0x2' as Address,
          supplyCap: BigInt(15000),
          cash: BigInt(9000),
          totalBorrows: BigInt(5800),
        },
      };
      const vault = buildVault(strategyDetails);
      const currentAllocation = {
        '0x1': {
          newAmount: BigInt(700),
          oldAmount: BigInt(500),
          diff: BigInt(200),
        },
        '0x2': {
          newAmount: BigInt(400),
          oldAmount: BigInt(300),
          diff: BigInt(100),
        },
      };

      const newAllocation = generateNeighbor(vault, currentAllocation, temperature);
      expect(stringifyAllocation(newAllocation)).toEqual(
        stringifyAllocation({
          '0x1': {
            newAmount: BigInt(660),
            oldAmount: BigInt(500),
            diff: BigInt(160),
          },
          '0x2': {
            newAmount: BigInt(440),
            oldAmount: BigInt(300),
            diff: BigInt(140),
          },
        }),
      );
    });
  });

  describe('main function', () => {
    let randomSpy: jest.SpyInstance<number, []>;
    const strategyDetails = {
      '0x1': {
        ...defaultVaultProps,
        vault: '0x1' as Address,
        cash: BigInt(3000),
      },
      '0x2': {
        ...defaultVaultProps,
        vault: '0x2' as Address,
        supplyCap: BigInt(15000),
        cash: BigInt(9000),
        totalBorrows: BigInt(1000),
      },
    };
    const vault = buildVault(strategyDetails);
    const addresses = Object.keys(strategyDetails) as Address[];
    const initialAllocation = {
      '0x1': {
        newAmount: BigInt(700),
        oldAmount: BigInt(500),
        diff: BigInt(200),
      },
      '0x2': {
        newAmount: BigInt(250),
        oldAmount: BigInt(300),
        diff: BigInt(-50),
      },
    };

    beforeEach(() => {
      computeGreedyReturnsMock.mockReset();
      randomSpy = jest.spyOn(Math, 'random');
    });

    afterEach(() => {
      randomSpy.mockRestore();
    });

    it('rejects worse allocations when random threshold is high', () => {
      randomSpy.mockReturnValue(0.4);

      computeGreedyReturnsMock
        .mockReturnValueOnce(buildReturns(10, addresses))
        .mockReturnValueOnce(buildReturns(9, addresses));

      const [bestAllocation, bestReturns] = computeGreedySimAnnealing({
        vault,
        initialAllocation,
      });

      expect(stringifyAllocation(bestAllocation)).toEqual(stringifyAllocation(initialAllocation));
      expect(bestReturns).toBe(10);
    });

    it('accepts worse allocations when random threshold is low but keeps best', () => {
      randomSpy.mockReturnValue(0.0);

      computeGreedyReturnsMock
        .mockReturnValueOnce(buildReturns(10, addresses))
        .mockReturnValueOnce(buildReturns(9, addresses));

      const [bestAllocation, bestReturns] = computeGreedySimAnnealing({
        vault,
        initialAllocation,
      });

      expect(stringifyAllocation(bestAllocation)).toEqual(stringifyAllocation(initialAllocation));
      expect(bestReturns).toBe(10);
    });

    it('updates best allocation when returns improve', () => {
      randomSpy.mockReturnValue(0.0);

      computeGreedyReturnsMock
        .mockReturnValueOnce(buildReturns(8, addresses))
        .mockReturnValueOnce(buildReturns(9, addresses));

      const [bestAllocation, bestReturns] = computeGreedySimAnnealing({
        vault,
        initialAllocation,
      });

      expect(bestReturns).toBe(9);
    });
  });
});
