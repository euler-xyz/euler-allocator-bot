import { zeroAddress } from 'viem';
import Allocator from '../../../src/modules/Allocator';
import { Allocation } from '../../../src/types/types';

jest.mock('../../../src/utils/common/onChainHelpers', () => ({
  getTotalAllocationPoints: () => BigInt('300000000000000000000'),
}));

describe('Allocator', () => {
  describe('reallocate', () => {
    const mockAllocator = new Allocator({
      allocationDiffTolerance: 0,
      allocatorPrivateKey: '0x0000000000000000000000000000000000000000000000000000000000000000',
      amountSnapshotTolerance: 0,
      apyTolerance: 0,
      assetContractAddress: zeroAddress,
      assetDecimals: 6,
      cashPercentage: BigInt(100000000000000000),
      chainId: 1,
      earnVaultAddress: zeroAddress,
      evcAddress: zeroAddress,
      strategies: [],
      prismaClient: {} as any,
      rpcClient: {} as any,
    });

    it('case - normal', async () => {
      const finalAllocation: Allocation = {
        [zeroAddress]: {
          oldAmount: BigInt(0 * 1e6),
          newAmount: BigInt(500 * 1e6),
          diff: BigInt(500 * 1e6),
        },
        '0x1': {
          oldAmount: BigInt(0 * 1e6),
          newAmount: BigInt(500 * 1e6),
          diff: BigInt(500 * 1e6),
        },
        '0x2': {
          oldAmount: BigInt(0 * 1e6),
          newAmount: BigInt(500 * 1e6),
          diff: BigInt(500 * 1e6),
        },
      };

      const result = await (mockAllocator as any).reallocate(finalAllocation);
      expect((mockAllocator as any).totalAllocationPoints.toString()).toBe('300000000000000000000');
      expect(result[zeroAddress].toString()).toBe('100000000000000000000');
      expect(result['0x1'].toString()).toBe('100000000000000000000');
      expect(result['0x2'].toString()).toBe('100000000000000000000');
    });
    it('case - underflows so we add to cash strategy', async () => {
      const finalAllocation: Allocation = {
        [zeroAddress]: {
          oldAmount: BigInt(0 * 1e6),
          newAmount: BigInt(500 * 1e6),
          diff: BigInt(500 * 1e6),
        },
        '0x1': {
          oldAmount: BigInt(0 * 1e6),
          newAmount: BigInt(500 * 1e6),
          diff: BigInt(500 * 1e6),
        },
        '0x2': {
          oldAmount: BigInt(0 * 1e6),
          newAmount: BigInt(300 * 1e6),
          diff: BigInt(300 * 1e6),
        },
      };

      const result = await (mockAllocator as any).reallocate(finalAllocation);
      expect((mockAllocator as any).totalAllocationPoints.toString()).toBe('300000000000000000000');
      expect(result[zeroAddress].toString()).toBe('115384615384615384616');
      expect(result['0x1'].toString()).toBe('115384615384615384615');
      expect(result['0x2'].toString()).toBe('69230769230769230769');
    });
  });
});
