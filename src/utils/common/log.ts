import { Allocation, ReturnsDetails } from '@/types/types';

export function logRun(
  currentAllocation: Allocation,
  currentReturns: number,
  currentReturnsDetails: ReturnsDetails,
  finalAllocation: Allocation,
  finalReturns: number,
  finalReturnsDetails: ReturnsDetails,
  allocatableAmount: bigint,
  cashAmount: bigint,
) {
  console.log({
    current: {
      allocation: currentAllocation,
      returnsTotal: currentReturns,
      returnsStrategies: currentReturnsDetails,
    },
    allocationAmount: allocatableAmount,
    cashAmount: cashAmount,
    new: {
      allocation: finalAllocation,
      returnsTotal: finalReturns,
      returnsDetails: finalReturnsDetails,
    },
  });
}
