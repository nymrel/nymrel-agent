import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { checkpointJobLifecycle, completeJobLifecycle, initJobLifecycle, parseLifecycleState } from "../src/lifecycle.js";
import { canonicalJson, sha256Text } from "../src/receipt.js";

const digest = "a".repeat(64);
const manifest = JSON.parse(readFileSync("examples/job-48h-game-builder.json", "utf8")) as unknown;
function state() { return initJobLifecycle(manifest, "2026-08-28T20:00:00.000Z"); }
function checkpoint(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { contractVersion: "nymrel.agent.job.checkpoint-input/v1", idempotencyKey: "checkpoint-0001", phase: "research", status: "active", nextActionCode: "continue", completedStepOrdinals: [1], artifactSha256: [digest], metrics: { stepsCompleted: 1, reworkCount: 0, testsPassed: 1 }, recordedAt: "2026-08-28T20:01:00.000Z", ...overrides };
}
function terminal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { contractVersion: "nymrel.agent.job.terminal-input/v1", idempotencyKey: "terminal-0001", status: "completed", reasonCode: "success", validationStatus: "passed", evidenceSha256: digest, completedAt: "2026-08-28T20:05:00.000Z", ...overrides };
}
function rehash(stateValue: Record<string, unknown>): Record<string, unknown> {
  const { stateSha256: _discarded, ...basis } = stateValue;
  return { ...basis, stateSha256: sha256Text(canonicalJson(basis)) };
}
function rehashTerminal(stateValue: Record<string, unknown>): Record<string, unknown> {
  const terminal = stateValue.terminal as { receipt: Record<string, unknown> };
  const { terminalSha256: _discarded, ...basis } = terminal.receipt;
  terminal.receipt.terminalSha256 = sha256Text(canonicalJson(basis));
  return rehash(stateValue);
}

test("lifecycle checkpoint chains, binds one lineage, and replays stably", () => {
  const first = checkpointJobLifecycle(state(), checkpoint());
  assert.equal(first.state.revision, 1);
  assert.equal(first.state.checkpointSequence, 1);
  assert.equal(first.receipt.previousCheckpointSha256, null);
  assert.equal(first.receipt.lifecycleSha256, first.state.lifecycleSha256);
  assert.equal(first.receipt.checkpointSha256, first.state.lastCheckpointSha256);
  const replay = checkpointJobLifecycle(first.state, checkpoint());
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.state, first.state);
  assert.deepEqual(replay.receipt, first.receipt);
  assert.throws(() => checkpointJobLifecycle(first.state, checkpoint({ metrics: { stepsCompleted: 1, reworkCount: 1, testsPassed: 1 } })), /idempotency key conflicts/);
});

test("lifecycle accepts only exact saved CLI envelopes and binds their receipt", () => {
  const initialized = state();
  assert.deepEqual(parseLifecycleState({ ok: true, state: initialized }), initialized);
  const first = checkpointJobLifecycle({ ok: true, state: initialized }, checkpoint());
  const envelope = { ok: true as const, state: first.state, receipt: first.receipt, replayed: false };
  assert.deepEqual(parseLifecycleState(envelope), first.state);
  assert.throws(() => parseLifecycleState({ ...envelope, receipt: { ...first.receipt, artifactSha256: ["b".repeat(64)] } }), /integrity check failed/);
  assert.throws(() => parseLifecycleState({ ...envelope, replayed: "false" }), /invalid/);
  assert.throws(() => parseLifecycleState({ ...envelope, ignored: true }), /invalid/);
});

test("a replay envelope may carry an earlier stored checkpoint after advancement", () => {
  const first = checkpointJobLifecycle(state(), checkpoint());
  const second = checkpointJobLifecycle(first.state, checkpoint({ idempotencyKey: "checkpoint-0002", completedStepOrdinals: [1, 2], metrics: { stepsCompleted: 2, reworkCount: 0, testsPassed: 1 }, recordedAt: "2026-08-28T20:02:00.000Z" }));
  const replay = checkpointJobLifecycle(second.state, checkpoint());
  assert.equal(replay.replayed, true);
  const envelope = { ok: true as const, state: replay.state, receipt: replay.receipt, replayed: true };
  assert.deepEqual(parseLifecycleState(envelope), second.state);
  const third = checkpointJobLifecycle(envelope, checkpoint({ idempotencyKey: "checkpoint-0003", completedStepOrdinals: [1, 2, 3], metrics: { stepsCompleted: 3, reworkCount: 0, testsPassed: 1 }, recordedAt: "2026-08-28T20:03:00.000Z" }));
  assert.equal(third.state.checkpointSequence, 3);
});

