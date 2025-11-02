import { Allocation, ReturnsDetails, RunLog } from '@/types/types';
import pino from 'pino';

export const logger = pino(
  process.env.NODE_ENV === 'dev'
    ? {
        transport: {
          target: 'pino-pretty',
        },
      }
    : undefined,
);

export function getRunLog(
  currentAllocation: Allocation,
  currentReturns: number,
  currentReturnsDetails: ReturnsDetails,
  finalAllocation: Allocation,
  finalReturns: number,
  finalReturnsDetails: ReturnsDetails,
  allocatableAmount: bigint,
  cashAmount: bigint,
  mode: RunLog['mode'],
  spreadSummary?: RunLog['spreadSummary'],
  metadata?: RunLog['metadata'],
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
    },
    mode,
    spreadSummary,
    metadata,
  };
}
