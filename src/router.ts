import {
  CONTRACT_VERSION,
  type ModelProfile,
  type RejectedRouteCandidate,
  type RoutePlan,
  type RouteRequest,
  type RouteScoreComponents,
  type ScoredRouteCandidate,
} from "./contracts.js";

const PROFILE_INVALID = "profile_invalid";

function validProfile(profile: ModelProfile): boolean {
  return (
    profile.modelId.length > 0 &&
    profile.providerId.length > 0 &&
    Number.isInteger(profile.qualityScore) &&
    profile.qualityScore >= 0 &&
    profile.qualityScore <= 100 &&
    Number.isInteger(profile.reliabilityBasisPoints) &&
    profile.reliabilityBasisPoints >= 0 &&
    profile.reliabilityBasisPoints <= 10_000 &&
    Number.isInteger(profile.estimatedCostMicroUsd) &&
    profile.estimatedCostMicroUsd >= 0 &&
    Number.isInteger(profile.estimatedLatencyMs) &&
    profile.estimatedLatencyMs >= 0 &&
    Number.isInteger(profile.capabilities.contextTokens) &&
    profile.capabilities.contextTokens >= 0
  );
}

function rejectionReasons(request: RouteRequest, profile: ModelProfile): string[] {
  const reasons: string[] = [];
  if (!validProfile(profile)) reasons.push(PROFILE_INVALID);
  if (profile.health === "unavailable") reasons.push("health_unavailable");
  if (!profile.dataBoundaries.includes(request.constraints.dataBoundary)) {
    reasons.push("data_boundary_unsupported");
  }
  if (request.requirements.toolUse && !profile.capabilities.toolUse) {
    reasons.push("tool_use_unsupported");
  }
  if (request.requirements.structuredOutput && !profile.capabilities.structuredOutput) {
    reasons.push("structured_output_unsupported");
  }
  if (profile.capabilities.contextTokens < request.requirements.minContextTokens) {
    reasons.push("context_too_small");
  }
  const missingModalities = request.requirements.modalities.filter(
    (modality) => !profile.capabilities.modalities.includes(modality),
  );
  if (missingModalities.length > 0) reasons.push("modality_unsupported");
  if (
    request.constraints.maxCostMicroUsd !== undefined &&
    profile.estimatedCostMicroUsd > request.constraints.maxCostMicroUsd
  ) {
    reasons.push("cost_budget_exceeded");
  }
  if (
    request.constraints.maxLatencyMs !== undefined &&
    profile.estimatedLatencyMs > request.constraints.maxLatencyMs
  ) {
    reasons.push("latency_budget_exceeded");
  }
  return [...new Set(reasons)].sort();
}

function scoreCandidate(request: RouteRequest, profile: ModelProfile): ScoredRouteCandidate {
  const components: RouteScoreComponents = {
    quality: profile.qualityScore * 100,
    reliability: profile.reliabilityBasisPoints,
    costPenalty: -Math.round(profile.estimatedCostMicroUsd / 1_000),
    latencyPenalty: -Math.round(profile.estimatedLatencyMs / 10),
    healthPenalty: profile.health === "degraded" ? -1_000 : 0,
    stickinessBonus: request.incumbentModelId === profile.modelId ? 250 : 0,
  };
  const score = Object.values(components).reduce((sum, value) => sum + value, 0);
  return { modelId: profile.modelId, score, components };
}

export function route(request: RouteRequest, profiles: readonly ModelProfile[]): RoutePlan {
  if (request.risk !== "read") {
    return {
      contractVersion: CONTRACT_VERSION,
      selectedModelId: null,
      eligible: [],
      rejected: profiles
        .map((profile) => ({ modelId: profile.modelId, reasonCodes: ["phase0_non_read_rejected"] }))
        .sort((a, b) => a.modelId.localeCompare(b.modelId)),
      decisionCodes: ["policy_blocked", "phase0_non_read_rejected"],
      explanation: "Phase 0 routes read-only work only; the request was rejected before model selection.",
    };
  }

  const ids = new Set<string>();
  const eligible: ScoredRouteCandidate[] = [];
  const rejected: RejectedRouteCandidate[] = [];

  for (const profile of [...profiles].sort((a, b) => a.modelId.localeCompare(b.modelId))) {
    const reasons = rejectionReasons(request, profile);
    if (ids.has(profile.modelId)) reasons.push("duplicate_model_id");
    ids.add(profile.modelId);
    if (reasons.length > 0) {
      rejected.push({ modelId: profile.modelId, reasonCodes: [...new Set(reasons)].sort() });
    } else {
      eligible.push(scoreCandidate(request, profile));
    }
  }

  eligible.sort((a, b) => b.score - a.score || a.modelId.localeCompare(b.modelId));
  const selectedModelId = eligible[0]?.modelId ?? null;
  const decisionCodes = selectedModelId
    ? ["eligible_candidates_ranked", "deterministic_tie_break", "model_selected"]
    : ["no_eligible_model", "policy_blocked"];

  return {
    contractVersion: CONTRACT_VERSION,
    selectedModelId,
    eligible,
    rejected,
    decisionCodes,
    explanation: selectedModelId
      ? `Selected ${selectedModelId} from ${eligible.length} eligible model(s); ${rejected.length} model(s) were rejected by explicit constraints.`
      : `No model satisfied the explicit health, capability, boundary, cost, and latency constraints.`,
  };
}
