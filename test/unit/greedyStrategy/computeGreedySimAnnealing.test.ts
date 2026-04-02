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

  const buildReturnsDetails = (value: number, addresses: Address[]) =>
    buildReturns(value, addresses).details;

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

      const newAllocation = generateNeighbor(
        vault,
        currentAllocation,
        buildReturnsDetails(0, Object.keys(strategyDetails) as Address[]),
        temperature,
      );
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

      const newAllocation = generateNeighbor(
        vault,
        currentAllocation,
        buildReturnsDetails(0, Object.keys(strategyDetails) as Address[]),
        temperature,
      );
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

      const newAllocation = generateNeighbor(
        vault,
        currentAllocation,
        buildReturnsDetails(0, Object.keys(strategyDetails) as Address[]),
        temperature,
      );
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

    it('ignores destination soft cap max while fixing over-utilization', () => {
      const prevMaxUtilization = process.env.MAX_UTILIZATION;
      const prevSoftCaps = process.env.SOFT_CAPS;
      const sourceAddress = '0x0000000000000000000000000000000000000001' as Address;
      const destAddress = '0x0000000000000000000000000000000000000002' as Address;

      process.env.MAX_UTILIZATION = '0.9';
      process.env.SOFT_CAPS = `${destAddress}:1:1`;

      try {
        jest.isolateModules(() => {
          const {
            generateNeighbor: isolatedGenerateNeighbor,
          } = require('../../../src/utils/greedyStrategy/computeGreedySimAnnealing');

          const temperature = 1;
          const strategyDetails = {
            [sourceAddress]: {
              ...defaultVaultProps,
              vault: sourceAddress,
              cash: 3000n,
            },
            [destAddress]: {
              ...defaultVaultProps,
              vault: destAddress,
              supplyCap: 15000n,
              cash: 9000n,
              totalBorrows: 1000n,
            },
          };
          const vault = buildVault(strategyDetails);
          const currentAllocation = {
            [sourceAddress]: {
              newAmount: 700n,
              oldAmount: 500n,
              diff: 200n,
            },
            [destAddress]: {
              newAmount: 400n,
              oldAmount: 300n,
              diff: 100n,
            },
          };
          const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.4);

          const newAllocation = isolatedGenerateNeighbor(
            vault,
            currentAllocation,
            {
              [sourceAddress]: { interestAPY: 0, rewardsAPY: 0, utilization: 0.1 },
              [destAddress]: { interestAPY: 0, rewardsAPY: 0, utilization: 0.95 },
            },
            temperature,
          );

          expect(stringifyAllocation(newAllocation)).toEqual(
            stringifyAllocation({
              [sourceAddress]: {
                newAmount: 420n,
                oldAmount: 500n,
                diff: -80n,
              },
              [destAddress]: {
                newAmount: 680n,
                oldAmount: 300n,
                diff: 380n,
              },
            }),
          );
          randomSpy.mockRestore();
        });
      } finally {
        process.env.MAX_UTILIZATION = prevMaxUtilization;
        process.env.SOFT_CAPS = prevSoftCaps;
      }
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

  describe('protected reallocation sources', () => {
    const protectedStrategy = '0x1000000000000000000000000000000000000001' as Address;
    const recipientStrategy = '0x2000000000000000000000000000000000000002' as Address;
    const idleStrategy = '0x3000000000000000000000000000000000000003' as Address;

    const strategyDetails = {
      [protectedStrategy]: {
        ...defaultVaultProps,
        vault: protectedStrategy,
        cash: 3000n,
        supplyCap: 15000n,
      },
      [recipientStrategy]: {
        ...defaultVaultProps,
        vault: recipientStrategy,
        supplyCap: 15000n,
        cash: 9000n,
        totalBorrows: 1000n,
      },
      [idleStrategy]: {
        ...defaultVaultProps,
        vault: idleStrategy,
        cash: 4000n,
        supplyCap: 20000n,
      },
    };

    const initialAllocation = {
      [protectedStrategy]: {
        newAmount: 700n,
        oldAmount: 700n,
        diff: 0n,
      },
      [recipientStrategy]: {
        newAmount: 250n,
        oldAmount: 250n,
        diff: 0n,
      },
      [idleStrategy]: {
        newAmount: 500n,
        oldAmount: 500n,
        diff: 0n,
      },
    };

    beforeEach(() => {
      jest.resetModules();
      process.env.NO_REALLOCATION_FROM = protectedStrategy;
    });

    afterEach(() => {
      delete process.env.NO_REALLOCATION_FROM;
    });

    it('does not pick a protected strategy as the source vault', () => {
      jest.isolateModules(() => {
        const {
          generateNeighbor: isolatedGenerateNeighbor,
        } = require('../../../src/utils/greedyStrategy/computeGreedySimAnnealing');

        const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.4);
        try {
          const vault = {
            ...buildVault(strategyDetails),
            idleVaultAddress: idleStrategy,
            initialAllocationQueue: [protectedStrategy, recipientStrategy, idleStrategy],
          };
          const newAllocation = isolatedGenerateNeighbor(
            vault,
            initialAllocation,
            buildReturnsDetails(0, Object.keys(strategyDetails) as Address[]),
            1,
          );

          expect(newAllocation[protectedStrategy].newAmount).toBe(800n);
          expect(newAllocation[protectedStrategy].diff).toBe(100n);
          expect(newAllocation[recipientStrategy].newAmount).toBeLessThan(
            initialAllocation[recipientStrategy].newAmount,
          );
        } finally {
          randomSpy.mockRestore();
        }
      });
    });

    it('rejects allocations that withdraw from a protected strategy', () => {
      jest.isolateModules(() => {
        const {
          isAllocationAllowed: isolatedIsAllocationAllowed,
        } = require('../../../src/utils/greedyStrategy/computeGreedySimAnnealing');

        const vault = {
          ...buildVault(strategyDetails),
          idleVaultAddress: idleStrategy,
          initialAllocationQueue: [protectedStrategy, recipientStrategy, idleStrategy],
        };
        const returnsDetails = buildReturnsDetails(0, Object.keys(strategyDetails) as Address[]);
        const newAllocation = {
          ...initialAllocation,
          [protectedStrategy]: {
            ...initialAllocation[protectedStrategy],
            newAmount: 600n,
            diff: -100n,
          },
          [recipientStrategy]: {
            ...initialAllocation[recipientStrategy],
            newAmount: 350n,
            diff: 100n,
          },
        };

        expect(
          isolatedIsAllocationAllowed(
            vault,
            initialAllocation,
            returnsDetails,
            newAllocation,
            returnsDetails,
          ),
        ).toBe(false);
      });
    });
  });
});
