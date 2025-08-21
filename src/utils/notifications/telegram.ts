import NOTIFICATION_CONSTANTS from '@/constants/notificationConstants';

export async function sendTelegramMessage({
  message,
  type,
}: {
  message: string;
  type: 'info' | 'error';
}) {
  let text = '';
  if (type === 'info') {
    text = `📊 ${message}`;
  } else {
    text = `🚨 ${message}`;
  }

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

  return response.json();
}
