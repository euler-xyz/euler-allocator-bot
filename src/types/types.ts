import { VaultLensAbi } from '@/constants/VaultLensAbi';
import { eulerAdaptiveIrmSchema, eulerIrmSchema, eulerNoIrmSchema } from '@/types/euler';
import { AbiParametersToPrimitiveTypes, ExtractAbiFunction } from 'abitype';
import { Address, getAddress, Hash } from 'viem';
import { z } from 'zod';
/**
 * @notice Schema for validating Ethereum addresses
 */
export const addressSchema = z.string().transform(val => getAddress(val));

/**
 * @notice Schema for validating Ethereum private keys
 */
export const privateKeySchema = z.string().toLowerCase().startsWith('0x').length(66);

/**
 * @notice Supported lending protocols
 * @dev New protocols can be added here as they are integrated
 */
export const protocolSchema = z.enum(['euler']);

/**
 * @notice Available optimization modes for the allocator
 */
export const optimizationModeSchema = z.enum(['annealing', 'equalization', 'combined']);
export type OptimizationMode = z.infer<typeof optimizationModeSchema>;

/**
 * @notice Schema for reward campaign details
 */
export const rewardCampaignSchema = z.object({
  dailyReward: z.number(),
  blacklistedSupply: z.bigint(),
});
export type RewardCampaign = z.infer<typeof rewardCampaignSchema>;

/**
 * @notice Schema for vault details containing current state and configuration
 */
export const strategyDetailsSchema = z.object({
  vault: addressSchema,
  symbol: z.string(),
  protocol: protocolSchema,
  borrowAPY: z.number(),
  supplyAPY: z.number(),
  rewardCampaigns: z.array(rewardCampaignSchema),
  rewardAPY: z.number(),
  cash: z.bigint(),
  totalBorrows: z.bigint(),
  totalShares: z.bigint(),
  interestFee: z.number(),
  supplyCap: z.bigint(),
  irmConfig: z.union([eulerIrmSchema, eulerAdaptiveIrmSchema, eulerNoIrmSchema]),
});
export type StrategyDetails = z.infer<typeof strategyDetailsSchema>;

/**
 * @notice Configuration constants for a lending strategy
 */
export const strategyConstantsSchema = z.object({
  protocol: protocolSchema,
  vaultAddress: addressSchema,
});
export type StrategyConstants = z.infer<typeof strategyConstantsSchema>;

/**
 * @notice Schema for allocation details
 */
export const allocationDetailsSchema = z.object({
  oldAmount: z.bigint(),
  newAmount: z.bigint(),
  diff: z.bigint(),
});
export type AllocationDetails = z.infer<typeof allocationDetailsSchema>;

export type Allocation = Record<string, AllocationDetails>;

/**
 * @notice Schema for Merkl
 */
export const merklDataSchema = z.object({
  amount: z.string(),
  startTimestamp: z.number(),
  endTimestamp: z.number(),
  subType: z.number(),
  params: z.object({
    evkAddress: addressSchema,
    addressAsset: addressSchema,
    duration: z.number(),
    whitelist: z.array(addressSchema),
    blacklist: z.array(addressSchema),
  }),
  rewardToken: z.object({
    decimals: z.number(),
    price: z.number(),
  }),
});

export type MerklData = z.infer<typeof merklDataSchema>;

export type ProtocolEnum = z.infer<typeof protocolSchema>;

export type EvkVaultLensData = AbiParametersToPrimitiveTypes<
  ExtractAbiFunction<typeof VaultLensAbi, 'getVaultInfoFull'>['outputs'],
  'outputs'
>[0];

export type EulerEarn = {
  strategies: {
    [k: string]: {
      cap: bigint;
      protocol: ProtocolEnum;
      allocation: bigint;
      details: StrategyDetails;
    };
  };
  idleVaultAddress: Address;
  assetDecimals: number;
  initialAllocationQueue: Address[];
};

export type ReturnsDetails = {
  [key: Address]: {
    interestAPY: number;
    rewardsAPY: number;
    utilization: number;
  };
};

export type RunLog = {
  current: {
    allocation: Allocation;
    returnsTotal: number;
    returnsStrategies: ReturnsDetails;
  };
  allocationAmount: bigint;
  cashAmount: bigint;
  new: {
    allocation: Allocation;
    returnsTotal: number;
    returnsDetails: ReturnsDetails;
  };
  mode: OptimizationMode;
  spreadSummary?: {
    current?: number;
    final?: number;
    tolerance?: number;
  };
  result?: 'abort' | 'simulation' | 'error' | Hash;
  error?: unknown;
};
