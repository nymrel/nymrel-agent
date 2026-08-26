import {
  CONTRACT_VERSION,
  type ModelProfile,
  type RejectedRouteCandidate,
  type RouteObjective,
  type RoutePlan,
  type RouteRequest,
  type RouteScoreComponents,
  type ScoredRouteCandidate,
} from "./contracts.js";
import { compareCodeUnits } from "./ordering.js";
import { parsePublicRoutePayload } from "./validation.js";

const PROFILE_INVALID = "profile_invalid";
const HEALTH_STATES = new Set(["healthy", "degraded", "unavailable"]);
const DATA_BOUNDARIES = new Set(["local_only", "approved_provider", "zero_retention_provider"]);
const RISK_CLASSES = new Set(["read", "workspace_write", "external_side_effect"]);
const MODALITIES = new Set(["text", "image", "audio"]);
const OBJECTIVE_WEIGHTS: Readonly<Record<RouteObjective, Readonly<Omit<RouteScoreComponents, "stickiness">>>> = {
  balanced: { quality: 35, reliability: 25, cost: 20, latency: 15, health: 5 },
  quality: { quality: 60, reliability: 25, cost: 5, latency: 5, health: 5 },
  cost: { quality: 20, reliability: 20, cost: 45, latency: 10, health: 5 },
  latency: { quality: 20, reliability: 20, cost: 10, latency: 45, health: 5 },
};

function unique<T>(values: readonly T[]): boolean {
  return new Set(values).size === values.length;
}

function validProfile(profile: ModelProfile): boolean {
  return (
    profile.modelId.length > 0 && profile.modelId.length <= 160 &&
    profile.providerId.length > 0 && profile.providerId.length <= 80 &&
    Number.isInteger(profile.qualityScore) && profile.qualityScore >= 0 && profile.qualityScore <= 100 &&
    Number.isInteger(profile.reliabilityBasisPoints) && profile.reliabilityBasisPoints >= 0 && profile.reliabilityBasisPoints <= 10_000 &&
    Number.isSafeInteger(profile.estimatedCostMicroUsd) && profile.estimatedCostMicroUsd >= 0 &&
    Number.isSafeInteger(profile.estimatedLatencyMs) && profile.estimatedLatencyMs >= 0 &&
    Number.isSafeInteger(profile.capabilities.contextTokens) && profile.capabilities.contextTokens >= 1 &&
    profile.dataBoundaries.length > 0 && profile.riskClasses.length > 0 &&
    profile.capabilities.modalities.length > 0 && unique(profile.dataBoundaries) &&
    unique(profile.riskClasses) && unique(profile.capabilities.modalities) &&
    HEALTH_STATES.has(profile.health) && profile.dataBoundaries.every((value) => DATA_BOUNDARIES.has(value)) &&
    profile.riskClasses.every((value) => RISK_CLASSES.has(value)) &&
    profile.capabilities.modalities.every((value) => MODALITIES.has(value))
  );
}

function rejectionReasons(request: RouteRequest, profile: ModelProfile): string[] {
  const reasons: string[] = [];
  if (!validProfile(profile)) reasons.push(PROFILE_INVALID);
  if (profile.health === "unavailable") reasons.push("health_unavailable");
  if (profile.healthCode === "probe_failed") reasons.push("probe_failed");
  if (!profile.dataBoundaries.includes(request.constraints.dataBoundary)) reasons.push("data_boundary_unsupported");
  if (!profile.riskClasses.includes(request.risk)) reasons.push("risk_class_unsupported");
  if (request.requirements.toolUse && !profile.capabilities.toolUse) reasons.push("tool_use_unsupported");
  if (request.requirements.structuredOutput && !profile.capabilities.structuredOutput) reasons.push("structured_output_unsupported");
  if (profile.capabilities.contextTokens < request.requirements.minContextTokens) reasons.push("context_too_small");
  if (request.requirements.modalities.some((modality) => !profile.capabilities.modalities.includes(modality))) reasons.push("modality_unsupported");
  if (request.constraints.maxCostMicroUsd !== undefined && profile.estimatedCostMicroUsd > request.constraints.maxCostMicroUsd) reasons.push("cost_budget_exceeded");
  if (request.constraints.maxLatencyMs !== undefined && profile.estimatedLatencyMs > request.constraints.maxLatencyMs) reasons.push("latency_budget_exceeded");
  return [...new Set(reasons)].sort(compareCodeUnits);
}

function relativeUtility(value: number, minimum: number, maximum: number): number {
  if (maximum === minimum) return 10_000;
  return Math.round(((maximum - value) / (maximum - minimum)) * 10_000);
}

function ceilingUtility(value: number, maximum: number): number {
  if (maximum === 0) return 10_000;
  return Math.max(0, Math.min(10_000, Math.round(((maximum - value) / maximum) * 10_000)));
}

interface CandidateRange { readonly minCost: number; readonly maxCost: number; readonly minLatency: number; readonly maxLatency: number }

interface ScoreNormalizationBasis {
  readonly mode: "request_ceiling" | "eligible_set_range";
  readonly minimum: number;
  readonly maximum: number;
}

