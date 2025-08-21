import { getChainNameDefiLlama } from '@/utils/common/chainConversion';
import { sendTelegramMessage } from '@/utils/notifications/telegram';

/**
 * @notice Fetches the price of a token from DefiLlama
 * @param address The address of the token
 * @param chainId The chain ID of the token
 * @returns The price of the token
 */
export async function getTokenPrice(address: string, chainId: number): Promise<number | undefined> {
  const chain = getChainNameDefiLlama(chainId);
  const data = await fetch(
    `https://coins.llama.fi/prices/current/${chain}:${address}?searchWidth=2h`,
  )
    .then(response => response.json())
    .then(data => data.coins);

  const price = data[`${chain}:${address}`]?.price;
  if (!price) {
    await sendTelegramMessage({
      message: `Error\nNo price found for ${address} on ${chainId}`,
      type: 'error',
    });
  }
  return price;
}
