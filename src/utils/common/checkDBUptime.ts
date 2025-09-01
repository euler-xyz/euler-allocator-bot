import { getChainName } from '@/utils/common/chainConversion';
import { Prisma, type PrismaClient } from '@prisma/client';
import { type PublicClient } from 'viem';

/**
 * @notice Check if the database is up to date with the RPC
 * @param chainId The chain ID to check
 * @param prismaClient The Prisma client instance
 * @param rpcClient The RPC client instance
 */
export async function checkDBUptime({
  chainId,
  prismaClient,
  rpcClient,
}: {
  chainId: number;
  prismaClient: PrismaClient;
  rpcClient: PublicClient;
}) {
  const currentBlockNumberRPC = await rpcClient.getBlockNumber();
  const status = await prismaClient.ponder_meta.findUniqueOrThrow({
    where: {
      key: 'status',
    },
  });

  const statusJson = status.value ?? null;
  if (!statusJson) {
    throw new Error('Status json is not defined');
  }

  const chainName = getChainName(chainId);
  const chainMetadata = statusJson[chainName] as
    | {
        block: {
          number: number;
          timestamp: number;
        };
        ready: boolean;
      }
    | undefined;
  if (!chainMetadata) {
    throw new Error(`No data available for ${chainName}`);
  }

  if (Number(currentBlockNumberRPC) - chainMetadata.block.number > 15 || !chainMetadata.ready) {
    throw new Error('Indexer is out of sync');
  }
}
