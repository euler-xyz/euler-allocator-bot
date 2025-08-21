import { zeroAddress } from 'viem';
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

jest.mock('../../../src/utils/greedyStrategy/computeGreedyReturns', () => ({
  computeGreedyReturns: jest.fn(() => 8),
}));

describe('computeGreedySimAnnealing', () => {
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

  describe('neighbour generation', () => {
    beforeEach(() => {
      jest.spyOn(Math, 'random').mockReturnValue(0.4);
    });
    afterEach(() => {
      jest.spyOn(Math, 'random').mockRestore();
    });

    it('case - no constraints', () => {
      const temperature = 1;
      const vaultDetails = {
        '0x1': {
          ...defaultVaultProps,
          vault: '0x1',
          cash: BigInt(3000),
        },
        '0x2': {
          ...defaultVaultProps,
          vault: '0x2',
          supplyCap: BigInt(15000),
          cash: BigInt(9000),
          totalBorrows: BigInt(1000),
        },
      };
      const currentAllocation = {
        [zeroAddress]: {
          newAmount: BigInt(0),
          oldAmount: BigInt(0),
          diff: BigInt(0),
        },
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

      const newAllocation = generateNeighbor(currentAllocation, vaultDetails, temperature);
      expect(newAllocation).toEqual({
        [zeroAddress]: {
          newAmount: BigInt(0),
          oldAmount: BigInt(0),
          diff: BigInt(0),
        },
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
      });
    });
    it('case - withdrawal constraint', () => {
      const temperature = 1;
      const vaultDetails = {
        '0x1': {
          ...defaultVaultProps,
          vault: '0x1',
          cash: BigInt(150),
        },
        '0x2': {
          ...defaultVaultProps,
          vault: '0x2',
          supplyCap: BigInt(15000),
          cash: BigInt(9000),
          totalBorrows: BigInt(1000),
        },
      };
      const currentAllocation = {
        [zeroAddress]: {
          newAmount: BigInt(0),
          oldAmount: BigInt(0),
          diff: BigInt(0),
        },
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

      const newAllocation = generateNeighbor(currentAllocation, vaultDetails, temperature);
      expect(newAllocation).toEqual({
        [zeroAddress]: {
          newAmount: BigInt(0),
          oldAmount: BigInt(0),
          diff: BigInt(0),
        },
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
      });
    });
    it('case - deposit constraint', () => {
      const temperature = 1;
      const vaultDetails = {
        '0x1': {
          ...defaultVaultProps,
          vault: '0x1',
          cash: BigInt(3000),
        },
        '0x2': {
          ...defaultVaultProps,
          vault: '0x2',
          supplyCap: BigInt(15000),
          cash: BigInt(9000),
          totalBorrows: BigInt(5800),
        },
      };
      const currentAllocation = {
        [zeroAddress]: {
          newAmount: BigInt(0),
          oldAmount: BigInt(0),
          diff: BigInt(0),
        },
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

      const newAllocation = generateNeighbor(currentAllocation, vaultDetails, temperature);
      expect(newAllocation).toEqual({
        [zeroAddress]: {
          newAmount: BigInt(0),
          oldAmount: BigInt(0),
          diff: BigInt(0),
        },
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
      });
    });
  });

  describe('main function', () => {
    const assetDecimals = 6;
    const vaultDetails = {
      '0x1': {
        ...defaultVaultProps,
        vault: '0x1',
        cash: BigInt(3000),
      },
      '0x2': {
        ...defaultVaultProps,
        vault: '0x2',
        supplyCap: BigInt(15000),
        cash: BigInt(9000),
        totalBorrows: BigInt(1000),
      },
    };
    const initialAllocation = {
      [zeroAddress]: {
        newAmount: BigInt(0),
        oldAmount: BigInt(0),
        diff: BigInt(0),
      },
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

    it('case - new proposition is lower, random chance gets rejected', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.4);

      const [bestAllocation, bestReturns] = computeGreedySimAnnealing({
        assetDecimals,
        vaultDetails,
        initialAllocation,
        initialReturns: 10,
      });
      expect(bestAllocation).toEqual(initialAllocation);
      expect(bestReturns).toEqual(10);
    });
    it('case - new proposition is lower, random chance gets accepted, not better than best', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.1);

      const [bestAllocation, bestReturns] = computeGreedySimAnnealing({
        assetDecimals,
        vaultDetails,
        initialAllocation,
        initialReturns: 9,
      });
      expect(bestAllocation).toEqual(initialAllocation);
      expect(bestReturns).toEqual(9);
    });
    it('case - new proposition is higher, better than best', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.4);

      const [bestAllocation, bestReturns] = computeGreedySimAnnealing({
        assetDecimals,
        vaultDetails,
        initialAllocation,
        initialReturns: 6,
      });
      expect(bestAllocation).toEqual({
        [zeroAddress]: {
          newAmount: BigInt(0),
          oldAmount: BigInt(0),
          diff: BigInt(0),
        },
        '0x1': {
          newAmount: BigInt(672),
          oldAmount: BigInt(500),
          diff: BigInt(172),
        },
        '0x2': {
          newAmount: BigInt(278),
          oldAmount: BigInt(300),
          diff: BigInt(-22),
        },
      });
      expect(bestReturns).toEqual(8);
    });
  });
});
