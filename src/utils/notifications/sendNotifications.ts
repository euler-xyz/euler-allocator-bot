import ENV from '@/constants/constants';
import { RunLog } from '@/types/types';
import { logger } from '../common/log';
import { sendSlackMessage } from './slack';
import { sendTelegramMessage } from './telegram';

const formatPercent = (value?: number, digits = 3) =>
  value === undefined ? 'n/a' : `${value.toFixed(digits)}%`;

const formatDelta = (current: number, next: number) => {
  const delta = next - current;
  const prefix = delta >= 0 ? '+' : '';
  return `${prefix}${delta.toFixed(3)}%`;
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

  if (runLog.result === 'error') {
    const errorMessage =
      runLog.error instanceof Error ? runLog.error.message : String(runLog.error);
    const message = [
      `Rebalance ERROR (mode: ${runLog.mode})`,
      `chain ${ENV.CHAIN_ID} vault ${ENV.EARN_VAULT_ADDRESS}`,
      apySummary,
      spreadSummary,
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
    `chain ${ENV.CHAIN_ID} vault ${ENV.EARN_VAULT_ADDRESS}`,
    apySummary,
    spreadSummary,
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
