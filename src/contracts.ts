export const CONTRACT_VERSION = "nymrel.agent.phase0/v1" as const;

export type TaskPhase = "research" | "plan" | "implement" | "review";
export type RiskClass = "read" | "workspace_write" | "external_side_effect";
export type DataBoundary = "local_only" | "approved_provider";
export type HealthState = "healthy" | "degraded" | "unavailable";
export type Modality = "text" | "image" | "audio";

export interface CapabilitySet {
  readonly toolUse: boolean;
  readonly structuredOutput: boolean;
  readonly contextTokens: number;
  readonly modalities: readonly Modality[];
}

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
  readonly requirements: RouteRequirements;
  readonly constraints: RouteConstraints;
  readonly incumbentModelId?: string;
}

export interface RouteScoreComponents {
  readonly quality: number;
  readonly reliability: number;
  readonly costPenalty: number;
  readonly latencyPenalty: number;
  readonly healthPenalty: number;
  readonly stickinessBonus: number;
}

export interface ScoredRouteCandidate {
  readonly modelId: string;
  readonly score: number;
  readonly components: RouteScoreComponents;
}

export interface RejectedRouteCandidate {
  readonly modelId: string;
  readonly reasonCodes: readonly string[];
}

export interface RoutePlan {
  readonly contractVersion: typeof CONTRACT_VERSION;
  readonly selectedModelId: string | null;
  readonly eligible: readonly ScoredRouteCandidate[];
  readonly rejected: readonly RejectedRouteCandidate[];
  readonly decisionCodes: readonly string[];
  readonly explanation: string;
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
  readonly risk: "read";
}

export type ProviderRunEvent =
  | { readonly type: "delta"; readonly text: string }
  | {
      readonly type: "usage";
      readonly inputTokens: number;
      readonly outputTokens: number;
    };

export interface ProviderAdapter {
  readonly profile: ModelProfile;
  readonly executionKind: "synthetic" | "live";
  probe(checkedAt: string): Promise<ProviderHealth>;
  run(input: ProviderRunInput): AsyncIterable<ProviderRunEvent>;
}

export type RunEvent =
  | {
      readonly sequence: number;
      readonly at: string;
      readonly type: "run.started";
      readonly runId: string;
    }
  | {
      readonly sequence: number;
      readonly at: string;
      readonly type: "route.selected";
      readonly modelId: string;
      readonly decisionCodes: readonly string[];
    }
  | {
      readonly sequence: number;
      readonly at: string;
      readonly type: "provider.chunk";
      readonly modelId: string;
      readonly byteLength: number;
    }
  | {
      readonly sequence: number;
      readonly at: string;
      readonly type: "run.blocked";
      readonly reasonCodes: readonly string[];
    }
  | {
      readonly sequence: number;
      readonly at: string;
      readonly type: "run.failed";
      readonly reasonCode: string;
    }
  | {
      readonly sequence: number;
      readonly at: string;
      readonly type: "run.completed";
      readonly modelId: string;
    };

export type RunStatus = "completed" | "blocked" | "failed";

export interface RunReceipt {
  readonly contractVersion: typeof CONTRACT_VERSION;
  readonly runId: string;
  readonly status: RunStatus;
  readonly profile: "read-only";
  readonly inputSha256: string;
  readonly outputSha256?: string;
  readonly eventDigestSha256: string;
  readonly selectedModelId: string | null;
  readonly reasonCodes: readonly string[];
  readonly usage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
  };
  readonly startedAt: string;
  readonly endedAt: string;
}

export interface RunRequest {
  readonly task: string;
  readonly profile: "read-only";
  readonly route: RouteRequest;
}

export interface RunResult {
  readonly output?: string;
  readonly plan: RoutePlan;
  readonly events: readonly RunEvent[];
  readonly receipt: RunReceipt;
}
