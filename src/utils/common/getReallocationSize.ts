import { Allocation } from '@/types/types';

export function getTotalLiquidity(allocation: Allocation) {
  return Object.values(allocation).reduce((total, { oldAmount }) => total + oldAmount, 0n);
}

export function getReallocatedLiquidity(allocation: Allocation) {
  return Object.values(allocation).reduce(
    (total, { diff }) => (diff > 0n ? total + diff : total),
    0n,
  );
}

export function meetsMinReallocationPercentage({
  allocation,
  minReallocationPercentage,
}: {
  allocation: Allocation;
  minReallocationPercentage: number;
}) {
  if (!minReallocationPercentage) return true;

  const totalLiquidity = getTotalLiquidity(allocation);
  if (totalLiquidity === 0n) return false;

  const PERCENTAGE_SCALE = 1_000_000n;
  const minReallocation = BigInt(Math.round(minReallocationPercentage * Number(PERCENTAGE_SCALE)));

  return getReallocatedLiquidity(allocation) * PERCENTAGE_SCALE >= totalLiquidity * minReallocation;
}
