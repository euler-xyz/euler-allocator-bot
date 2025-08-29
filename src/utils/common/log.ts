import pino from "pino"
import { Allocation, ReturnsDetails, RunLog } from '@/types/types';

export const logger = pino(process.env.NODE_ENV === "dev" ? {
  transport: {
    target: 'pino-pretty',
  },
}: undefined)

export function getRunLog(
  currentAllocation: Allocation,
  currentReturns: number,
  currentReturnsDetails: ReturnsDetails,
  finalAllocation: Allocation,
  finalReturns: number,
  finalReturnsDetails: ReturnsDetails,
  allocatableAmount: bigint,
  cashAmount: bigint,
): RunLog {
  return {
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
    }
  };
}
