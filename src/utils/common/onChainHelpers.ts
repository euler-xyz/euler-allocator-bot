import { EulerEarnAbi } from '@/constants/EulerEarnAbi';
import { erc20Abi, type Address, type PublicClient } from 'viem';

/**
 * @notice Gets the ERC20 token balance for a given address
 * @param address The address to check the balance of
 * @param tokenAddress The ERC20 token contract address
 * @param rpcClient The RPC client to use for the contract call
 * @returns The token balance as a bigint
 */
export async function getBalanceOf({
  address,
  tokenAddress,
  rpcClient,
}: {
  address: Address;
  tokenAddress: Address;
  rpcClient: PublicClient;
}) {
  const balance = await rpcClient.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address],
  });

  return balance;
}
