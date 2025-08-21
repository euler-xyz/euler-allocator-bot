import ENV from '@/constants/constants';
import { getChain } from '@/utils/common/chainConversion';
import { createPublicClient, http, type PublicClient } from 'viem';

/**
 * @notice Public RPC client instance for blockchain interactions
 * @dev Chain and RPC URL are configured via environment variables
 */
const rpcClient = createPublicClient({
  chain: getChain(ENV.CHAIN_ID),
  transport: http(ENV.RPC_URL, { key: ENV.RPC_URL }),
  batch: {
    multicall: true,
  },
}) as PublicClient;

export default rpcClient;
