import type {
  DataBoundary,
  HealthState,
  ModelProfile,
  Modality,
  PublicRoutePayload,
  RiskClass,
  RouteObjective,
  RouteRequest,
  TaskPhase,
} from "./contracts.js";
import { NymrelError } from "./errors.js";

const TASK_PHASES = ["research", "plan", "implement", "review"] as const;
const RISKS = ["read", "workspace_write", "external_side_effect"] as const;
const BOUNDARIES = ["local_only", "approved_provider", "zero_retention_provider"] as const;
const HEALTH_STATES = ["healthy", "degraded", "unavailable"] as const;
const MODALITIES = ["text", "image", "audio"] as const;
const OBJECTIVES = ["balanced", "quality", "cost", "latency"] as const;

type RecordValue = Record<string, unknown>;

function invalid(path: string, message: string): never {
  throw new NymrelError("invalid_request", "The routing payload is invalid.", 400, [`${path}: ${message}`]);
}

function record(value: unknown, path: string, keys: readonly string[]): RecordValue {
  if (value === null || typeof value !== "object" || Array.isArray(value)) invalid(path, "must be an object");
  const result = value as RecordValue;
  const unexpected = Object.keys(result).filter((key) => !keys.includes(key));
  if (unexpected.length > 0) invalid(path, "contains unsupported fields");
  return result;
}

function textValue(value: unknown, path: string, maximum: number): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maximum || value.trim() !== value || /[\u0000-\u001f\u007f]/.test(value)) {
    invalid(path, `must be a non-empty string of at most ${maximum} characters`);
  }
  return value;
}

function identifier(value: unknown, path: string, maximum: number): string {
  const result = textValue(value, path, maximum);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/@+~-]*$/.test(result)) invalid(path, "contains unsupported identifier characters");
  return result;
}

function optionalText(value: unknown, path: string, maximum: number): string | undefined {
  if (value === undefined) return undefined;
  return textValue(value, path, maximum);
}

function bool(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") invalid(path, "must be a boolean");
  return value;
}

function integer(value: unknown, path: string, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    invalid(path, `must be an integer from ${minimum} to ${maximum}`);
  }
  return value as number;
}

function optionalInteger(value: unknown, path: string, minimum: number, maximum: number): number | undefined {
  if (value === undefined) return undefined;
  return integer(value, path, minimum, maximum);
}

function enumValue<T extends string>(value: unknown, path: string, options: readonly T[]): T {
  if (typeof value !== "string" || !options.includes(value as T)) invalid(path, `must be one of ${options.join(", ")}`);
  return value as T;
}

function enumArray<T extends string>(value: unknown, path: string, options: readonly T[], maximum: number): T[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > maximum) invalid(path, `must be an array with 1 to ${maximum} entries`);
  const entries = value.map((entry, index) => enumValue(entry, `${path}[${index}]`, options));
  if (new Set(entries).size !== entries.length) invalid(path, "must not contain duplicates");
  return entries;
}

function parseModel(value: unknown, index: number): ModelProfile {
  const path = `models[${index}]`;
  const row = record(value, path, [
    "modelId", "providerId", "health", "healthCode", "qualityScore",
    "reliabilityBasisPoints", "estimatedCostMicroUsd", "estimatedLatencyMs",
    "dataBoundaries", "riskClasses", "capabilities",
  ]);
  const capabilities = record(row.capabilities, `${path}.capabilities`, ["toolUse", "structuredOutput", "contextTokens", "modalities"]);
  const healthCode = optionalText(row.healthCode, `${path}.healthCode`, 120);
  return {
    modelId: identifier(row.modelId, `${path}.modelId`, 160),
    providerId: identifier(row.providerId, `${path}.providerId`, 80),
    health: enumValue<HealthState>(row.health, `${path}.health`, HEALTH_STATES),
    ...(healthCode === undefined ? {} : { healthCode }),
    qualityScore: integer(row.qualityScore, `${path}.qualityScore`, 0, 100),
    reliabilityBasisPoints: integer(row.reliabilityBasisPoints, `${path}.reliabilityBasisPoints`, 0, 10_000),
    estimatedCostMicroUsd: integer(row.estimatedCostMicroUsd, `${path}.estimatedCostMicroUsd`, 0, 1_000_000_000),
    estimatedLatencyMs: integer(row.estimatedLatencyMs, `${path}.estimatedLatencyMs`, 0, 600_000),
    dataBoundaries: enumArray<DataBoundary>(row.dataBoundaries, `${path}.dataBoundaries`, BOUNDARIES, 3),
    riskClasses: enumArray<RiskClass>(row.riskClasses, `${path}.riskClasses`, RISKS, 3),
    capabilities: {
      toolUse: bool(capabilities.toolUse, `${path}.capabilities.toolUse`),
      structuredOutput: bool(capabilities.structuredOutput, `${path}.capabilities.structuredOutput`),
      contextTokens: integer(capabilities.contextTokens, `${path}.capabilities.contextTokens`, 1, 10_000_000),
      modalities: enumArray<Modality>(capabilities.modalities, `${path}.capabilities.modalities`, MODALITIES, 3),
    },
  };
}

function parseRequest(value: unknown): RouteRequest {
  const row = record(value, "request", ["phase", "risk", "objective", "requirements", "constraints", "incumbentModelId"]);
  const requirements = record(row.requirements, "request.requirements", ["toolUse", "structuredOutput", "minContextTokens", "modalities"]);
  const constraints = record(row.constraints, "request.constraints", ["dataBoundary", "maxCostMicroUsd", "maxLatencyMs"]);
  const incumbentModelId = row.incumbentModelId === undefined ? undefined : identifier(row.incumbentModelId, "request.incumbentModelId", 160);
  const maxCostMicroUsd = optionalInteger(constraints.maxCostMicroUsd, "request.constraints.maxCostMicroUsd", 0, 1_000_000_000);
  const maxLatencyMs = optionalInteger(constraints.maxLatencyMs, "request.constraints.maxLatencyMs", 0, 600_000);
  return {
    phase: enumValue<TaskPhase>(row.phase, "request.phase", TASK_PHASES),
    risk: enumValue<RiskClass>(row.risk, "request.risk", RISKS),
    objective: enumValue<RouteObjective>(row.objective, "request.objective", OBJECTIVES),
    requirements: {
      toolUse: bool(requirements.toolUse, "request.requirements.toolUse"),
      structuredOutput: bool(requirements.structuredOutput, "request.requirements.structuredOutput"),
      minContextTokens: integer(requirements.minContextTokens, "request.requirements.minContextTokens", 1, 10_000_000),
      modalities: enumArray<Modality>(requirements.modalities, "request.requirements.modalities", MODALITIES, 3),
    },
    constraints: {
      dataBoundary: enumValue<DataBoundary>(constraints.dataBoundary, "request.constraints.dataBoundary", BOUNDARIES),
      ...(maxCostMicroUsd === undefined ? {} : { maxCostMicroUsd }),
      ...(maxLatencyMs === undefined ? {} : { maxLatencyMs }),
    },
    ...(incumbentModelId === undefined ? {} : { incumbentModelId }),
  };
}

export function parsePublicRoutePayload(value: unknown): PublicRoutePayload {
  const root = record(value, "$", ["request", "models"]);
  if (!Array.isArray(root.models) || root.models.length === 0 || root.models.length > 100) {
    invalid("models", "must be an array with 1 to 100 model profiles");
  }
  return { request: parseRequest(root.request), models: root.models.map(parseModel) };
}
