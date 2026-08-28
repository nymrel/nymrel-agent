import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { boundedResponseBody } from "../src/cli.js";
import { isLoopbackHostname } from "../src/url-security.js";

const cli = path.join(process.cwd(), "dist", "src", "bin", "nymrel-agent.js");
function runCli(args: readonly string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: process.cwd(), encoding: "utf8", env: { PATH: process.env.PATH } });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

test("CLI routes the public example locally", () => {
  const result = runCli(["route", "--file", "examples/route-request.json"]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout) as { ok: boolean; plan: { selectedModelId: string } };
  assert.equal(payload.ok, true);
  assert.equal(payload.plan.selectedModelId, "provider-b/fast");
});

test("CLI defaults to v1 and requires an explicit v2 contract version", () => {
  const v2 = runCli(["route", "--contract-version", "v2", "--file", "examples/route-request-v2.json"]);
  assert.equal(v2.status, 0, v2.stderr);
  const v2Payload = JSON.parse(v2.stdout) as { plan: { contractVersion: string; paretoFrontierModelIds: string[] } };
  assert.equal(v2Payload.plan.contractVersion, "nymrel.agent.route/v2");
  assert.deepEqual(v2Payload.plan.paretoFrontierModelIds, ["provider-a/reasoning-large", "provider-b/fast"]);

  const defaultV1 = runCli(["route", "--file", "examples/route-request-v2.json"]);
  assert.equal(defaultV1.status, 65);
  assert.match(defaultV1.stderr, /invalid_request/);
  const invalidVersion = runCli(["route", "--contract-version", "v3", "--file", "examples/route-request-v2.json"]);
  assert.equal(invalidVersion.status, 64);
});

test("CLI produces a local-only Job Mode plan", () => {
  const result = runCli(["job", "plan", "--file", "examples/job-48h-game-builder.json"]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout) as { ok: boolean; plan: { profile: string; status: string; summary: { externalHandoffRequiredSteps: number } }; receipt: { status: string } };
  assert.equal(payload.ok, true);
  assert.equal(payload.plan.profile, "plan-only");
  assert.equal(payload.plan.status, "ready_with_handoffs");
  assert.equal(payload.plan.summary.externalHandoffRequiredSteps, 2);
  assert.equal(payload.receipt.status, "planned");
});

test("CLI renders a concise Job Mode summary without changing JSON default", () => {
  const result = runCli(["job", "plan", "--file", "examples/job-48h-game-builder.json", "--format", "summary"]);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.split(/\r?\n/).filter(Boolean).length <= 40);
  assert.match(result.stdout, /local plan only/);
  assert.match(result.stdout, /external-handoff-required/);
  assert.match(result.stdout, /policy:/);
});

