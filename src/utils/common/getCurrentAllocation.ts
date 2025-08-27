import { Allocation, EulerEarn } from '@/types/types';

export function getCurrentAllocation(vault: EulerEarn): Allocation {
  return Object.fromEntries(
    Object.entries(vault.strategies).map(([vault, { allocation }]) => [
      vault,
      { oldAmount: allocation, newAmount: allocation, diff: 0n },
    ]),
  );
}
