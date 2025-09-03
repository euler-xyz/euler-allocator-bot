import {
  parseContractAddress,
  parseEnvVar,
  parsePrivateKey,
  parseStrategies,
} from '@/utils/common/parser';
import dotenv from 'dotenv';

dotenv.config();

/**
 * @notice Exported environment variables object
 * @dev These values are parsed once when the module is first imported
 * and remain constant afterwards due to Node.js module caching
 */
const ENV = {
  /** @notice Minimum required difference between current and new allocations for reallocation to happen (percentage, e.g., 0.01) */
  ALLOCATION_DIFF_TOLERANCE: Number(parseEnvVar(process.env.ALLOCATION_DIFF_TOLERANCE, 'ALLOCATION_DIFF_TOLERANCE')),
  /** @notice Private key of the allocator */
  ALLOCATOR_PRIVATE_KEY: parsePrivateKey(parseEnvVar(process.env.ALLOCATOR_PRIVATE_KEY, 'ALLOCATOR_PRIVATE_KEY')),
  /** @notice Maximum allowed earn vault balances difference between snapshots (percentage, e.g., 0.01) */
  AMOUNT_SNAPSHOT_TOLERANCE: Number(parseEnvVar(process.env.AMOUNT_SNAPSHOT_TOLERANCE, 'AMOUNT_SNAPSHOT_TOLERANCE')),
  /** @notice Maximum allowed APY difference between snapshots (absolute value, e.g., 1.5 (150 basis points)) */
  APY_TOLERANCE: Number(parseEnvVar(process.env.APY_TOLERANCE, 'APY_TOLERANCE')),
  /** @notice Percentage of total assets to keep as cash reserve in idle (non-borrowable) vault (18 decimal fixed point) */
  CASH_PERCENTAGE: BigInt(parseEnvVar(process.env.CASH_PERCENTAGE, 'CASH_PERCENTAGE')),
  /** @notice Max difference in APY between strategies, (percentage, e.g. "3" means 3%) */
  MAX_STRATEGY_APY_DIFF: Number(parseEnvVar(process.env.MAX_STRATEGY_APY_DIFF, 'MAX_STRATEGY_APY_DIFF')),
  /** @notice ID of the blockchain network */
  CHAIN_ID: Number(parseEnvVar(process.env.CHAIN_ID, 'CHAIN_ID')),
  /** @notice Address of the earn vault */
  EARN_VAULT_ADDRESS: parseContractAddress(parseEnvVar(process.env.EARN_VAULT_ADDRESS, 'EARN_VAULT_ADDRESS')),
  /** @notice Address of the EVC contract, see euler-interfaces repo for deployed addresses */
  EVC_ADDRESS: parseContractAddress(parseEnvVar(process.env.EVC_ADDRESS, 'EVC_ADDRESS')),
  /** @notice Time between allocation checks in milliseconds */
  INTERVAL_TIME: Number(parseEnvVar(process.env.INTERVAL_TIME, 'INTERVAL_TIME')),
  /** @notice If "true", the tx will be executed */
  BROADCAST: parseEnvVar(process.env.BROADCAST, 'BROADCAST').toLowerCase() === 'true',
  /** @notice URL of the RPC endpoint for blockchain connection */
  RPC_URL: parseEnvVar(process.env.RPC_URL, 'RPC_URL'),
  /** @notice Optional comma-separated list of protocol:address pairs for allocation strategies. Can be used to only allocate
   * to selected strategies. Idle vault must be included if CASH_PERCENTAGE > 0.
   */
  STRATEGIES_OVERRIDE: parseStrategies(process.env.STRATEGIES_OVERRIDE?.split(',')),
  /** @notice Address of the VaultLens contract, see euler-interfaces repo for deployed addresses */
  VAULT_LENS_ADDRESS: parseContractAddress(parseEnvVar(process.env.VAULT_LENS_ADDRESS, 'VAULT_LENS_ADDRESS')),
  /** @notice Address of the EulerEarnVaultLens contract, see euler-interfaces repo for deployed addresses */
  EULER_EARN_VAULT_LENS_ADDRESS: parseContractAddress(
    parseEnvVar(process.env.EULER_EARN_VAULT_LENS_ADDRESS, 'EULER_EARN_VAULT_LENS_ADDRESS'),
  ),
  /** @notice Optional. Max gas cost to spend on execution (gas * gasPrice) */
  MAX_GAS_COST: BigInt(process.env.MAX_GAS_COST || 0),
};

export default ENV;
