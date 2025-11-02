import ENV from '@/constants/constants';
import { RunLog } from '@/types/types';
import { logger } from '../common/log';
import { getChainName } from '../common/chainConversion';
import { sendSlackMessage } from './slack';
import { sendTelegramMessage } from './telegram';

const formatPercent = (value?: number, digits = 3) =>
  value === undefined ? 'n/a' : `${value.toFixed(digits)}%`;

const formatDelta = (current: number, next: number) => {
  const delta = next - current;
  const prefix = delta >= 0 ? '+' : '';
  return `${prefix}${delta.toFixed(3)}%`;
};

const normalizeToTwoDecimals = (value: bigint, decimals: number) => {
  if (value === 0n) return '0.00';

  const decimalsBigInt = BigInt(decimals);
  const scaleFactor = 10n ** (decimalsBigInt >= 0n ? decimalsBigInt : 0n);
  const scaledValue = value * 100n;
  const halfScale = scaleFactor > 0n ? scaleFactor / 2n : 0n;
  const adjusted = value >= 0n ? scaledValue + halfScale : scaledValue - halfScale;
  const rounded = scaleFactor > 0n ? adjusted / scaleFactor : scaledValue;

  const isNegative = rounded < 0n;
  const absolute = isNegative ? -rounded : rounded;
  const integerPart = absolute / 100n;
  const fractionPart = absolute % 100n;
  const fractionString = fractionPart.toString().padStart(2, '0');

  const valueString = `${integerPart.toString()}.${fractionString}`;
  if (valueString === '0.00') return valueString;
  return isNegative ? `-${valueString}` : valueString;
};

const formatAmountWithDecimals = (
  value: bigint,
  decimals: number,
  options?: { withSign?: boolean },
) => {
  const normalized = normalizeToTwoDecimals(value, decimals);
  if (options?.withSign) {
    if (normalized === '0.00') return normalized;
    if (value > 0n) return `+${normalized}`;
  }
  return normalized;
};

const formatAllocationSummary = (runLog: RunLog) => {
  const decimals = runLog.metadata?.assetDecimals ?? 18;
  const strategies = runLog.metadata?.strategies ?? {};
  const changedAllocations = Object.entries(runLog.new.allocation).filter(
    ([, allocation]) => allocation.diff !== 0n,
  );
  if (changedAllocations.length === 0) return undefined;

  const lines = changedAllocations.map(([address, allocation]) => {
    const strategy = strategies[address] ?? {};
    const descriptor = strategy.label ?? strategy.name ?? address;
    const fromAmount = formatAmountWithDecimals(allocation.oldAmount, decimals);
    const toAmount = formatAmountWithDecimals(allocation.newAmount, decimals);
    const deltaAmount = formatAmountWithDecimals(allocation.diff, decimals, { withSign: true });
    return `- ${descriptor}: ${fromAmount} → ${toAmount} (${deltaAmount})`;
  });

  return ['Allocation changes:', ...lines].join('\n');
};

const formatSpreadSummary = (runLog: RunLog) => {
  const spread = runLog.spreadSummary;
  if (!spread) return undefined;

  const current = spread.current !== undefined ? formatPercent(spread.current, 3) : undefined;
  const final = spread.final !== undefined ? formatPercent(spread.final, 3) : undefined;

  if (!current && !final) return undefined;

  const tolerancePart =
    spread.tolerance !== undefined ? ` (limit ${formatPercent(spread.tolerance, 3)})` : '';

  if (current && final) return `Spread ${current} → ${final}${tolerancePart}`;
  return `Spread ${current ?? final}${tolerancePart}`;
};

export async function notifyRun(runLog: RunLog) {
  const apySummary = `APY ${formatPercent(runLog.current.returnsTotal)} → ${formatPercent(
    runLog.new.returnsTotal,
  )} (${formatDelta(runLog.current.returnsTotal, runLog.new.returnsTotal)})`;

  const spreadSummary = formatSpreadSummary(runLog);
  const allocationSummary = formatAllocationSummary(runLog);
  const chainDescriptor = (() => {
    try {
      return getChainName(ENV.CHAIN_ID);
    } catch {
      return String(ENV.CHAIN_ID);
    }
  })();
  const earnVaultDescriptor =
    runLog.metadata?.earnVault?.label ??
    runLog.metadata?.earnVault?.name ??
    ENV.EARN_VAULT_ADDRESS;

  if (runLog.result === 'error') {
    const errorMessage =
      runLog.error instanceof Error ? runLog.error.message : String(runLog.error);
    const message = [
      `Rebalance ERROR (mode: ${runLog.mode})`,
      `chain ${chainDescriptor} vault ${earnVaultDescriptor}`,
      apySummary,
      spreadSummary,
      allocationSummary,
      `Error: ${errorMessage}`,
    ]
      .filter(Boolean)
      .join('\n');

    return sendNotifications({ message, type: 'error' });
  }

  const resultLabel = (() => {
    if (!runLog.result) return 'status unknown';
    if (runLog.result.startsWith('0x')) return 'broadcast';
    if (runLog.result === 'simulation') return 'simulation';
    if (runLog.result === 'abort') return 'skipped';
    return runLog.result;
  })();

  const txLine = runLog.result?.startsWith('0x') ? `tx ${runLog.result}` : undefined;

  const message = [
    `Rebalance ${resultLabel.toUpperCase()} (mode: ${runLog.mode})`,
    `chain ${chainDescriptor} vault ${earnVaultDescriptor}`,
    apySummary,
    spreadSummary,
    allocationSummary,
    txLine,
  ]
    .filter(Boolean)
    .join('\n');

  return sendNotifications({ message, type: 'info' });
}
export async function sendNotifications({
  message,
  type,
}: {
  message: string;
  type: 'info' | 'error';
}) {
  await Promise.all([
    sendTelegramMessage({
      message,
      type,
    }).catch(err => logger.error({ msg: 'Error sending telegram message', err })),
    sendSlackMessage({
      message,
      type,
    }).catch(err => logger.error({ msg: 'Error sending slack message', err })),
  ]);
}
