import { AdaptiveIrmAbi } from '@/constants/AdaptiveIrmAbi';
import { eulerAdaptiveIrmSchema, eulerIrmSchema, eulerNoIrmSchema } from '@/types/euler';
import { EvkVaultLensData } from '@/types/types';
import { decodeAbiParameters, type Address, type PublicClient } from 'viem';

const interestRateModelTypes: Record<number, string> = {
  0: 'UNKNOWN',
  1: 'KINK',
  2: 'ADAPTIVE_CURVE',
  3: 'KINKY',
  4: 'FIXED_CYCLICAL_BINARY',
};

/**
 * @notice Gets the interest rate model configuration for an Euler vault
 * @param lensData The data from VaultLens contract
 * @param rpcClient RPC client for reading contract state
 * @returns Interest rate model configuration object matching either eulerIrmSchema or eulerAdaptiveIrmSchema
 * @throws Error if no IRM is found or if both IRM types are found for the same address
 */
export async function getEulerIrmConfig({
  lensData,
  rpcClient,
}: {
  lensData: EvkVaultLensData;
  rpcClient: PublicClient;
}) {
  const type = interestRateModelTypes[lensData.irmInfo.interestRateModelInfo.interestRateModelType];

  if (type === 'KINK') {
    const [baseRate, slope1, slope2, kink] = decodeAbiParameters(
      [
        { name: 'baseRate', type: 'uint' },
        { name: 'slope1', type: 'uint' },
        { name: 'slope2', type: 'uint' },
        { name: 'kink', type: 'uint' },
      ],
      lensData.irmInfo.interestRateModelInfo.interestRateModelParams,
    );
    return eulerIrmSchema.parse({
      type: 'irm',
      baseRate,
      kink,
      slope1,
      slope2,
    });
  } else if (type === 'ADAPTIVE_CURVE') {
    const rateAtTarget = await rpcClient.readContract({
      address: lensData.interestRateModel,
      abi: AdaptiveIrmAbi,
      functionName: 'computeRateAtTargetView',
      args: [lensData.vault, BigInt(0), BigInt(0)], // cash and totalBorrows don't affect the rate at target
    });

    const [
      targetUtilization,
      initialRateAtTarget,
      minRateAtTarget,
      maxRateAtTarget,
      curveSteepness,
      adjustmentSpeed,
    ] = decodeAbiParameters(
      [
        { name: 'targetUtilization', type: 'int' },
        { name: 'initialRateAtTarget', type: 'int' },
        { name: 'minRateAtTarget', type: 'int' },
        { name: 'maxRateAtTarget', type: 'int' },
        { name: 'curveSteepness', type: 'int' },
        { name: 'adjustmentSpeed', type: 'int' },
      ],
      lensData.irmInfo.interestRateModelInfo.interestRateModelParams,
    );

    return eulerAdaptiveIrmSchema.parse({
      type: 'adaptiveIrm',
      rateAtTarget: rateAtTarget / BigInt(1e9),
      targetUtilization,
      initialRateAtTarget,
      minRateAtTarget,
      maxRateAtTarget,
      curveSteepness,
      adjustmentSpeed,
    });
  } else if (type === 'UNKNOWN') {
    return eulerNoIrmSchema.parse({
      type: 'noIrm',
    });
  } else {
    throw new Error('Unknown IRM');
  }
}