test("CLI rejects an oversized Job Mode manifest before parsing", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "nymrel-agent-job-"));
  try {
    const manifestPath = path.join(directory, "oversized.json");
    writeFileSync(manifestPath, " ".repeat((256 * 1024) + 1), "utf8");
    const result = runCli(["job", "plan", "--file", manifestPath]);
    assert.equal(result.status, 65);
    assert.match(result.stderr, /invalid_request/);
    assert.doesNotMatch(result.stderr, new RegExp(manifestPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("CLI lifecycle accepts its own saved envelopes for checkpoint and terminal transitions", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "nymrel-agent-lifecycle-"));
  try {
    const manifest = path.join(directory, "manifest.json");
    const checkpoint = path.join(directory, "checkpoint.json");
    const terminal = path.join(directory, "terminal.json");
    const initialized = path.join(directory, "initialized.json");
    const progressed = path.join(directory, "progressed.json");
    writeFileSync(manifest, readFileSync("examples/job-48h-game-builder.json", "utf8"));
    writeFileSync(checkpoint, JSON.stringify({ contractVersion: "nymrel.agent.job.checkpoint-input/v1", idempotencyKey: "cli-checkpoint-0001", phase: "review", status: "active", nextActionCode: "validate", completedStepOrdinals: [1, 2, 3, 4, 5], artifactSha256: ["a".repeat(64)], metrics: { stepsCompleted: 5, reworkCount: 0, testsPassed: 1 }, recordedAt: "2026-08-28T20:01:00.000Z" }));
    writeFileSync(terminal, JSON.stringify({ contractVersion: "nymrel.agent.job.terminal-input/v1", idempotencyKey: "cli-terminal-0001", status: "completed", reasonCode: "success", validationStatus: "passed", evidenceSha256: "b".repeat(64), completedAt: "2026-08-28T20:02:00.000Z" }));
    const init = runCli(["job", "lifecycle", "init", "--file", manifest, "--at", "2026-08-28T20:00:00.000Z"]);
    assert.equal(init.status, 0, init.stderr); writeFileSync(initialized, init.stdout);
    const advanced = runCli(["job", "lifecycle", "checkpoint", "--state-file", initialized, "--file", checkpoint]);
    assert.equal(advanced.status, 0, advanced.stderr); writeFileSync(progressed, advanced.stdout);
    const completed = runCli(["job", "lifecycle", "complete", "--state-file", progressed, "--file", terminal]);
    assert.equal(completed.status, 0, completed.stderr);
    const result = JSON.parse(completed.stdout) as { state: { status: string }; replayed: boolean };
    assert.equal(result.state.status, "completed"); assert.equal(result.replayed, false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("CLI retains the full maximum-domain lifecycle envelope through terminal completion", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "nymrel-agent-lifecycle-max-"));
  try {
    const fixture = JSON.parse(readFileSync("examples/job-48h-game-builder.json", "utf8")) as { contractVersion: string; models: unknown; steps: Array<{ request: unknown }> };
    const manifestPath = path.join(directory, "manifest.json");
    const statePath = path.join(directory, "state.json");
    const checkpointPath = path.join(directory, "checkpoint.json");
    const terminalPath = path.join(directory, "terminal.json");
    const maxManifest = {
      contractVersion: fixture.contractVersion,
      jobId: "maximum-domain-lifecycle",
      models: fixture.models,
      steps: Array.from({ length: 32 }, (_, index) => ({ stepId: `step-${String(index + 1).padStart(2, "0")}`, dependsOn: index === 0 ? [] : [`step-${String(index).padStart(2, "0")}`], request: fixture.steps[0]!.request })),
    };
    writeFileSync(manifestPath, JSON.stringify(maxManifest));
    const initialized = runCli(["job", "lifecycle", "init", "--file", manifestPath, "--at", "2026-08-28T20:00:00.000Z"]);
    assert.equal(initialized.status, 0, initialized.stderr);
    writeFileSync(statePath, initialized.stdout);
    const artifactSha256 = Array.from({ length: 32 }, (_, index) => index.toString(16).padStart(64, "a"));
    const completedStepOrdinals = Array.from({ length: 32 }, (_, index) => index + 1);
    for (let sequence = 1; sequence <= 32; sequence += 1) {
      const idempotencyKey = `c${String(sequence).padStart(3, "0")}${"x".repeat(124)}`;
      writeFileSync(checkpointPath, JSON.stringify({ contractVersion: "nymrel.agent.job.checkpoint-input/v1", idempotencyKey, phase: "review", status: "active", nextActionCode: "validate", completedStepOrdinals, artifactSha256, metrics: { stepsCompleted: 32, reworkCount: 1_000_000, testsPassed: 1_000_000 }, recordedAt: `2026-08-28T20:00:${String(sequence).padStart(2, "0")}.000Z` }));
      const advanced = runCli(["job", "lifecycle", "checkpoint", "--state-file", statePath, "--file", checkpointPath]);
      assert.equal(advanced.status, 0, advanced.stderr);
      writeFileSync(statePath, advanced.stdout);
    }
    const savedEnvelope = readFileSync(statePath, "utf8");
    const savedEnvelopeBytes = Buffer.byteLength(savedEnvelope, "utf8");
    assert.ok(savedEnvelopeBytes > 128 * 1024, "regression must exceed the former 128 KiB state limit");
    assert.ok(savedEnvelopeBytes <= 192 * 1024, "maximum-domain envelope must fit the documented 192 KiB bound");
    assert.ok((192 * 1024) - savedEnvelopeBytes >= 32 * 1024, "documented state-envelope headroom must remain at least 32 KiB");
    writeFileSync(terminalPath, JSON.stringify({ contractVersion: "nymrel.agent.job.terminal-input/v1", idempotencyKey: `t${"x".repeat(127)}`, status: "completed", reasonCode: "success", validationStatus: "passed", evidenceSha256: "b".repeat(64), completedAt: "2026-08-28T20:01:00.000Z" }));
    const completed = runCli(["job", "lifecycle", "complete", "--state-file", statePath, "--file", terminalPath]);
    assert.equal(completed.status, 0, completed.stderr);
    assert.equal((JSON.parse(completed.stdout) as { state: { status: string } }).state.status, "completed");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("CLI rejects bounded stdin paths before buffering", () => {
  const manifest = runCli(["job", "plan", "--file", "-"]);
  assert.equal(manifest.status, 65); assert.match(manifest.stderr, /invalid_request/);
  const state = runCli(["job", "lifecycle", "checkpoint", "--state-file", "-", "--file", "examples/lifecycle-checkpoint.example.json"]);
  assert.equal(state.status, 65); assert.match(state.stderr, /invalid_request/);
});

test("CLI doctor and demo are offline and truthful", () => {
  const doctor = runCli(["models", "doctor"]);
  assert.equal(doctor.status, 0, doctor.stderr);
  const report = JSON.parse(doctor.stdout) as { checks: Array<{ providerId: string }> };
  assert.ok(report.checks.every((check) => check.providerId.startsWith("demo-")));
  const demo = runCli(["demo"]);
  assert.equal(demo.status, 0, demo.stderr);
  const run = JSON.parse(demo.stdout) as { receipt: { reasonCodes: string[] } };
  assert.ok(run.receipt.reasonCodes.includes("synthetic_provider_verified"));
});

test("CLI exposes the stable product contract", () => {
  const result = runCli(["contract"]);
  assert.equal(result.status, 0, result.stderr);
  const contract = JSON.parse(result.stdout) as { contractVersion: string; publicExecution: boolean };
  assert.equal(contract.contractVersion, "nymrel.agent.route/v1");
  assert.equal(contract.publicExecution, false);
});

test("CLI fails closed on unknown routing fields", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "nymrel-agent-cli-"));
  try {
    const input = path.join(directory, "invalid.json");
    writeFileSync(input, JSON.stringify({ request: {}, models: [], prompt: "must-not-be-accepted" }));
    const result = runCli(["route", "--file", input]);
    assert.equal(result.status, 65);
    assert.match(result.stderr, /invalid_request/);
    assert.doesNotMatch(result.stderr, /must-not-be-accepted/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("CLI reports a missing local credential by variable name only", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "nymrel-agent-config-"));
  try {
    const example = JSON.parse(requireText("examples/route-request.json")) as Record<string, unknown>;
    const models = example.models as Array<Record<string, unknown>>;
    const model = { ...models[0], modelId: "openai/example", providerId: "openai", riskClasses: ["read"], capabilities: { toolUse: false, structuredOutput: false, contextTokens: 128000, modalities: ["text"] } };
    const config = path.join(directory, "config.json");
    writeFileSync(config, JSON.stringify({ route: { ...(example.request as Record<string, unknown>), risk: "read" }, models: [model], adapters: [{ kind: "openai-responses", modelId: "openai/example", providerModelId: "example", apiKeyEnv: "OPENAI_API_KEY" }] }));
    const result = runCli(["run", "--config", config, "--task", "safe local task"]);
    assert.equal(result.status, 69);
    assert.match(result.stderr, /OPENAI_API_KEY/);
    assert.doesNotMatch(result.stderr, /safe local task/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("CLI rejects missing, duplicate, and unknown option values", () => {
  const missingEndpoint = runCli(["route", "--file", "examples/route-request.json", "--endpoint"]);
  assert.equal(missingEndpoint.status, 64);
  assert.match(missingEndpoint.stderr, /usage_error/);
  assert.doesNotMatch(missingEndpoint.stdout, /"requestId": "local"/);

  const duplicate = runCli(["route", "--file", "examples/route-request.json", "--file", "examples/route-request.json"]);
  assert.equal(duplicate.status, 64);
  const unknown = runCli(["route", "--file", "examples/route-request.json", "--unknown", "value"]);
  assert.equal(unknown.status, 64);
});

test("CLI preserves endpoint validation errors before transport", () => {
  for (const endpoint of [
    "not a url",
    "http://example.com",
    "https://example.com?source=dogfood",
    "https://example.com#dogfood",
    "https://user:password@example.com",
  ]) {
    const result = runCli(["route", "--file", "examples/route-request.json", "--endpoint", endpoint]);
    assert.equal(result.status, 64, `${endpoint}: ${result.stderr}`);
    assert.match(result.stderr, /endpoint_invalid/);
    assert.doesNotMatch(result.stderr, /endpoint_unavailable/);
  }
});

test("CLI loopback transport policy rejects attacker-controlled 127-prefixed hosts", () => {
  assert.equal(isLoopbackHostname("localhost"), true);
  assert.equal(isLoopbackHostname("::1"), true);
  assert.equal(isLoopbackHostname("127.0.0.2"), true);
  assert.equal(isLoopbackHostname("127.attacker.example"), false);
  assert.equal(isLoopbackHostname("127.0.0.1.attacker.example"), false);
});

test("CLI response reader cancels chunked oversized endpoint responses", async () => {
  let produced = 0;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      produced += 1;
      controller.enqueue(new Uint8Array(64 * 1024));
      if (produced === 20) controller.close();
    },
    cancel() { cancelled = true; },
  });
  await assert.rejects(() => boundedResponseBody(new Response(body), 256 * 1024), /oversized response/);
  assert.equal(cancelled, true);
  assert.ok(produced < 20);
});

function requireText(file: string): string {
  return readFileSync(file, "utf8");
}
