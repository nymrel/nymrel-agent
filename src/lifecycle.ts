import {
  JOB_CHECKPOINT_INPUT_CONTRACT_VERSION,
  JOB_CHECKPOINT_RECEIPT_CONTRACT_VERSION,
  JOB_LIFECYCLE_CONTRACT_VERSION,
  JOB_TERMINAL_INPUT_CONTRACT_VERSION,
  JOB_TERMINAL_RECEIPT_CONTRACT_VERSION,
  type JobCheckpointInput,
  type JobCheckpointReceipt,
  type JobLifecycleState,
  type JobTerminalInput,
  type JobTerminalReceipt,
} from "./contracts.js";
import { NymrelError } from "./errors.js";
import { parseJobManifest, planJob } from "./job.js";
import { canonicalJson, sha256Text } from "./receipt.js";

const MAX_HISTORY = 32;
const MAX_ARTIFACTS = 32;
const MAX_COUNTER = 1_000_000;
const HASH = /^[a-f0-9]{64}$/;
const OPAQUE_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
type ObjectValue = Record<string, unknown>;

function invalid(message = "The lifecycle input is invalid."): never { throw new NymrelError("invalid_request", message, 400); }
function integrity(): never { return invalid("The lifecycle state integrity check failed."); }
function object(value: unknown, keys: readonly string[]): ObjectValue {
  if (value === null || typeof value !== "object" || Array.isArray(value)) invalid();
  const row = value as ObjectValue;
  if (Object.keys(row).some((key) => !keys.includes(key))) invalid();
  return row;
}
function exactKeys(row: ObjectValue, keys: readonly string[]): void {
  if (Object.keys(row).length !== keys.length || keys.some((key) => !Object.hasOwn(row, key))) invalid();
}
function string(value: unknown, maximum: number): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maximum || value.trim() !== value || /[\u0000-\u001f\u007f]/.test(value)) invalid();
  return value;
}
function opaqueKey(value: unknown): string { const result = string(value, 128); if (!OPAQUE_KEY.test(result)) invalid(); return result; }
function sha256(value: unknown): string { const result = string(value, 64); if (!HASH.test(result)) invalid(); return result; }
function counter(value: unknown, maximum = MAX_COUNTER): number { if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > maximum) invalid(); return value as number; }
function timestamp(value: unknown): string { const result = string(value, 24); if (!UTC.test(result) || Number.isNaN(Date.parse(result))) invalid(); return result; }
function enumValue<T extends string>(value: unknown, options: readonly T[]): T { if (typeof value !== "string" || !options.includes(value as T)) invalid(); return value as T; }
function ordinalArray(value: unknown, maximum: number): number[] {
  if (!Array.isArray(value) || value.length > maximum) invalid();
  const result = value.map((entry) => counter(entry, maximum));
  if (result.some((entry) => entry < 1) || result.some((entry, index) => index > 0 && result[index - 1]! >= entry)) invalid();
  return result;
}
function hashArray(value: unknown, maximum: number): string[] {
  if (!Array.isArray(value) || value.length > maximum) invalid();
  const result = value.map(sha256); if (new Set(result).size !== result.length) invalid(); return result;
}
function equalOrdinals(left: readonly number[], right: readonly number[]): boolean { return left.length === right.length && left.every((value, index) => value === right[index]); }
function stateHash(state: Omit<JobLifecycleState, "stateSha256">): string { return sha256Text(canonicalJson(state)); }
function checkpointHash(receipt: Omit<JobCheckpointReceipt, "checkpointSha256">): string { return sha256Text(canonicalJson(receipt)); }
function terminalHash(receipt: Omit<JobTerminalReceipt, "terminalSha256">): string { return sha256Text(canonicalJson(receipt)); }
function lifecycleHash(basis: Pick<JobLifecycleState, "jobIdSha256" | "manifestSha256" | "planSha256" | "totalSteps" | "startedAt">): string {
  const { jobIdSha256, manifestSha256, planSha256, totalSteps, startedAt } = basis;
  return sha256Text(canonicalJson({ jobIdSha256, manifestSha256, planSha256, totalSteps, startedAt }));
}
function isSuperset(next: readonly number[], previous: readonly number[]): boolean { const current = new Set(next); return previous.every((ordinal) => current.has(ordinal)); }
function terminalCombination(status: string, reasonCode: string, validationStatus: string): boolean {
  return (status === "completed" && reasonCode === "success" && validationStatus === "passed") ||
    (status === "failed" && ((reasonCode === "validation_failed" && validationStatus === "failed") || (reasonCode === "execution_error" && validationStatus === "not_run"))) ||
    (status === "blocked" && reasonCode === "blocked" && validationStatus === "not_run") ||
    (status === "cancelled" && reasonCode === "cancelled" && validationStatus === "not_run") ||
    (status === "budget_exhausted" && reasonCode === "budget_limit" && validationStatus === "not_run");
}

