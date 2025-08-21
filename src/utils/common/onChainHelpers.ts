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

/**
 * @notice Gets the total allocation points for an Euler Earn vault
 * @param earnVaultAddress The address of the Euler Earn vault
 * @param rpcClient The RPC client to use for the contract call
 * @returns The total allocation points
 */
export async function getTotalAllocationPoints({
  earnVaultAddress,
  rpcClient,
}: {
  earnVaultAddress: Address;
  rpcClient: PublicClient;
}) {
  const totalAllocationPoints = await rpcClient.readContract({
    address: earnVaultAddress,
    abi: EulerEarnAbi,
    functionName: 'totalAllocationPoints',
  });

  return totalAllocationPoints;
}
