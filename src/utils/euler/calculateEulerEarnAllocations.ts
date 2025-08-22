import { AllocationDetails } from "@/types/types";
import { parseContractAddress } from "../common/parser";
import { maxUint256 } from "viem";

export function calculateEulerEarnAllocations(allocation: Record<string, AllocationDetails>) {
  // withdrawals must come first
  const sorted = Object.entries(allocation).sort(([_, a], [__,b ]) => {
    return a.diff < b.diff ? -1 : 1
  })

  return sorted.map(([strategy, { newAmount }], index, array) => ({
    id: parseContractAddress(strategy),
    // the last deposit should be maxUint to deposit any extra withdrawn
    assets: index === array.length - 1 ? maxUint256 : newAmount,
  }))
}