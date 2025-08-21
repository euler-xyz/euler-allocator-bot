import { type AllocationDetails, allocationDetailsSchema, Strategies, type VaultDetails } from '@/types/types';
import { Address } from 'viem';

/**
 * @notice Greedily allocates funds to vaults in order of descending supply APY
 * @dev Respects vault supply caps and available cash constraints
 * @dev Returns amount in a dict so that it can be modified implicitly
 * @returns Tuple of [allocations per vault, remaining unallocated amount]
 */
function loopGreedy(
  vaultDetails: Record<string, VaultDetails>,
  strategies: Strategies,
  allocatableAmount: bigint,
) {
  const sortedVaultsDesc = Object.values(vaultDetails).sort(
    (a, b) => b.supplyAPY + b.rewardAPY - (a.supplyAPY + a.rewardAPY),
  );

  const allocations: Record<string, AllocationDetails> = {};
  let amountLeft = allocatableAmount;


  sortedVaultsDesc.forEach(vault => {
    const currentAmount = strategies.allocations[vault.vault];
    const strategyCapAvailable = strategies.caps[vault.vault] - currentAmount;
    const diff = amountLeft - currentAmount;
    let actualDiff = BigInt(0);
    if (diff > 0) {
      let availableToDeposit = vault.supplyCap - vault.cash - vault.totalBorrows;
      availableToDeposit =
      availableToDeposit <= strategyCapAvailable
      ? availableToDeposit
      : strategyCapAvailable;

      actualDiff = diff > availableToDeposit ? availableToDeposit : diff;
    } else if (diff < 0) {
      actualDiff = -diff > vault.cash ? -vault.cash : diff;
    }
    amountLeft -= actualDiff + currentAmount;

    allocations[vault.vault] = allocationDetailsSchema.parse({
      oldAmount: currentAmount,
      newAmount: currentAmount + actualDiff,
      diff: actualDiff,
    });
  });

  return [allocations, amountLeft] as const;
}

/**
 * @notice Handles case where initial allocation exceeds available amount
 * @dev Reduces allocations starting with lowest APY vaults until amount is balanced
 * @dev Modifies allocations and amountLeft from the main function
 */
function handleCornerCases(
  vaultDetails: Record<string, VaultDetails>,
  allocations: Record<string, AllocationDetails>,
  amountLeft: bigint,
) {
  const sortedVaultsAsc = Object.values(vaultDetails)
    .filter(vault => allocations[vault.vault].diff > 0)
    .sort((a, b) => a.supplyAPY + a.rewardAPY - (b.supplyAPY + b.rewardAPY));

  for (const vault of sortedVaultsAsc) {
    const allocation = allocations[vault.vault];
    const reduceBy = -amountLeft > allocation.diff ? allocation.diff : -amountLeft;
    allocation.newAmount -= reduceBy;
    allocation.diff -= reduceBy;
    amountLeft += reduceBy;
    if (amountLeft === BigInt(0)) break;
  }
}

/**
 * @notice Computes initial allocation of funds across vaults using a greedy strategy
 * @param vaultDetails Details of each vault including APY and constraints
 * @param strategyAmounts Current allocated amounts for each strategy
 * @param allocatableAmount Total amount available to allocate
 * @param cashAmount Required cash reserve amount
 * @returns Record mapping vault addresses to their allocation details
 */
export function computeGreedyInitAlloc({
  vaultDetails,
  strategies,
  allocatableAmount,
  cashAmount,
  idleVaultAddress,
}: {
  vaultDetails: Record<string, VaultDetails>;
  strategies: Strategies,
  allocatableAmount: bigint;
  cashAmount: bigint;
  idleVaultAddress: Address;
}) {
  const [allocations, amountLeft] = loopGreedy(
    vaultDetails,
    strategies,
    allocatableAmount,
  );

  if (amountLeft !== 0n) {
    throw new Error("Non-zero amount left")
    // handleCornerCases(vaultDetails, allocations, amountLeft);
  }

  allocations[idleVaultAddress].newAmount += cashAmount
  allocations[idleVaultAddress].diff += cashAmount

  return allocations;
}
