import ENV from '@/constants/constants';
import rpcClient from '@/data/rpcClient';
import Allocator from '@/modules/Allocator';
import { OptimizationMode } from '@/types/types';
import { parseOptimizationMode } from '@/utils/common/parser';
import { logger } from './utils/common/log';
import { sendNotifications } from './utils/notifications/sendNotifications';

type CliOptions = {
  optimizationMode?: OptimizationMode;
};

const parseCliOptions = (argv: string[]): CliOptions => {
  const options: CliOptions = {};

  const assignMode = (value: string) => {
    options.optimizationMode = parseOptimizationMode(value);
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    const [flag, inlineValue] = arg.split('=');

    switch (flag) {
      case '--mode':
      case '--optimizer':
      case '--strategy': {
        const value = inlineValue ?? argv[++index];
        if (!value) {
          throw new Error(`Missing value for ${flag}`);
        }
        assignMode(value);
        break;
      }
      default:
        break;
    }
  }

  return options;
};

const cliOptions = parseCliOptions(process.argv.slice(2));
const optimizationMode = cliOptions.optimizationMode ?? ENV.OPTIMIZATION_MODE;

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
  optimizationMode,
  apySpreadTolerance: ENV.APY_SPREAD_TOLERANCE,
  noIdleVault: ENV.NO_IDLE_VAULT,
});

async function main() {
  try {
    await allocator.computeAllocation();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(error);
    await sendNotifications({
      message: `chain: ${ENV.CHAIN_ID}, vault: ${ENV.EARN_VAULT_ADDRESS}, Error\n${errorMessage}`,
      type: 'error',
    });
  }
  setTimeout(main, ENV.INTERVAL_TIME);
}

main();
