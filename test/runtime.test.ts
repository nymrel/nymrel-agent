import assert from "node:assert/strict";
import test from "node:test";
import type { ModelProfile, ProviderAdapter, RouteRequest } from "../src/contracts.js";
import { FakeProvider } from "../src/fake-provider.js";
import { AgentRuntime } from "../src/runtime.js";

const profile: ModelProfile = {
  modelId: "test.model", providerId: "test-provider", health: "healthy", qualityScore: 90,
  reliabilityBasisPoints: 9_999, estimatedCostMicroUsd: 0, estimatedLatencyMs: 1,
  dataBoundaries: ["local_only"], riskClasses: ["read", "workspace_write"],
  capabilities: { toolUse: false, structuredOutput: true, contextTokens: 32_000, modalities: ["text"] },
};
const readRoute: RouteRequest = {
  phase: "research", risk: "read", objective: "balanced",
  requirements: { toolUse: false, structuredOutput: true, minContextTokens: 1_000, modalities: ["text"] },
  constraints: { dataBoundary: "local_only" },
};
function runtime(provider: ProviderAdapter, options: ConstructorParameters<typeof AgentRuntime>[1] = {}): AgentRuntime {
  return new AgentRuntime([provider], { clock: () => "2026-08-25T00:00:00.000Z", idFactory: () => "run-fixed", ...options });
}

test("read-only execution completes and receipts omit task and output bodies", async () => {
  const provider = new FakeProvider(profile, { response: "synthetic output", chunkSize: 5, inputTokens: 3, outputTokens: 4 });
  const result = await runtime(provider).run({ task: "private task body", profile: "read-only", route: readRoute });
  assert.equal(result.output, "synthetic output");
  assert.equal(result.receipt.status, "completed");
  assert.equal(result.receipt.selectedProviderId, "test-provider");
  assert.ok(result.receipt.reasonCodes.includes("synthetic_provider_verified"));
  assert.doesNotMatch(JSON.stringify(result.receipt), /private task body|synthetic output/);
  assert.match(result.receipt.inputSha256, /^[a-f0-9]{64}$/);
  assert.match(result.receipt.outputSha256 ?? "", /^[a-f0-9]{64}$/);
});

test("non-read execution is blocked before provider probe or run", async () => {
  const provider = new FakeProvider(profile, { response: "must not run" });
  const result = await runtime(provider).run({ task: "change a file", profile: "read-only", route: { ...readRoute, risk: "workspace_write" } });
  assert.equal(result.receipt.status, "blocked");
  assert.equal(provider.probeCount, 0);
  assert.equal(provider.runCount, 0);
  assert.ok(result.receipt.reasonCodes.includes("runtime_non_read_rejected"));
});

test("empty and oversized tasks fail closed before execution", async () => {
  const emptyProvider = new FakeProvider(profile);
  assert.equal((await runtime(emptyProvider).run({ task: "  ", profile: "read-only", route: readRoute })).receipt.status, "blocked");
  assert.equal(emptyProvider.runCount, 0);
  const largeProvider = new FakeProvider(profile);
  const large = await runtime(largeProvider).run({ task: "x".repeat(256 * 1024 + 1), profile: "read-only", route: readRoute });
  assert.ok(large.receipt.reasonCodes.includes("task_too_large"));
  assert.equal(largeProvider.runCount, 0);
});

test("an explicit live adapter is accepted and labeled truthfully", async () => {
  let runs = 0;
  const live: ProviderAdapter = {
    executionKind: "live", profile,
    async probe(checkedAt) { return { modelId: profile.modelId, providerId: profile.providerId, state: "healthy", code: "configured", checkedAt }; },
    async *run() { runs += 1; yield { type: "delta", text: "live output" }; yield { type: "usage", inputTokens: 2, outputTokens: 3 }; },
  };
  const result = await runtime(live).run({ task: "read", profile: "read-only", route: readRoute });
  assert.equal(runs, 1);
  assert.equal(result.output, "live output");
  assert.ok(result.receipt.reasonCodes.includes("live_provider_executed"));
});

test("provider failures and output limits produce truthful failed receipts", async () => {
  const failed = await runtime(new FakeProvider(profile, { failRun: true })).run({ task: "read", profile: "read-only", route: readRoute });
  assert.equal(failed.receipt.status, "failed");
  assert.ok(failed.receipt.reasonCodes.includes("provider_execution_failed"));
  const limited = await runtime(new FakeProvider(profile, { response: "too long", chunkSize: 20 }), { maxOutputBytes: 3 }).run({ task: "read", profile: "read-only", route: readRoute });
  assert.equal(limited.receipt.status, "failed");
  assert.ok(limited.receipt.reasonCodes.includes("provider_output_limit"));
});

test("provider failures retain only allowlisted body-free status classes", async () => {
  const failingAdapter = (message: string): ProviderAdapter => ({
    executionKind: "live",
    profile,
    async probe(checkedAt) { return { modelId: profile.modelId, providerId: profile.providerId, state: "healthy", code: "configured", checkedAt }; },
    async *run() { throw new Error(message); },
  });
  const throttled = await runtime(failingAdapter("provider_http_429")).run({ task: "read", profile: "read-only", route: readRoute });
  assert.ok(throttled.receipt.reasonCodes.includes("provider_http_4xx"));
  assert.doesNotMatch(JSON.stringify(throttled.receipt), /429/);
  const incomplete = await runtime(failingAdapter("provider_response_incomplete")).run({ task: "read", profile: "read-only", route: readRoute });
  assert.ok(incomplete.receipt.reasonCodes.includes("provider_response_incomplete"));
});

test("doctor fails closed and duplicate adapter IDs are rejected", async () => {
  const provider = new FakeProvider(profile, { failProbe: true });
  const report = await runtime(provider).doctor();
  assert.equal(report.overall, "not_ready");
  assert.equal(report.checks[0]?.code, "probe_failed");
  assert.throws(() => new AgentRuntime([new FakeProvider(profile), new FakeProvider(profile)]), /Duplicate adapter model id/);
});
