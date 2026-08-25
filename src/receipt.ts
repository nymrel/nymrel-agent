import { createHash } from "node:crypto";
import {
  CONTRACT_VERSION,
  type RunEvent,
  type RunReceipt,
  type RunStatus,
} from "./contracts.js";

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalize(entry)]),
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export interface ReceiptInput {
  readonly runId: string;
  readonly status: RunStatus;
  readonly task: string;
  readonly output?: string;
  readonly events: readonly RunEvent[];
  readonly selectedModelId: string | null;
  readonly reasonCodes: readonly string[];
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly startedAt: string;
  readonly endedAt: string;
}

export function createRunReceipt(input: ReceiptInput): RunReceipt {
  return {
    contractVersion: CONTRACT_VERSION,
    runId: input.runId,
    status: input.status,
    profile: "read-only",
    inputSha256: sha256Text(input.task),
    ...(input.output === undefined ? {} : { outputSha256: sha256Text(input.output) }),
    eventDigestSha256: sha256Text(canonicalJson(input.events)),
    selectedModelId: input.selectedModelId,
    reasonCodes: [...input.reasonCodes],
    usage: {
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
    },
    startedAt: input.startedAt,
    endedAt: input.endedAt,
  };
}
