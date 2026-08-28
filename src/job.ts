import {
  JOB_CONTRACT_VERSION,
  type JobManifest,
  type JobPlan,
  type JobStep,
  type ModelProfile,
} from "./contracts.js";
import { NymrelError } from "./errors.js";
import { compareCodeUnits } from "./ordering.js";
import { routeV2 } from "./router.js";
import { parsePublicRoutePayloadV2 } from "./validation.js";

type RecordValue = Record<string, unknown>;

function invalid(path: string, message: string): never {
  throw new NymrelError("invalid_request", "The job manifest is invalid.", 400, [`${path}: ${message}`]);
}

function record(value: unknown, path: string, keys: readonly string[]): RecordValue {
  if (value === null || typeof value !== "object" || Array.isArray(value)) invalid(path, "must be an object");
  const result = value as RecordValue;
  if (Object.keys(result).some((key) => !keys.includes(key))) invalid(path, "contains unsupported fields");
  return result;
}

function identifier(value: unknown, path: string, maximum: number): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maximum || value.trim() !== value || !/^[A-Za-z0-9][A-Za-z0-9._:/@+~-]*$/.test(value)) {
    invalid(path, `must be a non-empty identifier of at most ${maximum} characters`);
  }
  return value;
}

function stringArray(value: unknown, path: string, maximum: number): string[] {
  if (!Array.isArray(value) || value.length > maximum) invalid(path, `must be an array with at most ${maximum} entries`);
  const entries = value.map((entry, index) => identifier(entry, `${path}[${index}]`, 160));
  if (new Set(entries).size !== entries.length) invalid(path, "must not contain duplicates");
  return entries;
}

/**
 * Parse a prompt-free local job manifest. Each step is revalidated through the
 * existing v2 route parser, so Job Mode cannot relax route eligibility rules.
 */
export function parseJobManifest(value: unknown): JobManifest {
  const root = record(value, "$", ["contractVersion", "jobId", "models", "steps"]);
  if (root.contractVersion !== JOB_CONTRACT_VERSION) invalid("contractVersion", `must be ${JOB_CONTRACT_VERSION}`);
  const jobId = identifier(root.jobId, "jobId", 160);
  if (!Array.isArray(root.steps) || root.steps.length < 1 || root.steps.length > 32) invalid("steps", "must be an array with 1 to 32 entries");
  if (!Array.isArray(root.models) || root.models.length < 1 || root.models.length > 100) invalid("models", "must be an array with 1 to 100 model profiles");

  const seen = new Set<string>();
  let models: readonly ModelProfile[] | undefined;
  const steps: JobStep[] = root.steps.map((entry, index) => {
    const row = record(entry, `steps[${index}]`, ["stepId", "dependsOn", "request"]);
    const stepId = identifier(row.stepId, `steps[${index}].stepId`, 160);
    if (seen.has(stepId)) invalid(`steps[${index}].stepId`, "must be unique");
    const dependsOn = stringArray(row.dependsOn, `steps[${index}].dependsOn`, index);
    if (dependsOn.some((dependency) => !seen.has(dependency))) {
      invalid(`steps[${index}].dependsOn`, "may reference only earlier step IDs");
    }
    const parsed = parsePublicRoutePayloadV2({ request: row.request, models: root.models });
    models ??= parsed.models;
    seen.add(stepId);
    return { stepId, dependsOn, request: parsed.request };
  });
  return { contractVersion: JOB_CONTRACT_VERSION, jobId, models: models ?? [], steps };
}

/** Produce routing decisions only. Job Mode does not invoke providers or perform work. */
function planValidatedJob(manifest: JobManifest): JobPlan {
  const steps = manifest.steps.map((step, index) => {
    const routePlan = routeV2(step.request, manifest.models);
    const external = step.request.risk !== "read";
    const reasonCodes = [
      "local_plan_only",
      ...(external ? ["non_read_requires_external_handoff"] : ["read_only_step"]),
      ...(routePlan.selectedModelId === null ? ["no_eligible_model"] : ["model_selected"]),
    ];
    return {
      ordinal: index + 1,
      stepId: step.stepId,
      dependsOn: step.dependsOn,
      phase: step.request.phase,
      executionDisposition: external ? "external_handoff_required" as const : "local_read_only_eligible" as const,
      routePlan,
      reasonCodes,
    };
  });
  const blockedSteps = steps.filter((step) => step.routePlan.selectedModelId === null).length;
  const externalHandoffRequiredSteps = steps.filter((step) => step.executionDisposition === "external_handoff_required").length;
  const selectionCounts = new Map<string, { modelId: string; providerId: string; stepCount: number }>();
  for (const step of steps) {
    const modelId = step.routePlan.selectedModelId;
    const providerId = step.routePlan.selectedProviderId;
    if (modelId === null || providerId === null) continue;
    const key = `${providerId}\u0000${modelId}`;
    const current = selectionCounts.get(key);
    if (current === undefined) selectionCounts.set(key, { modelId, providerId, stepCount: 1 });
    else current.stepCount += 1;
  }
  const status = blockedSteps > 0
    ? "blocked" as const
    : externalHandoffRequiredSteps > 0 ? "ready_with_handoffs" as const : "ready" as const;
  return {
    contractVersion: JOB_CONTRACT_VERSION,
    jobId: manifest.jobId,
    profile: "plan-only",
    status,
    executionStatus: "not_started",
    steps,
    summary: {
      totalSteps: steps.length,
      routableSteps: steps.length - blockedSteps,
      blockedSteps,
      localReadOnlyEligibleSteps: steps.length - externalHandoffRequiredSteps,
      externalHandoffRequiredSteps,
      selectionsByModel: [...selectionCounts.values()].sort(
        (left, right) => compareCodeUnits(left.modelId, right.modelId) || compareCodeUnits(left.providerId, right.providerId),
      ),
    },
    decisionCodes: [
      "local_plan_only",
      "execution_not_started",
      status === "blocked" ? "job_plan_blocked" : status === "ready_with_handoffs" ? "external_handoffs_required" : "job_plan_ready",
    ],
  };
}

/** Exported API is strict even when called directly from a package consumer. */
export function planJob(value: unknown): JobPlan {
  return planValidatedJob(parseJobManifest(value));
}
