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
