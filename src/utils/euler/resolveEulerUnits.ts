import { EulerNoIrm, type EulerAdaptiveIrm, type EulerIrm } from '@/types/euler';
import { parseBigIntToNumberWithScale } from '@/utils/common/parser';

/** From EVK contract */
const WAD = BigInt(10) ** BigInt(18);
const SECONDS_PER_YEAR = 365.2425 * 86400;
const VIRTUAL_DEPOSIT_AMOUNT = BigInt(1e6);
const RAY = 10n ** 27n;

/**
 * @notice Resolves the supply cap from Euler's compact uint format to a token amount
 * @param amountCap The supply cap in Euler's compact uint format
 * @returns The supply cap as a bigint, or max uint256 if amountCap is 0
 */
export function resolveEulerSupplyCap(amountCap: number) {
  if (amountCap === 0) return BigInt(2) ** BigInt(256) - BigInt(1);

  const exponent = BigInt(amountCap) & BigInt(63);
  const mantissa = BigInt(amountCap) >> BigInt(6);

  return (BigInt(10) ** exponent * mantissa) / BigInt(100);
}

/**
 * @notice Calculates the annual borrow APY from an interest rate
 * @dev Uses continuous compounding formula: APY = (e^(rate * time) - 1) * 100
 * @param interestRate The per-second interest rate scaled by 1e27
 * @returns The borrow APY as a percentage
 */
export function resolveEulerBorrowAPY(interestRate: bigint) {
  if (interestRate === BigInt(0)) return 0;

  const rateTimesYear = interestRate * BigInt(Math.floor(SECONDS_PER_YEAR));
  const p = parseBigIntToNumberWithScale(rateTimesYear, 27);

  return (Math.exp(p) - 1) * 100;
}

/**
 * @notice Calculates the supply APY based on borrow APY and utilization
 * @dev Supply APY = Borrow APY * (1 - fee) * utilization
 * @param assetDecimals The decimal precision of the asset
 * @param borrowAPY The current borrow APY as a percentage
 * @param cash The amount of unused tokens in the vault
 * @param interestFee The interest fee percentage taken
 * @param totalBorrows The total amount of borrowed tokens
 * @returns The supply APY as a percentage
 */
export function resolveEulerSupplyAPY({
  assetDecimals,
  borrowAPY,
  cash,
  interestFee,
  totalBorrows,
}: {
  assetDecimals: number;
  borrowAPY: number;
  cash: bigint;
  interestFee: number;
  totalBorrows: bigint;
}) {
  const scaledCash = parseBigIntToNumberWithScale(cash, assetDecimals);
  const scaledTotalBorrows = parseBigIntToNumberWithScale(totalBorrows, assetDecimals);
  const utilization = scaledTotalBorrows / (scaledTotalBorrows + scaledCash);
  if (!Number.isFinite(utilization)) return 0;

  return borrowAPY * (1 - interestFee / 1e4) * utilization;
}

/**
 * @notice Converts vault shares to underlying asset amount
 * @dev Uses the formula: assets = shares * (cash + borrows + virtual) / (totalShares + virtual)
 * @param shares The number of vault shares to convert
 * @param cash The amount of unused tokens in the vault
 * @param totalBorrows The total amount of borrowed tokens
 * @param totalShares The total number of shares in the vault
 * @returns The equivalent amount of underlying assets
 */
export function convertEulerSharesToAssets({
  shares,
  cash,
  totalBorrows,
  totalShares,
}: {
  shares: bigint;
  cash: bigint;
  totalBorrows: bigint;
  totalShares: bigint;
}) {
  return (
    (shares * (cash + totalBorrows + VIRTUAL_DEPOSIT_AMOUNT)) /
    (totalShares + VIRTUAL_DEPOSIT_AMOUNT)
  );
}

/**
 * @notice Computes the interest rate based on utilization and kink parameters
 * @dev Implementation is 1:1 with IRM contracts
 * @param cash The amount of unused tokens in the vault
 * @param totalBorrows The total amount of borrowed tokens
 * @param irmConfig The interest rate model configuration
 * @returns The per-second interest rate scaled by 1e27
 */
export function computeEulerInterestRate({
  cash,
  totalBorrows,
  irmConfig,
}: {
  cash: bigint;
  totalBorrows: bigint;
  irmConfig: EulerIrm;
}) {
  const totalAssets = cash + totalBorrows;

  const utilization = totalAssets
    ? (totalBorrows * (BigInt(2) ** BigInt(32) - BigInt(1))) / totalAssets
    : BigInt(0);

  let interestRate = irmConfig.baseRate;
  if (utilization <= irmConfig.kink) {
    interestRate += utilization * irmConfig.slope1;
  } else {
    interestRate += irmConfig.kink * irmConfig.slope1;
    const utilizationOverKink = utilization - irmConfig.kink;
    interestRate += irmConfig.slope2 * utilizationOverKink;
  }

  return interestRate;
}

/**
 * @notice Computes the interest rate for Euler's adaptive interest rate model
 * @dev Implementation is 1:1 with Adaptive IRM contracts
 * @param cash The amount of unused tokens in the vault
 * @param totalBorrows The total amount of borrowed tokens
 * @param irmConfig The adaptive interest rate model configuration
 * @returns The per-second interest rate scaled by 1e27
 */
export function computeEulerAdaptiveInterestRate({
  cash,
  totalBorrows,
  irmConfig,
}: {
  cash: bigint;
  totalBorrows: bigint;
  irmConfig: EulerAdaptiveIrm;
}) {
  const totalAssets = cash + totalBorrows;
  const utilization = totalAssets === BigInt(0) ? BigInt(0) : (totalBorrows * WAD) / totalAssets;

  const errNormFactor =
    utilization > irmConfig.targetUtilization
      ? WAD - irmConfig.targetUtilization
      : irmConfig.targetUtilization;
  const err = ((utilization - irmConfig.targetUtilization) * WAD) / errNormFactor;

  const coeff =
    err < BigInt(0) ? WAD - (WAD * WAD) / irmConfig.curveSteepness : irmConfig.curveSteepness - WAD;

  const ir = (((coeff * err) / WAD + WAD) * irmConfig.rateAtTarget) / WAD;

  return ir * BigInt(1e9);
}

/**
 * @notice Resolves the interest rate based on the IRM configuration type
 * @param cash The amount of unused tokens in the vault
 * @param totalBorrows The total amount of borrowed tokens
 * @param irmConfig The interest rate model configuration (either standard or adaptive)
 * @returns The per-second interest rate scaled by 1e27
 * @throws Error if an invalid IRM type is provided
 */
export function resolveEulerInterestRate({
  cash,
  totalBorrows,
  irmConfig,
}: {
  cash: bigint;
  totalBorrows: bigint;
  irmConfig: EulerIrm | EulerAdaptiveIrm | EulerNoIrm;
}) {
  if (irmConfig.type === 'irm') {
    return computeEulerInterestRate({ cash, totalBorrows, irmConfig });
  } else if (irmConfig.type === 'adaptiveIrm') {
    return computeEulerAdaptiveInterestRate({ cash, totalBorrows, irmConfig });
  } else if (irmConfig.type === 'noIrm') {
    return 0n;
  } else {
    throw new Error('Invalid IRM type');
  }
}
