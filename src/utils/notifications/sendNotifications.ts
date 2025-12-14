import ENV from '@/constants/constants';
import { RunLog } from '@/types/types';
import { logger } from '../common/log';
import { sendSlackMessage } from './slack';
import { sendTelegramMessage } from './telegram';

const stringify = (obj: any) =>
  JSON.stringify(obj, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2);

export async function notifyRun(runLog: RunLog) {
  if (runLog.result?.startsWith('0x')) {
    const message = `Rebalance executed, chain ${ENV.CHAIN_ID}, vault ${ENV.EARN_VAULT_NAME} ${ENV.EARN_VAULT_ADDRESS}, APY ${runLog.current.returnsTotal.toFixed(3)} => ${runLog.new.returnsTotal.toFixed(3)} tx ${runLog.result} pid ${process.pid}`;
    return sendNotifications({ message, type: 'info' });
  } else if (runLog.result === 'error') {
    const errorMessage =
      runLog.error instanceof Error ? runLog.error.message : String(runLog.error);
    const message = `Rebalance ERROR, chain ${ENV.CHAIN_ID}, vault ${ENV.EARN_VAULT_NAME} ${ENV.EARN_VAULT_ADDRESS}, Error: ${errorMessage}`;
    return sendNotifications({ message, type: 'error' });
  }
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
