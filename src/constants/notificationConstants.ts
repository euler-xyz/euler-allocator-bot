/**
 * @notice Constants used for notification services configuration
 */
const NOTIFICATION_CONSTANTS = {
  /** @notice Bot token for authenticating with Telegram API */
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  /** @notice Telegram chat ID where notifications will be sent */
  TELEGRAM_CHAT_ID: Number(process.env.TELEGRAM_CHAT_ID),
  /** @notice Slack webhook where notifications will be sent */
  SLACK_WEBHOOK: process.env.SLACK_WEBHOOK,
};

export default NOTIFICATION_CONSTANTS;