function scoreCandidate(request: RouteRequest, profile: ModelProfile, range: CandidateRange): ScoredRouteCandidate {
  const weights = OBJECTIVE_WEIGHTS[request.objective];
  const utility = {
    quality: profile.qualityScore * 100,
    reliability: profile.reliabilityBasisPoints,
    cost: request.constraints.maxCostMicroUsd === undefined
      ? relativeUtility(profile.estimatedCostMicroUsd, range.minCost, range.maxCost)
      : ceilingUtility(profile.estimatedCostMicroUsd, request.constraints.maxCostMicroUsd),
    latency: request.constraints.maxLatencyMs === undefined
      ? relativeUtility(profile.estimatedLatencyMs, range.minLatency, range.maxLatency)
      : ceilingUtility(profile.estimatedLatencyMs, request.constraints.maxLatencyMs),
    health: profile.health === "healthy" ? 10_000 : 4_000,
  };
  const components: RouteScoreComponents = {
    quality: Math.round((utility.quality * weights.quality) / 100),
    reliability: Math.round((utility.reliability * weights.reliability) / 100),
    cost: Math.round((utility.cost * weights.cost) / 100),
    latency: Math.round((utility.latency * weights.latency) / 100),
    health: Math.round((utility.health * weights.health) / 100),
    stickiness: request.incumbentModelId === profile.modelId ? 250 : 0,
  };
  return { modelId: profile.modelId, providerId: profile.providerId, score: Object.values(components).reduce((sum, value) => sum + value, 0), components };
}

function routeValidated(request: RouteRequest, profiles: readonly ModelProfile[]): RoutePlan {
  if (!Object.hasOwn(OBJECTIVE_WEIGHTS, request.objective)) throw new Error("Unsupported routing objective");
  const idCounts = new Map<string, number>();
  for (const profile of profiles) idCounts.set(profile.modelId, (idCounts.get(profile.modelId) ?? 0) + 1);

  const acceptedProfiles: ModelProfile[] = [];
  const rejected: RejectedRouteCandidate[] = [];
  for (const profile of [...profiles].sort((a, b) => compareCodeUnits(a.modelId, b.modelId) || compareCodeUnits(a.providerId, b.providerId))) {
    const reasons = rejectionReasons(request, profile);
    if ((idCounts.get(profile.modelId) ?? 0) > 1) reasons.push("duplicate_model_id");
    if (reasons.length > 0) rejected.push({ modelId: profile.modelId, providerId: profile.providerId, reasonCodes: [...new Set(reasons)].sort(compareCodeUnits) });
    else acceptedProfiles.push(profile);
  }

  const costs = acceptedProfiles.map((profile) => profile.estimatedCostMicroUsd);
  const latencies = acceptedProfiles.map((profile) => profile.estimatedLatencyMs);
  const range: CandidateRange = {
    minCost: costs.length === 0 ? 0 : Math.min(...costs),
    maxCost: costs.length === 0 ? 0 : Math.max(...costs),
    minLatency: latencies.length === 0 ? 0 : Math.min(...latencies),
    maxLatency: latencies.length === 0 ? 0 : Math.max(...latencies),
  };
  const eligible = acceptedProfiles.map((profile) => scoreCandidate(request, profile, range));
  eligible.sort((a, b) => b.score - a.score || compareCodeUnits(a.modelId, b.modelId) || compareCodeUnits(a.providerId, b.providerId));
  const selected = eligible[0];
  const scoreNormalization: { readonly cost: ScoreNormalizationBasis; readonly latency: ScoreNormalizationBasis } = {
    cost: request.constraints.maxCostMicroUsd === undefined
      ? { mode: "eligible_set_range", minimum: range.minCost, maximum: range.maxCost }
      : { mode: "request_ceiling", minimum: 0, maximum: request.constraints.maxCostMicroUsd },
    latency: request.constraints.maxLatencyMs === undefined
      ? { mode: "eligible_set_range", minimum: range.minLatency, maximum: range.maxLatency }
      : { mode: "request_ceiling", minimum: 0, maximum: request.constraints.maxLatencyMs },
  };
  const decisionCodes = selected
    ? [
        `objective_${request.objective}`,
        `cost_normalized_to_${scoreNormalization.cost.mode}`,
        `latency_normalized_to_${scoreNormalization.latency.mode}`,
        "eligible_candidates_ranked",
        "deterministic_tie_break",
        "model_selected",
      ]
    : ["no_eligible_model", "policy_blocked"];

  return {
    contractVersion: CONTRACT_VERSION,
    selectedModelId: selected?.modelId ?? null,
    selectedProviderId: selected?.providerId ?? null,
    objective: request.objective,
    eligible,
    rejected,
    decisionCodes,
    explanation: selected
      ? `Selected ${selected.modelId} from ${eligible.length} eligible model(s) for the ${request.objective} objective; ${rejected.length} model(s) were rejected by explicit constraints. Cost normalization used ${scoreNormalization.cost.mode} bounds [${scoreNormalization.cost.minimum}, ${scoreNormalization.cost.maximum}] micro-USD; latency normalization used ${scoreNormalization.latency.mode} bounds [${scoreNormalization.latency.minimum}, ${scoreNormalization.latency.maximum}] ms.`
      : "No model satisfied the explicit health, risk, capability, data-boundary, cost, and latency constraints.",
  };
}

/**
 * Public package boundary. TypeScript annotations disappear at runtime, so
 * every JavaScript caller is parsed before the scoring code can dereference a
 * request or profile. Invalid shapes fail with the same stable NymrelError
 * used by the HTTP, CLI, and MCP surfaces instead of a TypeError.
 */
export function route(requestValue: unknown, profilesValue: unknown): RoutePlan {
  const payload = parsePublicRoutePayload({ request: requestValue, models: profilesValue });
  return routeValidated(payload.request, payload.models);
}
