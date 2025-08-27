import { Allocation } from '@/types/types';
import { maxUint256 } from 'viem';
import { parseContractAddress } from './parser';

export function calculateEulerEarnAllocations(allocation: Allocation) {
  // withdrawals must come first
  const sorted = Object.entries(allocation).sort(([_, a], [__, b]) => {
    return a.diff < b.diff ? -1 : 1;
  });

  return sorted.map(([strategy, { newAmount }], index, array) => ({
    id: parseContractAddress(strategy),
    // the last deposit should be maxUint to deposit any extra withdrawn
    assets: index === array.length - 1 ? maxUint256 : newAmount,
  }));
}