function parseCheckpointInput(value: unknown): JobCheckpointInput {
  const keys = ["contractVersion", "idempotencyKey", "phase", "status", "nextActionCode", "completedStepOrdinals", "artifactSha256", "metrics", "recordedAt"];
  const row = object(value, keys); exactKeys(row, keys); if (row.contractVersion !== JOB_CHECKPOINT_INPUT_CONTRACT_VERSION) invalid();
  const metrics = object(row.metrics, ["stepsCompleted", "reworkCount", "testsPassed"]); exactKeys(metrics, ["stepsCompleted", "reworkCount", "testsPassed"]);
  const completedStepOrdinals = ordinalArray(row.completedStepOrdinals, MAX_HISTORY); const stepsCompleted = counter(metrics.stepsCompleted); if (stepsCompleted !== completedStepOrdinals.length) invalid();
  return { contractVersion: JOB_CHECKPOINT_INPUT_CONTRACT_VERSION, idempotencyKey: opaqueKey(row.idempotencyKey), phase: enumValue(row.phase, ["research", "plan", "implement", "review", "closeout"]), status: enumValue(row.status, ["active", "waiting", "blocked"]), nextActionCode: enumValue(row.nextActionCode, ["continue", "await_input", "validate", "closeout"]), completedStepOrdinals, artifactSha256: hashArray(row.artifactSha256, MAX_ARTIFACTS), metrics: { stepsCompleted, reworkCount: counter(metrics.reworkCount), testsPassed: counter(metrics.testsPassed) }, recordedAt: timestamp(row.recordedAt) };
}
function parseTerminalInput(value: unknown): JobTerminalInput {
  const keys = ["contractVersion", "idempotencyKey", "status", "reasonCode", "validationStatus", "evidenceSha256", "completedAt"];
  const row = object(value, keys); exactKeys(row, keys); if (row.contractVersion !== JOB_TERMINAL_INPUT_CONTRACT_VERSION) invalid();
  const status = enumValue(row.status, ["completed", "failed", "blocked", "cancelled", "budget_exhausted"]); const reasonCode = enumValue(row.reasonCode, ["success", "validation_failed", "blocked", "cancelled", "budget_limit", "execution_error"]); const validationStatus = enumValue(row.validationStatus, ["passed", "failed", "not_run", "not_applicable"]);
  if (!terminalCombination(status, reasonCode, validationStatus)) invalid();
  return { contractVersion: JOB_TERMINAL_INPUT_CONTRACT_VERSION, idempotencyKey: opaqueKey(row.idempotencyKey), status, reasonCode, validationStatus, evidenceSha256: sha256(row.evidenceSha256), completedAt: timestamp(row.completedAt) };
}
function parseCheckpointReceipt(value: unknown): JobCheckpointReceipt {
  const keys = ["contractVersion", "receiptType", "inputSha256", "lifecycleSha256", "checkpointSha256", "previousCheckpointSha256", "revision", "checkpointSequence", "phase", "status", "nextActionCode", "completedStepOrdinals", "artifactSha256", "metrics", "recordedAt"];
  const row = object(value, keys); exactKeys(row, keys); if (row.contractVersion !== JOB_CHECKPOINT_RECEIPT_CONTRACT_VERSION || row.receiptType !== "checkpoint") invalid();
  const metrics = object(row.metrics, ["stepsCompleted", "reworkCount", "testsPassed"]); exactKeys(metrics, ["stepsCompleted", "reworkCount", "testsPassed"]);
  const receipt: JobCheckpointReceipt = { contractVersion: JOB_CHECKPOINT_RECEIPT_CONTRACT_VERSION, receiptType: "checkpoint", inputSha256: sha256(row.inputSha256), lifecycleSha256: sha256(row.lifecycleSha256), checkpointSha256: sha256(row.checkpointSha256), previousCheckpointSha256: row.previousCheckpointSha256 === null ? null : sha256(row.previousCheckpointSha256), revision: counter(row.revision), checkpointSequence: counter(row.checkpointSequence), phase: enumValue(row.phase, ["research", "plan", "implement", "review", "closeout"]), status: enumValue(row.status, ["active", "waiting", "blocked"]), nextActionCode: enumValue(row.nextActionCode, ["continue", "await_input", "validate", "closeout"]), completedStepOrdinals: ordinalArray(row.completedStepOrdinals, MAX_HISTORY), artifactSha256: hashArray(row.artifactSha256, MAX_ARTIFACTS), metrics: { stepsCompleted: counter(metrics.stepsCompleted), reworkCount: counter(metrics.reworkCount), testsPassed: counter(metrics.testsPassed) }, recordedAt: timestamp(row.recordedAt) };
  if (receipt.metrics.stepsCompleted !== receipt.completedStepOrdinals.length || receipt.checkpointSequence < 1 || receipt.revision < 1) invalid();
  const { checkpointSha256: declared, ...basis } = receipt; if (checkpointHash(basis) !== declared) integrity(); return receipt;
}
function parseTerminalReceipt(value: unknown): JobTerminalReceipt {
  const keys = ["contractVersion", "receiptType", "inputSha256", "lifecycleSha256", "terminalSha256", "revision", "checkpointSequence", "lastCheckpointSha256", "totalSteps", "completedStepCount", "status", "reasonCode", "validationStatus", "evidenceSha256", "completedAt"];
  const row = object(value, keys); exactKeys(row, keys); if (row.contractVersion !== JOB_TERMINAL_RECEIPT_CONTRACT_VERSION || row.receiptType !== "terminal") invalid();
  const receipt: JobTerminalReceipt = { contractVersion: JOB_TERMINAL_RECEIPT_CONTRACT_VERSION, receiptType: "terminal", inputSha256: sha256(row.inputSha256), lifecycleSha256: sha256(row.lifecycleSha256), terminalSha256: sha256(row.terminalSha256), revision: counter(row.revision), checkpointSequence: counter(row.checkpointSequence), lastCheckpointSha256: row.lastCheckpointSha256 === null ? null : sha256(row.lastCheckpointSha256), totalSteps: counter(row.totalSteps, MAX_HISTORY), completedStepCount: counter(row.completedStepCount, MAX_HISTORY), status: enumValue(row.status, ["completed", "failed", "blocked", "cancelled", "budget_exhausted"]), reasonCode: enumValue(row.reasonCode, ["success", "validation_failed", "blocked", "cancelled", "budget_limit", "execution_error"]), validationStatus: enumValue(row.validationStatus, ["passed", "failed", "not_run", "not_applicable"]), evidenceSha256: sha256(row.evidenceSha256), completedAt: timestamp(row.completedAt) };
  if (!terminalCombination(receipt.status, receipt.reasonCode, receipt.validationStatus) || receipt.totalSteps < 1 || receipt.completedStepCount > receipt.totalSteps) invalid();
  const { terminalSha256: declared, ...basis } = receipt; if (terminalHash(basis) !== declared) integrity(); return receipt;
}
function parseStateRaw(value: unknown): JobLifecycleState {
  const keys = ["contractVersion", "stateType", "jobIdSha256", "manifestSha256", "planSha256", "lifecycleSha256", "totalSteps", "startedAt", "revision", "checkpointSequence", "status", "completedStepOrdinals", "lastCheckpointSha256", "checkpointHistory", "terminal", "stateSha256"];
  const row = object(value, keys); exactKeys(row, keys); if (row.contractVersion !== JOB_LIFECYCLE_CONTRACT_VERSION || row.stateType !== "local_job_lifecycle" || !Array.isArray(row.checkpointHistory) || row.checkpointHistory.length > MAX_HISTORY) invalid();
  const checkpointHistory = row.checkpointHistory.map((entry) => { const item = object(entry, ["idempotencyKey", "inputSha256", "receipt"]); exactKeys(item, ["idempotencyKey", "inputSha256", "receipt"]); return { idempotencyKey: opaqueKey(item.idempotencyKey), inputSha256: sha256(item.inputSha256), receipt: parseCheckpointReceipt(item.receipt) }; });
  if (new Set(checkpointHistory.map((entry) => entry.idempotencyKey)).size !== checkpointHistory.length) invalid();
  const terminal = row.terminal === null ? null : (() => { const item = object(row.terminal, ["idempotencyKey", "inputSha256", "receipt"]); exactKeys(item, ["idempotencyKey", "inputSha256", "receipt"]); return { idempotencyKey: opaqueKey(item.idempotencyKey), inputSha256: sha256(item.inputSha256), receipt: parseTerminalReceipt(item.receipt) }; })();
  const state: JobLifecycleState = { contractVersion: JOB_LIFECYCLE_CONTRACT_VERSION, stateType: "local_job_lifecycle", jobIdSha256: sha256(row.jobIdSha256), manifestSha256: sha256(row.manifestSha256), planSha256: sha256(row.planSha256), lifecycleSha256: sha256(row.lifecycleSha256), totalSteps: counter(row.totalSteps, MAX_HISTORY), startedAt: timestamp(row.startedAt), revision: counter(row.revision), checkpointSequence: counter(row.checkpointSequence), status: enumValue(row.status, ["active", "waiting", "blocked", "completed", "failed", "cancelled", "budget_exhausted"]), completedStepOrdinals: ordinalArray(row.completedStepOrdinals, MAX_HISTORY), lastCheckpointSha256: row.lastCheckpointSha256 === null ? null : sha256(row.lastCheckpointSha256), checkpointHistory, terminal, stateSha256: sha256(row.stateSha256) };
  if (state.totalSteps < 1 || state.completedStepOrdinals.some((ordinal) => ordinal > state.totalSteps) || lifecycleHash(state) !== state.lifecycleSha256) integrity();
  if (state.checkpointSequence !== checkpointHistory.length || state.revision !== checkpointHistory.length + (terminal === null ? 0 : 1) || state.lastCheckpointSha256 !== (checkpointHistory.at(-1)?.receipt.checkpointSha256 ?? null)) integrity();
  for (let index = 0; index < checkpointHistory.length; index += 1) {
    const receipt = checkpointHistory[index]!.receipt; const previous = checkpointHistory[index - 1]?.receipt;
    if (receipt.lifecycleSha256 !== state.lifecycleSha256 || receipt.checkpointSequence !== index + 1 || receipt.revision !== index + 1 || receipt.previousCheckpointSha256 !== (previous?.checkpointSha256 ?? null) || receipt.completedStepOrdinals.some((ordinal) => ordinal > state.totalSteps) || (previous !== undefined && (!isSuperset(receipt.completedStepOrdinals, previous.completedStepOrdinals) || Date.parse(receipt.recordedAt) < Date.parse(previous.recordedAt))) || Date.parse(receipt.recordedAt) < Date.parse(state.startedAt)) integrity();
  }
  const latest = checkpointHistory.at(-1)?.receipt;
  if (latest === undefined) {
    if (state.completedStepOrdinals.length !== 0) integrity();
  } else if (!equalOrdinals(state.completedStepOrdinals, latest.completedStepOrdinals)) integrity();
  if (terminal === null) {
    if (latest === undefined) { if (state.status !== "active" || state.completedStepOrdinals.length !== 0 || state.revision !== 0 || state.checkpointSequence !== 0) integrity(); }
    else if (state.status !== latest.status) integrity();
  } else {
    const receipt = terminal.receipt;
    if (receipt.lifecycleSha256 !== state.lifecycleSha256 || receipt.revision !== state.revision || receipt.checkpointSequence !== state.checkpointSequence || receipt.lastCheckpointSha256 !== state.lastCheckpointSha256 || receipt.totalSteps !== state.totalSteps || receipt.completedStepCount !== state.completedStepOrdinals.length || state.status !== receipt.status || Date.parse(receipt.completedAt) < Date.parse(latest?.recordedAt ?? state.startedAt) || (receipt.status === "completed" && (receipt.checkpointSequence < 1 || receipt.lastCheckpointSha256 === null || receipt.completedStepCount !== receipt.totalSteps))) integrity();
  }
  const { stateSha256: declared, ...basis } = state; if (stateHash(basis) !== declared) integrity(); return state;
}

