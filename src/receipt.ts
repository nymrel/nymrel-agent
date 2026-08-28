import { createHash } from "node:crypto";
import {
  CONTRACT_VERSION,
  JOB_CONTRACT_VERSION,
  type JobManifest,
  type JobPlan,
  type JobPlanReceipt,
  type RunEvent,
  type RunReceipt,
  type RunStatus,
} from "./contracts.js";
import { compareCodeUnits } from "./ordering.js";

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([key, entry]) => [key, normalize(entry)]));
  }
  return value;
}

export function canonicalJson(value: unknown): string { return JSON.stringify(normalize(value)); }
export function sha256Text(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex"); }

export interface ReceiptInput {
  readonly runId: string; readonly status: RunStatus; readonly task: string; readonly output?: string;
  readonly events: readonly RunEvent[]; readonly selectedModelId: string | null;
  readonly selectedProviderId: string | null; readonly reasonCodes: readonly string[];
  readonly inputTokens: number; readonly outputTokens: number; readonly startedAt: string; readonly endedAt: string;
}

export function createRunReceipt(input: ReceiptInput): RunReceipt {
  return {
    contractVersion: CONTRACT_VERSION, runId: input.runId, status: input.status, profile: "read-only",
    inputSha256: sha256Text(input.task), ...(input.output === undefined ? {} : { outputSha256: sha256Text(input.output) }),
    eventDigestSha256: sha256Text(canonicalJson(input.events)), selectedModelId: input.selectedModelId,
    selectedProviderId: input.selectedProviderId, reasonCodes: [...input.reasonCodes],
    usage: { inputTokens: input.inputTokens, outputTokens: input.outputTokens },
    startedAt: input.startedAt, endedAt: input.endedAt,
  };
}

/**
 * Build a body-free local correlation receipt. Digests are integrity handles,
 * not encryption; callers should retain the manifest and full plan locally.
 */
export function createJobPlanReceipt(manifest: JobManifest, plan: JobPlan, createdAt = new Date().toISOString()): JobPlanReceipt {
  return {
    contractVersion: JOB_CONTRACT_VERSION,
    receiptType: "job_plan",
    profile: "plan-only",
    status: plan.status === "blocked" ? "blocked" : "planned",
    jobIdSha256: sha256Text(manifest.jobId),
    manifestSha256: sha256Text(canonicalJson(manifest)),
    planSha256: sha256Text(canonicalJson(plan)),
    counts: {
      totalSteps: plan.summary.totalSteps,
      routableSteps: plan.summary.routableSteps,
      blockedSteps: plan.summary.blockedSteps,
    },
    steps: plan.steps.map((step) => ({
      ordinal: step.ordinal,
      routePlanSha256: sha256Text(canonicalJson(step.routePlan)),
      selectedModelId: step.routePlan.selectedModelId,
      selectedProviderId: step.routePlan.selectedProviderId,
    })),
    reasonCodes: [...plan.decisionCodes],
    createdAt,
  };
}
