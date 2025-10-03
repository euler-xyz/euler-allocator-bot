import { defineChain } from 'viem';
import { arbitrum, base, mainnet } from 'viem/chains';


export const plasma = defineChain({
  id: 9745,
  name: "Plasma",
  nativeCurrency: {
    decimals: 18,
    name: "XPL",
    symbol: "XPL",
  },
  blockExplorers: {
    default: {
      name: "Plasma Explorer",
      url: "https://plasmascan.to/",
    },
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.plasma.to"],
    },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 0,
    },
  },
} as const)

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
    default:
      throw new Error(`Unsupported chainId: ${chainId}`);
  }
}
