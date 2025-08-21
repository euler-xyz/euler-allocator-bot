import { z } from 'zod';

/**
 * @notice Schema for Euler IRM
 */
export const eulerIrmSchema = z.object({
  type: z.literal('irm'),
  baseRate: z.bigint(),
  kink: z.bigint(),
  slope1: z.bigint(),
  slope2: z.bigint(),
});
export type EulerIrm = z.infer<typeof eulerIrmSchema>;

/**
 * @notice Schema for Euler Adaptive IRM
 */
export const eulerAdaptiveIrmSchema = z.object({
  type: z.literal('adaptiveIrm'),
  rateAtTarget: z.bigint(),
  targetUtilization: z.bigint(),
  initialRateAtTarget: z.bigint(),
  minRateAtTarget: z.bigint(),
  maxRateAtTarget: z.bigint(),
  curveSteepness: z.bigint(),
  adjustmentSpeed: z.bigint(),
});
export type EulerAdaptiveIrm = z.infer<typeof eulerAdaptiveIrmSchema>;

/**
 * @notice Schema for no IRM present (escrow vaults)
 */
export const eulerNoIrmSchema = z.object({
  type: z.literal('noIrm'),
});
export type EulerNoIrm = z.infer<typeof eulerNoIrmSchema>;
