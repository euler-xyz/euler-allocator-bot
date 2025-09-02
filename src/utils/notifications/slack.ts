import NOTIFICATION_CONSTANTS from '@/constants/notificationConstants';

export async function sendSlackMessage({
  message,
  type,
}: {
  message: string;
  type: 'info' | 'error';
}) {
  if (!NOTIFICATION_CONSTANTS.SLACK_WEBHOOK) return;

  const text = type === 'error' ? `🚨 ${message}` : message;

  const response = await fetch(NOTIFICATION_CONSTANTS.SLACK_WEBHOOK, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
    }),
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
}
