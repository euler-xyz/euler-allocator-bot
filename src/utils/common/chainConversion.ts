import { defineChain } from 'viem';
import { arbitrum, base, mainnet, plasma, monad } from 'viem/chains';


/**
 * @notice Get the appropriate chain configuration based on chainId
 * @param chainId The chain ID to get configuration for
 * @returns The chain configuration object
 * @throws Error if chainId is not supported
 */
export function getChain(chainId: number) {
  switch (chainId) {
    case 1:
      return mainnet;
    case 8453:
      return base;
    case 42161:
      return arbitrum;
    case 9745:
      return plasma;
    case 143:
      return monad;
    default:
      throw new Error(`Unsupported chainId: ${chainId}`);
  }
}

/**
 * @notice Get the chain name based on chainId
 * @param chainId The chain ID to get name for
 * @returns The chain name as a string
 * @throws Error if chainId is not supported
 */
export function getChainName(chainId: number) {
  switch (chainId) {
    case 1:
      return 'mainnet';
    case 8453:
      return 'base';
    case 42161:
      return 'arbitrum';
    case 143:
      return 'monad';
    default:
      throw new Error(`Unsupported chainId: ${chainId}`);
  }
}

/**
 * @notice Get the chain name for DefiLlama based on chainId
 * @param chainId The chain ID to get name for
 * @returns The chain name as a string
 * @throws Error if chainId is not supported
 */
export function getChainNameDefiLlama(chainId: number) {
  switch (chainId) {
    case 1:
      return 'ethereum';
    case 8453:
      return 'base';
    case 42161:
      return 'arbitrum';
    case 143:
      return 'monad';
    default:
      throw new Error(`Unsupported chainId: ${chainId}`);
  }
}
