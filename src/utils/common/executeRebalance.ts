import { EulerEarnAbi } from '@/constants/EulerEarnAbi';
import { EvcAbi } from '@/constants/EvcAbi';
import { type AllocationDetails } from '@/types/types';
import { parseBigIntToNumberWithScale, parseContractAddress } from '@/utils/common/parser';
import {
  createWalletClient,
  encodeFunctionData,
  http,
  maxUint256,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { calculateEulerEarnAllocations } from '../euler/calculateEulerEarnAllocations';

/**
 * @notice Executes a rebalance operation by adjusting allocation points and calling rebalance
 * @dev Uses EVC batch functionality to execute multiple transactions atomically
 * @param allocation Record mapping strategy addresses to their allocation details
 * @param allocatorPrivateKey Private key of the allocator account
 * @param earnVaultAddress Address of the Euler Earn vault contract
 * @param evcAddress Address of the EVC contract
 * @param rpcClient Public client for RPC interactions
 * @return Transaction hash of the executed batch transaction
 */
export async function executeRebalance({
  allocation,
  allocatorPrivateKey,
  earnVaultAddress,
  evcAddress,
  rpcClient,
}: {
  allocation: Record<string, AllocationDetails>;
  allocatorPrivateKey: Hex;
  earnVaultAddress: Address;
  evcAddress: Address;
  rpcClient: PublicClient;
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

  const marketAllocations = calculateEulerEarnAllocations(allocation)

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
// process.exit()
  const { request } = await rpcClient.simulateContract({
    account,
    address: evcAddress,
    abi: EvcAbi,
    functionName: 'batch',
    args: [batchItems],
  });
  const hash = await walletClient.writeContract(request);
  const receipt = await rpcClient.waitForTransactionReceipt({ hash });

  return receipt.transactionHash;
}
