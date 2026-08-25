import assert from "node:assert/strict";
import test from "node:test";
import type { ModelProfile, ProviderAdapter, RouteRequest } from "../src/contracts.js";
import { FakeProvider } from "../src/fake-provider.js";
import { AgentRuntime } from "../src/runtime.js";

const profile: ModelProfile = {
  modelId: "fake.test",
  providerId: "fake",
  health: "healthy",
  qualityScore: 90,
  reliabilityBasisPoints: 9_999,
  estimatedCostMicroUsd: 0,
  estimatedLatencyMs: 1,
  dataBoundaries: ["local_only"],
  capabilities: {
    toolUse: false,
    structuredOutput: true,
    contextTokens: 32_000,
    modalities: ["text"],
  },
};

const readRoute: RouteRequest = {
  phase: "research",
  risk: "read",
  requirements: {
    toolUse: false,
    structuredOutput: true,
    minContextTokens: 1_000,
    modalities: ["text"],
  },
  constraints: { dataBoundary: "local_only" },
};

function runtime(provider: FakeProvider): AgentRuntime {
  return new AgentRuntime([provider], {
    clock: () => "2026-08-25T00:00:00.000Z",
    idFactory: () => "run-fixed",
  });
}

test("read-only execution completes through the fake provider", async () => {
  const provider = new FakeProvider(profile, {
    response: "synthetic output",
    chunkSize: 5,
    inputTokens: 3,
    outputTokens: 4,
  });
  const result = await runtime(provider).run({
    task: "private task body",
    profile: "read-only",
    route: readRoute,
  });
  assert.equal(result.output, "synthetic output");
  assert.equal(result.receipt.status, "completed");
  assert.equal(provider.runCount, 1);
  assert.equal(Object.isFrozen(provider), true);
  assert.equal(Object.isFrozen(provider.profile), true);
  assert.equal(Object.isFrozen(provider.profile.capabilities), true);
  assert.equal(result.receipt.usage.outputTokens, 4);
  const receiptJson = JSON.stringify(result.receipt);
  assert.doesNotMatch(receiptJson, /private task body/);
  assert.doesNotMatch(receiptJson, /synthetic output/);
  assert.match(result.receipt.inputSha256, /^[a-f0-9]{64}$/);
  assert.match(result.receipt.outputSha256 ?? "", /^[a-f0-9]{64}$/);
  const chunkEvents = result.events.filter((event) => event.type === "provider.chunk");
  assert.ok(chunkEvents.length > 0);
  assert.ok(chunkEvents.every((event) => !("chunkSha256" in event)));
});

test("non-read execution is blocked before the provider runs", async () => {
  const provider = new FakeProvider(profile, { response: "must not run" });
  const result = await runtime(provider).run({
    task: "change a file",
    profile: "read-only",
    route: { ...readRoute, risk: "workspace_write" },
  });
  assert.equal(result.receipt.status, "blocked");
  assert.equal(provider.probeCount, 0);
  assert.equal(provider.runCount, 0);
  assert.ok(result.receipt.reasonCodes.includes("phase0_non_read_rejected"));
});

test("an empty task is blocked before probe or execution", async () => {
  const provider = new FakeProvider(profile, { response: "must not run" });
  const result = await runtime(provider).run({
    task: "   ",
    profile: "read-only",
    route: readRoute,
  });
  assert.equal(result.receipt.status, "blocked");
  assert.equal(provider.probeCount, 0);
  assert.equal(provider.runCount, 0);
  assert.ok(result.receipt.reasonCodes.includes("task_empty"));
});

test("provider failure produces a truthful failed receipt", async () => {
  const provider = new FakeProvider(profile, { failRun: true });
  const result = await runtime(provider).run({
    task: "read something",
    profile: "read-only",
    route: readRoute,
  });
  assert.equal(result.receipt.status, "failed");
  assert.equal(result.output, undefined);
  assert.ok(result.receipt.reasonCodes.includes("provider_execution_failed"));
});

test("doctor converts a thrown probe into a stable unavailable result", async () => {
  const provider = new FakeProvider(profile, { failProbe: true });
  const report = await runtime(provider).doctor();
  assert.equal(report.overall, "not_ready");
  assert.equal(report.checks[0]?.code, "probe_failed");
});

test("routing preserves the probe-failure diagnostic", async () => {
  const provider = new FakeProvider(profile, { failProbe: true });
  const plan = await runtime(provider).plan(readRoute);
  assert.equal(plan.selectedModelId, null);
  assert.deepEqual(plan.rejected[0]?.reasonCodes, ["health_unavailable", "probe_failed"]);
});

test("runtime construction rejects every non-authentic fake adapter", () => {
  const liveAdapter: ProviderAdapter = {
    executionKind: "live",
    profile,
    async probe(checkedAt) {
      return {
        modelId: profile.modelId,
        providerId: profile.providerId,
        state: "healthy",
        code: "live_ready",
        checkedAt,
      };
    },
    async *run() {
      yield { type: "delta", text: "must not run" };
    },
  };
  const forgedSynthetic = { ...liveAdapter, executionKind: "synthetic" as const };
  const prototypeGraft = Object.create(FakeProvider.prototype) as FakeProvider;
  Object.defineProperties(prototypeGraft, {
    profile: { value: profile, enumerable: true },
    probe: { value: liveAdapter.probe, enumerable: true },
    run: { value: liveAdapter.run, enumerable: true },
  });
  class FakeProviderSubclass extends FakeProvider {}
  assert.throws(
    () => new AgentRuntime([liveAdapter as unknown as FakeProvider]),
    /exact FakeProvider instances only/,
  );
  assert.throws(
    () => new AgentRuntime([forgedSynthetic as unknown as FakeProvider]),
    /exact FakeProvider instances only/,
  );
  assert.throws(
    () => new AgentRuntime([prototypeGraft]),
    /exact FakeProvider instances only/,
  );
  assert.throws(
    () => new AgentRuntime([new FakeProviderSubclass(profile)]),
    /exact FakeProvider instances only/,
  );
});
