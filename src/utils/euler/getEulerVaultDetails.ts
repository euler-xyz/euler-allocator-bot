import { VaultLensAbi } from '@/constants/VaultLensAbi';
import { protocolSchema, type VaultDetails, vaultDetailsSchema } from '@/types/types';
import { getEulerIrmConfig } from '@/utils/euler/getEulerIrmConfig';
import { getEulerRewardCampigns } from '@/utils/euler/getEulerRewardCampigns';
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
 * @param lensAddress The address of the vault lens contract
 * @param prismaClient Database client instance for querying vault status and config
 * @param rpcClient RPC client instance for querying on-chain data
 * @returns VaultDetails object containing current vault state
 * @throws Will throw if vault status or config not found in database
 */
export async function getEulerVaultDetails({
  assetDecimals,
  chainId,
  vaultAddress,
  lensAddress,
  rpcClient,
}: {
  assetDecimals: number;
  chainId: number;
  vaultAddress: Address;
  lensAddress: Address;
  rpcClient: PublicClient;
}): Promise<VaultDetails> {
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
  const rewardCampaigns = await getEulerRewardCampigns({
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

  return vaultDetailsSchema.parse({
    vault: vaultAddress,
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