test("lifecycle rejects direct manifest bypasses without echoing private values", () => {
  assert.throws(() => initJobLifecycle({ contractVersion: "nymrel.agent.job/v1", jobId: "valid-job-id", models: [], steps: [], prompt: "private-prompt-value" }), (error: unknown) => {
    assert.doesNotMatch(String(error), /private-prompt-value/); return true;
  });
});

test("lifecycle detects state and receipt tampering even after state hash recomputation", () => {
  const first = checkpointJobLifecycle(state(), checkpoint());
  const statusTamper = rehash({ ...first.state, status: "waiting" });
  assert.throws(() => parseLifecycleState(statusTamper), /integrity check failed/);
  const ordinalTamper = rehash({ ...first.state, completedStepOrdinals: [1, 2] });
  assert.throws(() => parseLifecycleState(ordinalTamper), /integrity check failed/);
  const terminalState = completeJobLifecycle(first.state, terminal({ status: "failed", reasonCode: "execution_error", validationStatus: "not_run" }));
  const terminalTamper = structuredClone(terminalState.state) as unknown as Record<string, unknown>;
  const terminalEntry = terminalTamper.terminal as { receipt: Record<string, unknown> };
  terminalEntry.receipt.completedStepCount = 5;
  assert.throws(() => parseLifecycleState(rehash(terminalTamper)), /integrity check failed/);
  const ordinalForgery = structuredClone(terminalState.state) as unknown as Record<string, unknown>;
  const forgedReceipt = (ordinalForgery.terminal as { receipt: Record<string, unknown> }).receipt;
  ordinalForgery.completedStepOrdinals = [];
  forgedReceipt.completedStepCount = 0;
  assert.throws(() => parseLifecycleState(rehashTerminal(ordinalForgery)), /integrity check failed/);
});

test("lifecycle binds retained idempotency input hashes to their signed receipts", () => {
  const first = checkpointJobLifecycle(state(), checkpoint());
  const checkpointForge = structuredClone(first.state) as unknown as Record<string, unknown>;
  ((checkpointForge.checkpointHistory as Array<{ inputSha256: string }>)[0]!).inputSha256 = "b".repeat(64);
  assert.throws(() => parseLifecycleState(rehash(checkpointForge)), (error: unknown) => {
    assert.match(String(error), /integrity check failed/);
    assert.doesNotMatch(String(error), /b{64}/);
    return true;
  });
  const terminalState = completeJobLifecycle(first.state, terminal({ status: "failed", reasonCode: "execution_error", validationStatus: "not_run" }));
  const terminalForge = structuredClone(terminalState.state) as unknown as Record<string, unknown>;
  (terminalForge.terminal as { inputSha256: string }).inputSha256 = "b".repeat(64);
  assert.throws(() => parseLifecycleState(rehash(terminalForge)), (error: unknown) => {
    assert.match(String(error), /integrity check failed/);
    assert.doesNotMatch(String(error), /b{64}/);
    return true;
  });
});

