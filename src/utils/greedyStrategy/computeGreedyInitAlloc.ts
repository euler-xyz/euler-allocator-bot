import { Allocation, allocationDetailsSchema, EulerEarn } from '@/types/types';

/**
 * @notice Greedily allocates funds to vaults in order of descending supply APY
 * @dev Respects vault supply caps and available cash constraints
 * @dev Returns amount in a dict so that it can be modified implicitly
 * @returns Tuple of [allocations per vault, remaining unallocated amount]
 */
function loopGreedy(vault: EulerEarn, allocatableAmount: bigint) {
  const sortedVaultsDesc = Object.entries(vault.strategies).sort(
    ([, a], [, b]) =>
      b.details.supplyAPY + b.details.rewardAPY - (a.details.supplyAPY + a.details.rewardAPY),
  );

  const allocations: Allocation = {};
  let amountLeft = allocatableAmount;

  sortedVaultsDesc.forEach(([strategyAddress, strategy]) => {
    const currentAmount = strategy.allocation;
    console.log('currentAmount: ', currentAmount);
    const strategyCapAvailable = strategy.cap - currentAmount;
    const diff = amountLeft - currentAmount;
    console.log('strategyAddress: ', strategyAddress);
    console.log('diff: ', diff);
    let actualDiff = BigInt(0);
    if (diff > 0) {
      let availableToDeposit =
      strategy.details.supplyCap - strategy.details.cash - strategy.details.totalBorrows;
      availableToDeposit =
      availableToDeposit <= strategyCapAvailable ? availableToDeposit : strategyCapAvailable;
      
      actualDiff = diff > availableToDeposit ? availableToDeposit : diff;
    } else if (diff < 0) {
      console.log('diff: ', diff);
      console.log('strategy.details.cash: ', strategy.details.cash);
      actualDiff = -diff > strategy.details.cash ? -strategy.details.cash : diff;
      console.log('actualDiff: ', actualDiff);
    }
    amountLeft -= actualDiff + currentAmount;
    console.log('amountLeft: ', amountLeft);

    allocations[strategyAddress] = allocationDetailsSchema.parse({
      oldAmount: currentAmount,
      newAmount: currentAmount + actualDiff,
      diff: actualDiff,
    });
  });

  return [allocations, amountLeft] as const;
}

// /**
//  * @notice Handles case where initial allocation exceeds available amount
//  * @dev Reduces allocations starting with lowest APY vaults until amount is balanced
//  * @dev Modifies allocations and amountLeft from the main function
//  */
// function handleCornerCases(
//   vaultDetails: Record<string, StrategyDetails>,
//   allocations: Record<string, AllocationDetails>,
//   amountLeft: bigint,
// ) {
//   const sortedVaultsAsc = Object.values(vaultDetails)
//     .filter(vault => allocations[vault.vault].diff > 0)
//     .sort((a, b) => a.supplyAPY + a.rewardAPY - (b.supplyAPY + b.rewardAPY));

//   for (const vault of sortedVaultsAsc) {
//     const allocation = allocations[vault.vault];
//     const reduceBy = -amountLeft > allocation.diff ? allocation.diff : -amountLeft;
//     allocation.newAmount -= reduceBy;
//     allocation.diff -= reduceBy;
//     amountLeft += reduceBy;
//     if (amountLeft === BigInt(0)) break;
//   }
// }

/**
 * @notice Computes initial allocation of funds across vaults using a greedy strategy
 * @param vault Details of EulerEarn vault
 * @param allocatableAmount Total amount available to allocate
 * @param cashAmount Required cash reserve amount
 * @returns Record mapping vault addresses to their allocation details
 */
export function computeGreedyInitAlloc({
  vault,
  allocatableAmount,
  cashAmount,
}: {
  vault: EulerEarn;
  allocatableAmount: bigint;
  cashAmount: bigint;
}) {
  const [allocations, amountLeft] = loopGreedy(vault, allocatableAmount);
  console.log('amountLeft: ', amountLeft);
  console.log('allocations: ', allocations);

  if (amountLeft !== 0n) {
    throw new Error('Non-zero amount left');
    // handleCornerCases(vaultDetails, allocations, amountLeft);
  }

  allocations[vault.idleVaultAddress].newAmount += cashAmount;
  allocations[vault.idleVaultAddress].diff += cashAmount;

  return allocations;
}
