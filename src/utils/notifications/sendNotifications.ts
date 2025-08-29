import { RunLog } from "@/types/types";
import { sendTelegramMessage } from "./telegram";
import { logger } from "../common/log";
import ENV from '@/constants/constants';
import { sendSlackMessage } from "./slack";


export async function notifyRun(runLog: RunLog) {
  if (runLog.result?.startsWith('0x')) {
    const message = `Rebalance executed, chain ${ENV.CHAIN_ID}, vault ${ENV.EARN_VAULT_ADDRESS}, APY ${runLog.current.returnsTotal} => ${runLog.new.returnsTotal} tx ${runLog.result}`
    return sendNotifications({message, type: 'info'})
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
    }).catch(err => logger.error({msg: "Error sending telegram message", err})),
    sendSlackMessage({
      message,
      type,
    }).catch(err => logger.error({msg: "Error sending slack message", err})),
  ])
}