export const CONTRACT_VERSION = "nymrel.agent.route/v1" as const;
export const CONTRACT_VERSION_V2 = "nymrel.agent.route/v2" as const;
export const JOB_CONTRACT_VERSION = "nymrel.agent.job/v1" as const;
export const PRODUCT_VERSION = "0.3.1" as const;

export type TaskPhase = "research" | "plan" | "implement" | "review";
export type RiskClass = "read" | "workspace_write" | "external_side_effect";
export type DataBoundary = "local_only" | "approved_provider" | "zero_retention_provider";
export type HealthState = "healthy" | "degraded" | "unavailable";
export type Modality = "text" | "image" | "audio";
export type RouteObjective = "balanced" | "quality" | "cost" | "latency";

export interface CapabilitySet {
  readonly toolUse: boolean;
  readonly structuredOutput: boolean;
  readonly contextTokens: number;
  readonly modalities: readonly Modality[];
}

/** A caller-supplied, evidence-backed description of one model option. */
export interface ModelProfile {
  readonly modelId: string;
  readonly providerId: string;
  readonly health: HealthState;
  readonly healthCode?: string;
  readonly qualityScore: number;
  readonly reliabilityBasisPoints: number;
  readonly estimatedCostMicroUsd: number;
  readonly estimatedLatencyMs: number;
  readonly dataBoundaries: readonly DataBoundary[];
  readonly riskClasses: readonly RiskClass[];
  readonly capabilities: CapabilitySet;
}

export interface RouteRequirements {
  readonly toolUse: boolean;
  readonly structuredOutput: boolean;
  readonly minContextTokens: number;
  readonly modalities: readonly Modality[];
}

export interface RouteConstraints {
  readonly dataBoundary: DataBoundary;
  readonly maxCostMicroUsd?: number;
  readonly maxLatencyMs?: number;
}

export interface RouteRequest {
  readonly phase: TaskPhase;
  readonly risk: RiskClass;
  readonly objective: RouteObjective;
  readonly requirements: RouteRequirements;
  readonly constraints: RouteConstraints;
  readonly incumbentModelId?: string;
}

/** Explicit request-budget normalization for the v2 routing contract. */
export interface RouteNormalizationV2 {
  readonly basis: "request_budget";
  readonly costAnchorMicroUsd: number;
  readonly latencyAnchorMs: number;
}

export interface RouteRequestV2 extends RouteRequest {
  readonly normalization: RouteNormalizationV2;
}

export interface RouteScoreComponents {
  readonly quality: number;
  readonly reliability: number;
  readonly cost: number;
  readonly latency: number;
  readonly health: number;
  readonly stickiness: number;
}

export interface ScoredRouteCandidate {
  readonly modelId: string;
  readonly providerId: string;
  readonly score: number;
  readonly components: RouteScoreComponents;
}

export interface RejectedRouteCandidate {
  readonly modelId: string;
  readonly providerId: string;
  readonly reasonCodes: readonly string[];
}

export interface RoutePlan {
  readonly contractVersion: typeof CONTRACT_VERSION;
  readonly selectedModelId: string | null;
  readonly selectedProviderId: string | null;
  readonly objective: RouteObjective;
  readonly eligible: readonly ScoredRouteCandidate[];
  readonly rejected: readonly RejectedRouteCandidate[];
  readonly decisionCodes: readonly string[];
  readonly explanation: string;
}

export interface RouteScoreComponentsV2 {
  readonly quality: number;
  readonly reliability: number;
  readonly cost: number;
  readonly latency: number;
  readonly health: number;
}

export interface ScoredRouteCandidateV2 {
  readonly modelId: string;
  readonly providerId: string;
  readonly score: number;
  readonly components: RouteScoreComponentsV2;
}

export interface RoutePlanV2 {
  readonly contractVersion: typeof CONTRACT_VERSION_V2;
  readonly selectedModelId: string | null;
  readonly selectedProviderId: string | null;
  readonly objective: RouteObjective;
  readonly normalization: RouteNormalizationV2;
  readonly eligible: readonly ScoredRouteCandidateV2[];
  readonly rejected: readonly RejectedRouteCandidate[];
  readonly paretoFrontierModelIds: readonly string[];
  readonly decisionCodes: readonly string[];
  readonly explanation: string;
}

export interface PublicRoutePayload {
  readonly request: RouteRequest;
  readonly models: readonly ModelProfile[];
}

export interface PublicRoutePayloadV2 {
  readonly request: RouteRequestV2;
  readonly models: readonly ModelProfile[];
}

/** A prompt-free, local-only multi-step plan. It is never accepted by the hosted router. */
export interface JobStep {
  readonly stepId: string;
  readonly dependsOn: readonly string[];
  readonly request: RouteRequestV2;
}

export interface JobManifest {
  readonly contractVersion: typeof JOB_CONTRACT_VERSION;
  readonly jobId: string;
  readonly models: readonly ModelProfile[];
  readonly steps: readonly JobStep[];
}

