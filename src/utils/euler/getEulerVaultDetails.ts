import { VaultLensAbi } from '@/constants/VaultLensAbi';
import { protocolSchema, StrategyDetails, strategyDetailsSchema } from '@/types/types';
import { getEulerIrmConfig } from '@/utils/euler/getEulerIrmConfig';
import { getEulerRewardCampaigns } from '@/utils/euler/getEulerRewardCampaigns';
import {
  resolveEulerBorrowAPY,
  resolveEulerInterestRate,
  resolveEulerSupplyAPY,
} from '@/utils/euler/resolveEulerUnits';
import { computeMerklRewardAPY } from '@/utils/rewards/merkl';
import { type Address, type PublicClient } from 'viem';

/**
 * @notice Retrieves current details for an Euler vault
 * @dev Combines data from database and on-chain sources
 * @param assetDecimals The decimal precision of the asset
 * @param chainId The chain ID of the vault
 * @param vaultAddress The address of the vault to query
 * @param vaultSymbol The symbol of the vault to query
 * @param lensAddress The address of the vault lens contract
 * @param rpcClient RPC client instance for querying on-chain data
 * @returns VaultDetails object containing current vault state
 * @throws Will throw if vault status or config not found in database
 */
export async function getEulerVaultDetails({
  assetDecimals,
  chainId,
  vaultAddress,
  vaultSymbol,
  lensAddress,
  rpcClient,
}: {
  assetDecimals: number;
  chainId: number;
  vaultAddress: Address;
  vaultSymbol: string;
  lensAddress: Address;
  rpcClient: PublicClient;
}): Promise<StrategyDetails> {
  const lensData = await rpcClient.readContract({
    address: lensAddress,
    abi: VaultLensAbi,
    functionName: 'getVaultInfoFull',
    args: [vaultAddress],
  });

  const cash = lensData.totalCash;
  const totalBorrows = lensData.totalBorrowed;
  const totalShares = lensData.totalShares;
  const interestFee = Number(lensData.interestFee);
  const supplyCap = lensData.supplyCap;

  const irmConfig = await getEulerIrmConfig({ lensData, rpcClient });

  /* Compute APYs */
  const interestRate = resolveEulerInterestRate({
    cash,
    totalBorrows,
    irmConfig,
  });
  const borrowAPY = resolveEulerBorrowAPY(interestRate);
  const supplyAPY = resolveEulerSupplyAPY({
    assetDecimals,
    borrowAPY,
    cash,
    interestFee,
    totalBorrows,
  });

  /* Get reward campaigns and compute reward APY */
  const rewardCampaigns = await getEulerRewardCampaigns({
    vaultAddress,
    chainId,
    cash,
    totalBorrows,
    totalShares,
    rpcClient,
  });
  const rewardAPY = computeMerklRewardAPY({
    assetDecimals,
    cash,
    totalBorrows,
    rewardCampaigns,
  });

  return strategyDetailsSchema.parse({
    vault: vaultAddress,
    symbol: vaultSymbol,
    protocol: protocolSchema.Enum.euler,
    borrowAPY,
    supplyAPY,
    rewardCampaigns,
    rewardAPY,
    cash,
    totalBorrows,
    totalShares,
    interestFee,
    supplyCap,
    irmConfig,
  });
}
