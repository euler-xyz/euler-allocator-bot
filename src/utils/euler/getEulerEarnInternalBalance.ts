import { EulerEarnAbi } from '@/constants/EulerEarnAbi';
import { convertEulerSharesToAssets } from '@/utils/euler/resolveEulerUnits';
import { PublicClient, type Address } from 'viem';

/**
 * @notice Gets the token balance of an address in an Euler vault
 * @dev Calculates balance by summing transfers in/out and converting shares to assets
 * @param address The address to get the balance for
 * @param vaultAddress The address of the vault
 * @param cash The amount of unused tokens in the vault
 * @param totalBorrows The total amount of borrowed tokens
 * @param totalShares The total number of shares in the vault
 * @param chainId The chain ID where the vault exists
 * @param rpcClient RPC client instance for querying on-chain data
 * @returns The token balance as a bigint in the vault's token decimals
 */
export async function getEulerEarnInternalBalance({
  address,
  vaultAddress,
  cash,
  totalBorrows,
  totalShares,
  chainId,
  rpcClient,
}: {
  address: Address;
  vaultAddress: Address;
  cash: bigint;
  totalBorrows: bigint;
  totalShares: bigint;
  chainId: number;
  rpcClient: PublicClient;
}) {
  const [shares] = await rpcClient.readContract({
    address: address,
    abi: EulerEarnAbi,
    functionName: 'config',
    args: [vaultAddress],
  });
  return convertEulerSharesToAssets({
    shares,
    cash,
    totalBorrows,
    totalShares,
  });
}
