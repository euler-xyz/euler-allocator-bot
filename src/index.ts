import rpcClient from '@/data/rpcClient';

import ENV from '@/constants/constants';
import Allocator from '@/modules/Allocator';
import { logger } from './utils/common/log';
import { sendNotifications } from './utils/notifications/sendNotifications';

const allocator = new Allocator({
  allocationDiffTolerance: ENV.ALLOCATION_DIFF_TOLERANCE,
  allocatorPrivateKey: ENV.ALLOCATOR_PRIVATE_KEY,
  cashPercentage: ENV.CASH_PERCENTAGE,
  chainId: ENV.CHAIN_ID,
  earnVaultAddress: ENV.EARN_VAULT_ADDRESS,
  evcAddress: ENV.EVC_ADDRESS,
  evkVaultLensAddress: ENV.VAULT_LENS_ADDRESS,
  eulerEarnLensAddress: ENV.EULER_EARN_VAULT_LENS_ADDRESS,
  strategiesOverride: ENV.STRATEGIES_OVERRIDE,
  broadcast: ENV.BROADCAST,
  rpcClient,
});

async function main() {
  try {
    await allocator.computeAllocation();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(error);
    await sendNotifications({
      message: `chain: ${ENV.CHAIN_ID}, vault: ${ENV.EARN_VAULT_ADDRESS}, Error\n${errorMessage}, ${error}`,
      type: 'error',
    });
  }
  setTimeout(main, ENV.INTERVAL_TIME);
}

main();
