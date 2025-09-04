import NOTIFICATION_CONSTANTS from '@/constants/notificationConstants';

export async function sendTelegramMessage({
  message,
  type,
}: {
  message: string;
  type: 'info' | 'error';
}) {
  if (!NOTIFICATION_CONSTANTS.TELEGRAM_BOT_TOKEN) return;
  const text = type === 'error' ? `❌ ${message}` : message;

  const response = await fetch(
    `https://api.telegram.org/bot${NOTIFICATION_CONSTANTS.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: NOTIFICATION_CONSTANTS.TELEGRAM_CHAT_ID,
        text,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json();
}