test("lifecycle rejects receipt transplants, oversized history, secret fields, and ordinal regression", () => {
  const first = checkpointJobLifecycle(state(), checkpoint());
  const otherManifest = structuredClone(manifest) as { jobId: string };
  otherManifest.jobId = "other-job-lifecycle";
  const other = initJobLifecycle(otherManifest, "2026-08-28T20:00:00.000Z");
  const transplanted = structuredClone(first.state) as unknown as Record<string, unknown>;
  transplanted.jobIdSha256 = other.jobIdSha256;
  transplanted.manifestSha256 = other.manifestSha256;
  transplanted.planSha256 = other.planSha256;
  transplanted.lifecycleSha256 = other.lifecycleSha256;
  assert.throws(() => parseLifecycleState(rehash(transplanted)), /integrity check failed/);
  for (const field of ["prompt", "task", "output", "context", "provider", "model", "session", "thread", "claim", "lease", "user", "agent", "repo", "path", "url"]) {
    const privateValue = "C:\\secret\\private-value";
    assert.throws(() => checkpointJobLifecycle(state(), { ...checkpoint(), [field]: privateValue }), (error: unknown) => { assert.doesNotMatch(String(error), /private-value/); return true; });
  }
  assert.throws(() => checkpointJobLifecycle(state(), checkpoint({ artifactSha256: Array.from({ length: 33 }, () => digest) })), /invalid/);
  assert.throws(() => parseLifecycleState({ ...first.state, checkpointHistory: Array.from({ length: 33 }, () => first.state.checkpointHistory[0]) }), /invalid/);
  assert.throws(() => checkpointJobLifecycle(state(), checkpoint({ completedStepOrdinals: [0] })), /invalid/);
  assert.throws(() => checkpointJobLifecycle(state(), checkpoint({ metrics: { stepsCompleted: 1.1, reworkCount: -1, testsPassed: 0 } })), /invalid/);
  assert.throws(() => checkpointJobLifecycle(first.state, checkpoint({ idempotencyKey: "checkpoint-0002", completedStepOrdinals: [] })), /invalid/);
});

test("completed lifecycle requires proof and terminal behavior is deterministic", () => {
  const partial = checkpointJobLifecycle(state(), checkpoint());
  assert.throws(() => completeJobLifecycle(partial.state, terminal()), /cannot be marked completed/);
  const full = checkpointJobLifecycle(state(), checkpoint({ completedStepOrdinals: [1, 2, 3, 4, 5], metrics: { stepsCompleted: 5, reworkCount: 0, testsPassed: 4 } }));
  const completed = completeJobLifecycle(full.state, terminal());
  assert.equal(completed.state.status, "completed");
  assert.equal(completed.receipt.lifecycleSha256, completed.state.lifecycleSha256);
  assert.equal(completed.receipt.lastCheckpointSha256, full.state.lastCheckpointSha256);
  assert.equal(completed.receipt.completedStepCount, 5);
  assert.equal(completeJobLifecycle(completed.state, terminal()).replayed, true);
  assert.throws(() => completeJobLifecycle(completed.state, terminal({ evidenceSha256: "b".repeat(64) })), /idempotency key conflicts/);
  assert.throws(() => completeJobLifecycle(completed.state, terminal({ idempotencyKey: "terminal-0002" })), /already terminal/);
  assert.throws(() => checkpointJobLifecycle(completed.state, checkpoint({ idempotencyKey: "checkpoint-0002", completedStepOrdinals: [1, 2, 3, 4, 5], metrics: { stepsCompleted: 5, reworkCount: 0, testsPassed: 4 } })), /already terminal/);
});

test("terminal inputs enforce combinations, timestamp ordering, and receipt parsing", () => {
  const full = checkpointJobLifecycle(state(), checkpoint({ completedStepOrdinals: [1, 2, 3, 4, 5], metrics: { stepsCompleted: 5, reworkCount: 0, testsPassed: 4 }, recordedAt: "2026-08-28T20:04:00.000Z" }));
  assert.throws(() => completeJobLifecycle(full.state, terminal({ validationStatus: "failed" })), /invalid/);
  assert.throws(() => completeJobLifecycle(full.state, terminal({ completedAt: "2026-08-28T20:03:59.000Z" })), /invalid/);
  for (const values of [
    { status: "failed", reasonCode: "validation_failed", validationStatus: "failed" },
    { status: "failed", reasonCode: "execution_error", validationStatus: "not_run" },
    { status: "blocked", reasonCode: "blocked", validationStatus: "not_run" },
    { status: "cancelled", reasonCode: "cancelled", validationStatus: "not_run" },
    { status: "budget_exhausted", reasonCode: "budget_limit", validationStatus: "not_run" },
  ]) {
    const result = completeJobLifecycle(state(), { ...terminal(), ...values, completedAt: "2026-08-28T20:01:00.000Z" });
    assert.equal(result.receipt.status, values.status);
    assert.deepEqual(parseLifecycleState({ ok: true, state: result.state, receipt: result.receipt, replayed: false }), result.state);
  }
});
