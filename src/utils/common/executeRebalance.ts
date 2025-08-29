import { EulerEarnAbi } from '@/constants/EulerEarnAbi';
import { EvcAbi } from '@/constants/EvcAbi';
import { Allocation } from '@/types/types';
import {
  createWalletClient,
  encodeFunctionData,
  http,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { calculateEulerEarnAllocations } from './calculateEulerEarnAllocations';

/**
 * @notice Executes a rebalance operation by adjusting allocation points and calling rebalance
 * @dev Uses EVC batch functionality to execute multiple transactions atomically
 * @param allocation Record mapping strategy addresses to their allocation details
 * @param allocatorPrivateKey Private key of the allocator account
 * @param earnVaultAddress Address of the Euler Earn vault contract
 * @param evcAddress Address of the EVC contract
 * @param rpcClient Public client for RPC interactions
 * @param broadcast If true, execute the tx, otherwise just simulate
 * @return Transaction hash of the executed batch transaction
 */
export async function executeRebalance({
  allocation,
  allocatorPrivateKey,
  earnVaultAddress,
  evcAddress,
  rpcClient,
  broadcast,
}: {
  allocation: Allocation;
  allocatorPrivateKey: Hex;
  earnVaultAddress: Address;
  evcAddress: Address;
  rpcClient: PublicClient;
  broadcast: boolean;
}) {
  const account = privateKeyToAccount(allocatorPrivateKey);
  const walletClient = createWalletClient({
    account,
    chain: rpcClient.chain,
    transport: http(rpcClient.transport.key),
  });

  const batchItems: {
    targetContract: Address;
    onBehalfOfAccount: Address;
    value: bigint;
    data: `0x${string}`;
  }[] = [];

  const marketAllocations = calculateEulerEarnAllocations(allocation);

  batchItems.push({
    targetContract: earnVaultAddress,
    onBehalfOfAccount: account.address,
    value: BigInt(0),
    data: encodeFunctionData({
      abi: EulerEarnAbi,
      functionName: 'reallocate',
      args: [marketAllocations],
    }),
  });

  const { request } = await rpcClient.simulateContract({
    account,
    address: evcAddress,
    abi: EvcAbi,
    functionName: 'batch',
    args: [batchItems],
  });

  if (broadcast) {
    const hash = await walletClient.writeContract(request);
    const receipt = await rpcClient.waitForTransactionReceipt({ hash });

    return receipt.transactionHash;
  } else {
    return "simulation"
  }
}
