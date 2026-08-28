import type { ModelProfile, RouteObjective, RouteScoreComponentsV2, RouteRequestV2, ScoredRouteCandidateV2 } from "./contracts.js";
import { compareCodeUnits } from "./ordering.js";

export const V2_OBJECTIVE_WEIGHTS: Readonly<Record<RouteObjective, Readonly<RouteScoreComponentsV2>>> = {
  balanced: { quality: 35, reliability: 25, cost: 20, latency: 15, health: 5 },
  quality: { quality: 60, reliability: 25, cost: 5, latency: 5, health: 5 },
  cost: { quality: 20, reliability: 20, cost: 45, latency: 10, health: 5 },
  latency: { quality: 20, reliability: 20, cost: 10, latency: 45, health: 5 },
};

/**
 * Deterministic integer request-budget utility. BigInt keeps every accepted
 * safe-integer input exact while preserving Math.round's positive half-up rule.
 */
export function requestBudgetUtility(anchor: number, value: number): number {
  if (!Number.isSafeInteger(anchor) || anchor <= 0 || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("Invalid request-budget normalization inputs");
  }
  if (value >= anchor) return 0;
  const numerator = (BigInt(anchor) - BigInt(value)) * 10_000n;
  const denominator = BigInt(anchor);
  const rounded = (2n * numerator + denominator) / (2n * denominator);
  return Number(rounded > 10_000n ? 10_000n : rounded);
}

export function v2ScoreCandidate(request: RouteRequestV2, profile: ModelProfile): ScoredRouteCandidateV2 {
  const weights = V2_OBJECTIVE_WEIGHTS[request.objective];
  const utility = {
    quality: profile.qualityScore * 100,
    reliability: profile.reliabilityBasisPoints,
    cost: requestBudgetUtility(request.normalization.costAnchorMicroUsd, profile.estimatedCostMicroUsd),
    latency: requestBudgetUtility(request.normalization.latencyAnchorMs, profile.estimatedLatencyMs),
    health: profile.health === "healthy" ? 10_000 : 4_000,
  };
  const components: RouteScoreComponentsV2 = {
    quality: Math.round((utility.quality * weights.quality) / 100),
    reliability: Math.round((utility.reliability * weights.reliability) / 100),
    cost: Math.round((utility.cost * weights.cost) / 100),
    latency: Math.round((utility.latency * weights.latency) / 100),
    health: Math.round((utility.health * weights.health) / 100),
  };
  return { modelId: profile.modelId, providerId: profile.providerId, score: Object.values(components).reduce((sum, value) => sum + value, 0), components };
}

function dominates(left: ModelProfile, right: ModelProfile): boolean {
  const leftHealth = left.health === "healthy" ? 10_000 : 4_000;
  const rightHealth = right.health === "healthy" ? 10_000 : 4_000;
  const noWorse = left.qualityScore >= right.qualityScore &&
    left.reliabilityBasisPoints >= right.reliabilityBasisPoints &&
    leftHealth >= rightHealth &&
    left.estimatedCostMicroUsd <= right.estimatedCostMicroUsd &&
    left.estimatedLatencyMs <= right.estimatedLatencyMs;
  const strictlyBetter = left.qualityScore > right.qualityScore ||
    left.reliabilityBasisPoints > right.reliabilityBasisPoints ||
    leftHealth > rightHealth ||
    left.estimatedCostMicroUsd < right.estimatedCostMicroUsd ||
    left.estimatedLatencyMs < right.estimatedLatencyMs;
  return noWorse && strictlyBetter;
}

/** Returns the non-dominated hard-eligible candidates in stable code-unit order. */
export function paretoFrontier(profiles: readonly ModelProfile[]): readonly ModelProfile[] {
  return profiles
    .filter((candidate) => !profiles.some((other) => other !== candidate && dominates(other, candidate)))
    .sort((a, b) => compareCodeUnits(a.modelId, b.modelId) || compareCodeUnits(a.providerId, b.providerId));
}
