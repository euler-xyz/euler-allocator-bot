import { PrismaClient } from '@prisma/client';

/**
 * @notice Prisma client instance for database interactions
 * @dev Uses singleton pattern to avoid multiple client instances
 * @dev Connection is managed automatically by Prisma
 */
let prismaClient = new PrismaClient({
  log: ['info', 'error', 'warn'],
});

export default prismaClient;