export type JobPlanStatus = "ready" | "ready_with_handoffs" | "blocked";
export type JobStepExecution = "local_read_only_eligible" | "external_handoff_required";

export interface JobStepPlan {
  readonly ordinal: number;
  readonly stepId: string;
  readonly dependsOn: readonly string[];
  readonly phase: TaskPhase;
  readonly executionDisposition: JobStepExecution;
  readonly routePlan: RoutePlanV2;
  readonly reasonCodes: readonly string[];
}

export interface JobPlan {
  readonly contractVersion: typeof JOB_CONTRACT_VERSION;
  readonly jobId: string;
  readonly profile: "plan-only";
  readonly status: JobPlanStatus;
  readonly executionStatus: "not_started";
  readonly steps: readonly JobStepPlan[];
  readonly summary: {
    readonly totalSteps: number;
    readonly routableSteps: number;
    readonly blockedSteps: number;
    readonly localReadOnlyEligibleSteps: number;
    readonly externalHandoffRequiredSteps: number;
    readonly selectionsByModel: readonly {
      readonly modelId: string;
      readonly providerId: string;
      readonly stepCount: number;
    }[];
  };
  readonly decisionCodes: readonly string[];
}

export interface JobPlanReceipt {
  readonly contractVersion: typeof JOB_CONTRACT_VERSION;
  readonly receiptType: "job_plan";
  readonly profile: "plan-only";
  readonly status: "planned" | "blocked";
  readonly jobIdSha256: string;
  readonly manifestSha256: string;
  readonly planSha256: string;
  readonly counts: {
    readonly totalSteps: number;
    readonly routableSteps: number;
    readonly blockedSteps: number;
  };
  readonly steps: readonly {
    readonly ordinal: number;
    readonly routePlanSha256: string;
    readonly selectedModelId: string | null;
    readonly selectedProviderId: string | null;
  }[];
  readonly reasonCodes: readonly string[];
  readonly createdAt: string;
}

export interface PublicRouteResponse {
  readonly ok: true;
  readonly requestId: string;
  readonly plan: RoutePlan;
}

export interface PublicRouteResponseV2 {
  readonly ok: true;
  readonly requestId: string;
  readonly plan: RoutePlanV2;
}

export interface PublicErrorResponse {
  readonly ok: false;
  readonly requestId: string;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: readonly string[];
  };
}

export interface ProviderHealth {
  readonly modelId: string;
  readonly providerId: string;
  readonly state: HealthState;
  readonly code: string;
  readonly checkedAt: string;
}

export interface DoctorReport {
  readonly contractVersion: typeof CONTRACT_VERSION;
  readonly overall: "ready" | "not_ready";
  readonly checks: readonly ProviderHealth[];
}

export interface ProviderRunInput {
  readonly runId: string;
  readonly task: string;
  readonly phase: TaskPhase;
  readonly risk: RiskClass;
  readonly maxOutputTokens?: number;
}

export type ProviderRunEvent =
  | { readonly type: "delta"; readonly text: string }
  | { readonly type: "usage"; readonly inputTokens: number; readonly outputTokens: number };

export interface ProviderAdapter {
  readonly profile: ModelProfile;
  readonly executionKind: "synthetic" | "live";
  probe(checkedAt: string): Promise<ProviderHealth>;
  run(input: ProviderRunInput): AsyncIterable<ProviderRunEvent>;
}

export type RunEvent =
  | { readonly sequence: number; readonly at: string; readonly type: "run.started"; readonly runId: string }
  | { readonly sequence: number; readonly at: string; readonly type: "route.selected"; readonly modelId: string; readonly providerId: string; readonly decisionCodes: readonly string[] }
  | { readonly sequence: number; readonly at: string; readonly type: "provider.chunk"; readonly modelId: string; readonly byteLength: number }
  | { readonly sequence: number; readonly at: string; readonly type: "run.blocked"; readonly reasonCodes: readonly string[] }
  | { readonly sequence: number; readonly at: string; readonly type: "run.failed"; readonly reasonCode: string }
  | { readonly sequence: number; readonly at: string; readonly type: "run.completed"; readonly modelId: string };

export type RunStatus = "completed" | "blocked" | "failed";
export type RunProfile = "read-only";

export interface RunReceipt {
  readonly contractVersion: typeof CONTRACT_VERSION;
  readonly runId: string;
  readonly status: RunStatus;
  readonly profile: RunProfile;
  readonly inputSha256: string;
  readonly outputSha256?: string;
  readonly eventDigestSha256: string;
  readonly selectedModelId: string | null;
  readonly selectedProviderId: string | null;
  readonly reasonCodes: readonly string[];
  readonly usage: { readonly inputTokens: number; readonly outputTokens: number };
  readonly startedAt: string;
  readonly endedAt: string;
}

export interface RunRequest {
  readonly task: string;
  readonly profile: RunProfile;
  readonly route: RouteRequest;
  readonly maxOutputTokens?: number;
}

export interface RunResult {
  readonly output?: string;
  readonly plan: RoutePlan;
  readonly events: readonly RunEvent[];
  readonly receipt: RunReceipt;
}
