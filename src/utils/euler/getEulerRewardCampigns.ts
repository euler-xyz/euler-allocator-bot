import {
  merklDataSchema,
  rewardCampaignSchema,
  type MerklData,
  type RewardCampaign,
} from '@/types/types';
import { getTokenPrice } from '@/utils/common/getTokenPrice';
import { parseContractAddress } from '@/utils/common/parser';
import { getEulerBalanceOf } from '@/utils/euler/getEulerBalanceOf';
import { sendTelegramMessage } from '@/utils/notifications/telegram';
import { computeMerklDailyReward } from '@/utils/rewards/merkl';
import { PublicClient, type Address } from 'viem';

/**
 * @notice Retrieves active reward campaigns for an Euler vault from Merkl
 * @dev Fetches campaign data from Merkl API and filters for active, non-whitelisted campaigns
 * @param vaultAddress The address of the vault to query rewards for
 * @param chainId The chain ID to query rewards for
 * @param cash The amount of unused tokens in the vault
 * @param totalBorrows The total amount of borrowed tokens
 * @param totalShares The total number of shares in the vault
 * @param rpcClient RPC client instance for querying on-chain data
 * @returns Array of active reward campaigns with daily rewards and blacklisted supply details
 * @throws Will send telegram error message if no Merkl data found for chain or price not found for underlying token
 */
export async function getEulerRewardCampigns({
  vaultAddress,
  chainId,
  cash,
  totalBorrows,
  totalShares,
  rpcClient,
}: {
  vaultAddress: Address;
  chainId: number;
  cash: bigint;
  totalBorrows: bigint;
  totalShares: bigint;
  rpcClient: PublicClient;
}) {
  const data: MerklData[] = await fetch(
    `https://api.merkl.xyz/v4/campaigns/?chainId=${chainId}&type=EULER`,
    { signal: AbortSignal.timeout(15000) } // TODO config
  ).then(response => response.json());

  if (!data || !data.length) {
    await sendTelegramMessage({
      message: `Error\nNo Merkl data found for chainId: ${chainId}`,
      type: 'error',
    });
    return [];
  }

  const campaigns: RewardCampaign[] = [];
  for (const rawValue of data) {
    const value = merklDataSchema.parse(rawValue);
    const currentTimestamp = Math.ceil(Date.now() / 1000);
    if (
      value.subType === 0 &&
      currentTimestamp >= value.startTimestamp &&
      currentTimestamp <= value.endTimestamp &&
      !value.params.whitelist.length &&
      value.params.evkAddress === vaultAddress
    ) {
      const priceUnderlyingToken = await getTokenPrice(value.params.addressAsset, chainId);
      if (!priceUnderlyingToken) continue;

      const blacklistedSupply = (
        await Promise.all(
          value.params.blacklist.map(address =>
            getEulerBalanceOf({
              address: parseContractAddress(address),
              vaultAddress,
              cash,
              totalBorrows,
              totalShares,
              chainId,
              rpcClient,
            }),
          ),
        )
      ).reduce((sum, amount) => sum + amount, BigInt(0));

      campaigns.push(
        rewardCampaignSchema.parse({
          dailyReward: computeMerklDailyReward({ data: value, priceUnderlyingToken }),
          blacklistedSupply,
        }),
      );
    }
  }

  return campaigns;
}
