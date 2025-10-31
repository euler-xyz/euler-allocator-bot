import ENV from '@/constants/constants';
import { Allocation, EulerEarn, ReturnsDetails } from '@/types/types';
import { computeGreedyReturns } from '@/utils/greedyStrategy/computeGreedyReturns';
import {
  isAllocationAllowed,
  isMinAllocation,
  isOutsideSoftCap,
  isOverUtilized,
} from '@/utils/greedyStrategy/computeGreedySimAnnealing';
import { Address, isAddressEqual, maxUint256 } from 'viem';

const MAX_ITERATIONS = 250;
const SPREAD_EPSILON = 1e-6;

type StrategyApySnapshot = {
  address: Address;
  apy: number;
};

type CandidatePair = {
  source: StrategyApySnapshot;
  destination: StrategyApySnapshot;
  capacity: bigint;
  spread: number;
};

type UnifiedApyResult = {
  allocation: Allocation;
  totalReturns: number;
  details: ReturnsDetails;
  spread: number;
};

const combineApy = (returns: ReturnsDetails[Address]) => returns.interestAPY + returns.rewardsAPY;

const buildAllowedStrategies = (vault: EulerEarn) =>
  new Set(
    vault.initialAllocationQueue.filter(strategy => {
      if (!vault.idleVaultAddress) return true;
      return !isAddressEqual(strategy, vault.idleVaultAddress);
    }),
  );

const computeSpread = (
  allowedStrategies: Set<Address>,
  allocation: Allocation,
  details: ReturnsDetails,
) => {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  allowedStrategies.forEach(strategy => {
    if (!allocation[strategy]) return;
    if (allocation[strategy].newAmount === BigInt(0)) return;
    if (isMinAllocation(strategy, allocation)) return;

    const returns = details[strategy];
    if (!returns) return;
    const apy = combineApy(returns);

    if (apy < min) min = apy;
    if (apy > max) max = apy;
  });

  if (min === Number.POSITIVE_INFINITY || max === Number.NEGATIVE_INFINITY) return 0;
  return max - min;
};

const computeMaxTransfer = ({
  vault,
  source,
  destination,
  allocation,
  allowedStrategies,
}: {
  vault: EulerEarn;
  source: Address;
  destination: Address;
  allocation: Allocation;
  allowedStrategies: Set<Address>;
}) => {
  if (!allowedStrategies.has(source) || !allowedStrategies.has(destination)) return BigInt(0);

  const srcAllocation = allocation[source];
  const destAllocation = allocation[destination];
  if (!srcAllocation || !destAllocation) return BigInt(0);
  const srcDetails = vault.strategies[source].details;
  const destDetails = vault.strategies[destination].details;

  const srcMaxWithdraw = srcDetails.cash + srcAllocation.diff;
  const destSupplyCap =
    destDetails.supplyCap - destDetails.totalBorrows - destDetails.cash - destAllocation.diff;
  const destStrategyCap = vault.strategies[destination].cap - destAllocation.newAmount;

  if (srcAllocation.newAmount <= BigInt(0)) return BigInt(0);
  if (destSupplyCap <= BigInt(0) || destStrategyCap <= BigInt(0) || srcMaxWithdraw <= BigInt(0))
    return BigInt(0);

  let softCap = maxUint256;
  if (ENV.SOFT_CAPS[destination]) {
    softCap =
      destAllocation.newAmount < ENV.SOFT_CAPS[destination].max
        ? ENV.SOFT_CAPS[destination].max - destAllocation.newAmount
        : BigInt(0);
  }

  return [srcAllocation.newAmount, srcMaxWithdraw, destSupplyCap, destStrategyCap, softCap].reduce(
    (min, curr) => (curr < min ? curr : min),
  );
};

const applyTransfer = (
  allocation: Allocation,
  source: Address,
  destination: Address,
  amount: bigint,
) => {
  const updated = structuredClone(allocation);
  updated[source].newAmount -= amount;
  updated[source].diff -= amount;
  updated[destination].newAmount += amount;
  updated[destination].diff += amount;
  return updated;
};

