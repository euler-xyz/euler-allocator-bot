import { logger } from '@/utils/common/log';
import { getAddress, type Address } from 'viem';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

type VaultLabelMetadata = {
  name?: string;
  description?: string;
  entity?: string;
};

type VaultLabels = Record<string, VaultLabelMetadata>;

const labelsCache = new Map<number, VaultLabels>();
const failedLoads = new Set<number>();

const resolveLabelsPath = (chainId: number) =>
  path.resolve(process.cwd(), 'external', 'euler-labels', chainId.toString(), 'vaults.json');

const normaliseAddress = (address: string): string => {
  try {
    return getAddress(address);
  } catch {
    return address.toLowerCase();
  }
};

async function loadVaultLabels(chainId: number): Promise<VaultLabels> {
  if (labelsCache.has(chainId)) return labelsCache.get(chainId)!;
  if (failedLoads.has(chainId)) return {};

  const filePath = resolveLabelsPath(chainId);

  try {
    const raw = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as VaultLabels;
    const normalised = Object.fromEntries(
      Object.entries(parsed).flatMap(([address, metadata]) => {
        const checksum = normaliseAddress(address);
        return [
          [checksum, metadata],
          [checksum.toLowerCase(), metadata],
        ];
      }),
    );
    labelsCache.set(chainId, normalised);
    return normalised;
  } catch (error) {
    failedLoads.add(chainId);
    logger.warn({ msg: 'Unable to load Euler vault labels', chainId, error });
    return {};
  }
}

export async function getVaultLabels(chainId: number): Promise<VaultLabels> {
  return loadVaultLabels(chainId);
}

export async function getVaultLabel(address: Address, chainId: number) {
  const labels = await loadVaultLabels(chainId);
  const normalised = normaliseAddress(address);
  return labels[normalised] ?? labels[normalised.toLowerCase()];
}