/** Parse raw state or one exact prior CLI envelope without trusting wrapper metadata. */
export function parseLifecycleState(value: unknown): JobLifecycleState {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const row = value as ObjectValue;
    if (Object.hasOwn(row, "state") || Object.hasOwn(row, "ok")) {
      if (row.ok !== true) invalid(); const names = Object.keys(row).sort();
      const isInit = canonicalJson(names) === canonicalJson(["ok", "state"]); const isTransition = canonicalJson(names) === canonicalJson(["ok", "receipt", "replayed", "state"]);
      if (!isInit && !isTransition) invalid(); const state = parseStateRaw(row.state);
      if (isTransition) {
        if (typeof row.replayed !== "boolean") invalid();
        const parsedReceipt = state.terminal === null ? parseCheckpointReceipt(row.receipt) : parseTerminalReceipt(row.receipt);
        const receipts = state.terminal === null
          ? state.checkpointHistory.map((entry) => entry.receipt)
          : [state.terminal.receipt];
        const latest = state.terminal?.receipt ?? state.checkpointHistory.at(-1)?.receipt;
        const matchesStored = receipts.some((receipt) => canonicalJson(parsedReceipt) === canonicalJson(receipt));
        const matchesLatest = latest !== undefined && canonicalJson(parsedReceipt) === canonicalJson(latest);
        if (!matchesStored || (row.replayed === false && !matchesLatest)) integrity();
      }
      return state;
    }
  }
  return parseStateRaw(value);
}
function finalize(state: Omit<JobLifecycleState, "stateSha256">): JobLifecycleState { return { ...state, stateSha256: stateHash(state) }; }

