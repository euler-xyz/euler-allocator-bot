import { addressSchema, privateKeySchema, strategyConstantsSchema } from '@/types/types';
import { type Decimal } from '@prisma/client/runtime';
import { formatUnits, getAddress, parseUnits, type Address, type Hex } from 'viem';

/**
 * @notice Helper function to parse and validate environment variables
 * @param varValue The value of the environment variable, which may be undefined
 * @returns The validated environment variable value
 * @throws Error if the environment variable is undefined
 */
export function parseEnvVar(varValue?: string, name?: string): string {
  if (!varValue) {
    throw new Error(`❌ Missing environment variable: ${name}`);
  }
  return varValue;
}

/**
 * @notice Converts a Prisma Decimal value to a JavaScript BigInt
 * @param decimalValue - The decimal value to convert
 * @returns The decimal value as a BigInt
 */
export function parseDecimalToBigInt(decimalValue: Decimal) {
  return BigInt(decimalValue.toFixed(0));
}

/**
 * @notice Parses a list of strategies into an array of objects with protocol and vault address
 * @dev This ensures that the vault address is in lower case and only supported protocols can be passed
 * @param strategies - The list of strategies to parse
 * @returns An array of objects with protocol and vault address
 */
export function parseStrategies(strategies?: string[]) {
  return strategies?.map(strategy => {
    const [protocol, vaultAddress] = strategy.split(':');
    return strategyConstantsSchema.parse({
      protocol,
      vaultAddress,
    });
  });
}

/**
 * @notice Converts a contract address string to lowercase and types it as an Address
 * @param contractAddress The contract address string to parse
 * @returns Checksum encoded address
 */
export function parseContractAddress(contractAddress: string) {
  return addressSchema.parse(contractAddress);
}

/**
 * @notice Parses a private key string to a Hex value
 * @param privateKey The private key string to parse
 * @returns The private key as a Hex value
 */
export function parsePrivateKey(privateKey: string) {
  return privateKeySchema.parse(privateKey) as Hex;
}

/**
 * @notice Converts a BigInt value to a number by scaling it down by a given factor
 * @param bigIntValue The BigInt value to convert
 * @param scaleDownFactor The number of decimal places to scale down by
 * @returns The scaled down value as a number
 */
export function parseBigIntToNumberWithScale(bigIntValue: bigint, scaleDownFactor: number) {
  return Number(formatUnits(bigIntValue, scaleDownFactor));
}

/**
 * @notice Converts a number value to a BigInt by scaling it up by a given factor
 * @param numberValue The number value to convert
 * @param scaleUpFactor The number of decimal places to scale up by
 * @returns The scaled up value as a BigInt
 */
export function parseNumberToBigIntWithScale(numberValue: number, scaleUpFactor: number) {
  return parseUnits(numberValue.toFixed(scaleUpFactor), scaleUpFactor);
}
