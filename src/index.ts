// import prismaClient from '@/data/dbClient';
import rpcClient from '@/data/rpcClient';

import ENV from '@/constants/constants';
import Allocator from '@/modules/Allocator';
import { sendTelegramMessage } from '@/utils/notifications/telegram';

const allocator = new Allocator({
  allocationDiffTolerance: ENV.ALLOCATION_DIFF_TOLERANCE,
  allocatorPrivateKey: ENV.ALLOCATOR_PRIVATE_KEY,
  amountSnapshotTolerance: ENV.AMOUNT_SNAPSHOT_TOLERANCE,
  apyTolerance: ENV.APY_TOLERANCE,
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
    console.log(`Successful run at ${new Date().toISOString()}`);
    setTimeout(main, ENV.INTERVAL_TIME);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.log(error);
    await sendTelegramMessage({ message: `Error\n${errorMessage}`, type: 'error' });
  }
}

console.log(`ALLOCATOR STARTED AT: ${new Date().toISOString()}`);
main();