/** Strictly parse and route the manifest locally before creating a body-free lifecycle state. */
export function initJobLifecycle(manifestValue: unknown, startedAt = new Date().toISOString()): JobLifecycleState {
  const manifest = parseJobManifest(manifestValue); const plan = planJob(manifest);
  if (plan.status === "blocked" || plan.summary.blockedSteps > 0) throw new NymrelError("lifecycle_plan_blocked", "The lifecycle cannot start because the local plan is blocked.", 409);
  const initial = { contractVersion: JOB_LIFECYCLE_CONTRACT_VERSION, stateType: "local_job_lifecycle" as const, jobIdSha256: sha256Text(manifest.jobId), manifestSha256: sha256Text(canonicalJson(manifest)), planSha256: sha256Text(canonicalJson(plan)), totalSteps: plan.summary.totalSteps, startedAt: timestamp(startedAt) };
  return finalize({ ...initial, lifecycleSha256: lifecycleHash(initial), revision: 0, checkpointSequence: 0, status: "active", completedStepOrdinals: [], lastCheckpointSha256: null, checkpointHistory: [], terminal: null });
}
export interface CheckpointTransition { readonly state: JobLifecycleState; readonly receipt: JobCheckpointReceipt; readonly replayed: boolean; }
/** Apply one bounded local checkpoint. No network, execution, or persistence occurs here. */
export function checkpointJobLifecycle(prior: unknown, value: unknown): CheckpointTransition {
  const state = parseLifecycleState(prior); if (state.terminal !== null) throw new NymrelError("lifecycle_terminal", "The lifecycle is already terminal.", 409);
  const input = parseCheckpointInput(value); const inputSha256 = sha256Text(canonicalJson(input)); const priorEntry = state.checkpointHistory.find((entry) => entry.idempotencyKey === input.idempotencyKey);
  if (priorEntry !== undefined) { if (priorEntry.inputSha256 !== inputSha256) throw new NymrelError("idempotency_conflict", "The lifecycle idempotency key conflicts with an earlier input.", 409); return { state, receipt: priorEntry.receipt, replayed: true }; }
  if (state.checkpointHistory.length >= MAX_HISTORY || input.completedStepOrdinals.some((ordinal) => ordinal > state.totalSteps) || !isSuperset(input.completedStepOrdinals, state.completedStepOrdinals) || Date.parse(input.recordedAt) < Date.parse(state.startedAt) || (state.checkpointHistory.at(-1) !== undefined && Date.parse(input.recordedAt) < Date.parse(state.checkpointHistory.at(-1)!.receipt.recordedAt))) invalid();
  const base = { contractVersion: JOB_CHECKPOINT_RECEIPT_CONTRACT_VERSION, receiptType: "checkpoint" as const, inputSha256, lifecycleSha256: state.lifecycleSha256, previousCheckpointSha256: state.lastCheckpointSha256, revision: state.revision + 1, checkpointSequence: state.checkpointSequence + 1, phase: input.phase, status: input.status, nextActionCode: input.nextActionCode, completedStepOrdinals: input.completedStepOrdinals, artifactSha256: input.artifactSha256, metrics: input.metrics, recordedAt: input.recordedAt };
  const receipt: JobCheckpointReceipt = { ...base, checkpointSha256: checkpointHash(base) }; const { stateSha256: _stateSha256, ...basis } = state;
  const next = finalize({ ...basis, revision: receipt.revision, checkpointSequence: receipt.checkpointSequence, status: input.status, completedStepOrdinals: input.completedStepOrdinals, lastCheckpointSha256: receipt.checkpointSha256, checkpointHistory: [...state.checkpointHistory, { idempotencyKey: input.idempotencyKey, inputSha256, receipt }] });
  return { state: next, receipt, replayed: false };
}
export interface TerminalTransition { readonly state: JobLifecycleState; readonly receipt: JobTerminalReceipt; readonly replayed: boolean; }
/** Produce one terminal receipt for the retained latest state lineage; callers retain state themselves. */
export function completeJobLifecycle(prior: unknown, value: unknown): TerminalTransition {
  const state = parseLifecycleState(prior); const input = parseTerminalInput(value); const inputSha256 = sha256Text(canonicalJson(input));
  if (state.terminal !== null) { if (state.terminal.idempotencyKey === input.idempotencyKey) { if (state.terminal.inputSha256 !== inputSha256) throw new NymrelError("idempotency_conflict", "The lifecycle idempotency key conflicts with an earlier input.", 409); return { state, receipt: state.terminal.receipt, replayed: true }; } throw new NymrelError("lifecycle_terminal", "The lifecycle is already terminal.", 409); }
  const lastRecordedAt = state.checkpointHistory.at(-1)?.receipt.recordedAt ?? state.startedAt; if (Date.parse(input.completedAt) < Date.parse(lastRecordedAt)) invalid();
  if (input.status === "completed" && (state.checkpointSequence < 1 || state.completedStepOrdinals.length !== state.totalSteps || input.validationStatus !== "passed")) throw new NymrelError("lifecycle_completion_rejected", "The lifecycle cannot be marked completed without complete local proof.", 409);
  const base = { contractVersion: JOB_TERMINAL_RECEIPT_CONTRACT_VERSION, receiptType: "terminal" as const, inputSha256, lifecycleSha256: state.lifecycleSha256, revision: state.revision + 1, checkpointSequence: state.checkpointSequence, lastCheckpointSha256: state.lastCheckpointSha256, totalSteps: state.totalSteps, completedStepCount: state.completedStepOrdinals.length, status: input.status, reasonCode: input.reasonCode, validationStatus: input.validationStatus, evidenceSha256: input.evidenceSha256, completedAt: input.completedAt };
  const receipt: JobTerminalReceipt = { ...base, terminalSha256: terminalHash(base) }; const { stateSha256: _stateSha256, ...basis } = state;
  const next = finalize({ ...basis, revision: receipt.revision, status: input.status, terminal: { idempotencyKey: input.idempotencyKey, inputSha256, receipt } }); return { state: next, receipt, replayed: false };
}
export { parseCheckpointInput, parseTerminalInput };
