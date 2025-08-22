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
  ALLOCATION_DIFF_TOLERANCE: Number(parseEnvVar(process.env.ALLOCATION_DIFF_TOLERANCE)),
  /** @notice Private key of the allocator */
  ALLOCATOR_PRIVATE_KEY: parsePrivateKey(parseEnvVar(process.env.ALLOCATOR_PRIVATE_KEY)),
  /** @notice Maximum allowed earn vault balances difference between snapshots (percentage, e.g., 0.01) */
  AMOUNT_SNAPSHOT_TOLERANCE: Number(parseEnvVar(process.env.AMOUNT_SNAPSHOT_TOLERANCE)),
  /** @notice Maximum allowed APY difference between snapshots (absolute value, e.g., 1.5 (150 basis points)) */
  APY_TOLERANCE: Number(parseEnvVar(process.env.APY_TOLERANCE)),
  /** @notice Address of the asset being allocated (e.g. USDC) */
  ASSET_CONTRACT_ADDRESS: parseContractAddress(parseEnvVar(process.env.ASSET_CONTRACT_ADDRESS)),
  /** @notice Decimal precision of the asset */
  ASSET_DECIMALS: Number(parseEnvVar(process.env.ASSET_DECIMALS)),
  /** @notice Percentage of total assets to keep as cash reserve (18 decimal fixed point) */
  CASH_PERCENTAGE: BigInt(parseEnvVar(process.env.CASH_PERCENTAGE)),
  /** @notice ID of the blockchain network */
  CHAIN_ID: Number(parseEnvVar(process.env.CHAIN_ID)),
  /** @notice Address of the earn vault */
  EARN_VAULT_ADDRESS: parseContractAddress(parseEnvVar(process.env.EARN_VAULT_ADDRESS)),
  /** @notice Address of the EVC contract, see euler-interfaces repo for deployed addresses */
  EVC_ADDRESS: parseContractAddress(parseEnvVar(process.env.EVC_ADDRESS)),
  /** @notice Time between allocation checks in milliseconds */
  INTERVAL_TIME: Number(parseEnvVar(process.env.INTERVAL_TIME)),
  /** @notice URL of the RPC endpoint for blockchain connection */
  RPC_URL: parseEnvVar(process.env.RPC_URL),
  /** @notice Comma-separated list of protocol:address pairs for allocation strategies */
  STRATEGIES: parseStrategies(parseEnvVar(process.env.STRATEGIES).split(',')),
  /** @notice Address of the VaultLens contract, see euler-interfaces repo for deployed addresses */
  VAULT_LENS_ADDRESS: parseContractAddress(parseEnvVar(process.env.VAULT_LENS_ADDRESS)),
  /** @notice Address of the EulerEarnVaultLens contract, see euler-interfaces repo for deployed addresses */
  EULER_EARN_VAULT_LENS_ADDRESS: parseContractAddress(
    parseEnvVar(process.env.EULER_EARN_VAULT_LENS_ADDRESS),
  ),
};

export default ENV;