const findCandidatePair = (
  vault: EulerEarn,
  allocation: Allocation,
  details: ReturnsDetails,
  allowedStrategies: Set<Address>,
): CandidatePair | undefined => {
  const snapshots: StrategyApySnapshot[] = [];

  allowedStrategies.forEach(strategy => {
    const returns = details[strategy];
    if (!returns) return;
    snapshots.push({
      address: strategy,
      apy: combineApy(returns),
    });
  });

  if (snapshots.length < 2) return undefined;

  const sources = snapshots
    .filter(
      ({ address }) => allocation[address]?.newAmount && !isMinAllocation(address, allocation),
    )
    .sort((a, b) => a.apy - b.apy);

  const destinations = snapshots
    .filter(({ address }) => Boolean(allocation[address]))
    .sort((a, b) => b.apy - a.apy);

  for (const source of sources) {
    for (const destination of destinations) {
      if (destination.address === source.address) continue;
      if (destination.apy <= source.apy + SPREAD_EPSILON) continue;

      const capacity = computeMaxTransfer({
        vault,
        source: source.address,
        destination: destination.address,
        allocation,
        allowedStrategies,
      });
      if (capacity > BigInt(0)) {
        return {
          source,
          destination,
          capacity,
          spread: destination.apy - source.apy,
        };
      }
    }
  }

  return undefined;
};

const isImprovement = (
  currentSpread: number,
  candidateSpread: number,
  currentReturns: number,
  candidateReturns: number,
) => {
  if (candidateSpread + SPREAD_EPSILON < currentSpread) return true;
  if (Math.abs(candidateSpread - currentSpread) <= SPREAD_EPSILON) {
    return candidateReturns >= currentReturns;
  }
  return false;
};

export const computeUnifiedApyAllocation = ({
  vault,
  initialAllocation,
}: {
  vault: EulerEarn;
  initialAllocation: Allocation;
}): UnifiedApyResult => {
  let currentAllocation = structuredClone(initialAllocation);
  let { totalReturns: currentReturns, details: currentDetails } = computeGreedyReturns({
    vault,
    allocation: currentAllocation,
  });

  let bestAllocation = structuredClone(currentAllocation);
  let bestReturns = currentReturns;
  let bestDetails = currentDetails;
  const allowedStrategies = buildAllowedStrategies(vault);
  let bestSpread = computeSpread(allowedStrategies, currentAllocation, currentDetails);

  const targetSpread = ENV.MAX_STRATEGY_APY_DIFF > 0 ? ENV.MAX_STRATEGY_APY_DIFF : undefined;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const currentSpread = computeSpread(allowedStrategies, currentAllocation, currentDetails);
    const utilizationIssue = isOverUtilized(currentDetails);
    const softCapIssue = isOutsideSoftCap(currentAllocation);

    if (
      !utilizationIssue &&
      !softCapIssue &&
      targetSpread &&
      currentSpread <= targetSpread + SPREAD_EPSILON
    ) {
      break;
    }

    const candidatePair = findCandidatePair(
      vault,
      currentAllocation,
      currentDetails,
      allowedStrategies,
    );
    if (!candidatePair) break;

    let transferAmount = candidatePair.capacity / BigInt(2);
    if (transferAmount === BigInt(0)) transferAmount = candidatePair.capacity;

    let improved = false;
    let attempt = transferAmount;
    while (attempt > BigInt(0)) {
      const nextAllocation = applyTransfer(
        currentAllocation,
        candidatePair.source.address,
        candidatePair.destination.address,
        attempt,
      );

      const { totalReturns: nextReturns, details: nextDetails } = computeGreedyReturns({
        vault,
        allocation: nextAllocation,
      });

      const nextSpread = computeSpread(allowedStrategies, nextAllocation, nextDetails);

      const allocationAllowed = isAllocationAllowed(
        currentAllocation,
        currentDetails,
        nextAllocation,
        nextDetails,
      );

      if (allocationAllowed) {
        if (isImprovement(currentSpread, nextSpread, currentReturns, nextReturns)) {
          currentAllocation = nextAllocation;
          currentReturns = nextReturns;
          currentDetails = nextDetails;
          improved = true;

          if (
            nextSpread + SPREAD_EPSILON < bestSpread ||
            (Math.abs(nextSpread - bestSpread) <= SPREAD_EPSILON && nextReturns > bestReturns)
          ) {
            bestAllocation = structuredClone(nextAllocation);
            bestReturns = nextReturns;
            bestDetails = nextDetails;
            bestSpread = nextSpread;
          }
          break;
        }
      }

      attempt /= BigInt(2);
    }

    if (!improved) break;
  }

  return {
    allocation: bestAllocation,
    totalReturns: bestReturns,
    details: bestDetails,
    spread: bestSpread,
  };
};

export const calculateApySpread = ({
  vault,
  allocation,
  returnsDetails,
}: {
  vault: EulerEarn;
  allocation: Allocation;
  returnsDetails: ReturnsDetails;
}) => {
  const allowedStrategies = buildAllowedStrategies(vault);
  return computeSpread(allowedStrategies, allocation, returnsDetails);
};
