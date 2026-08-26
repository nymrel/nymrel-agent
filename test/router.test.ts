import assert from "node:assert/strict";
import test from "node:test";
import type { ModelProfile, RouteRequest } from "../src/contracts.js";
import { route } from "../src/router.js";

const baseRequest: RouteRequest = {
  phase: "research", risk: "read", objective: "balanced",
  requirements: { toolUse: false, structuredOutput: true, minContextTokens: 8_000, modalities: ["text"] },
  constraints: { dataBoundary: "approved_provider" },
};

function profile(modelId: string, overrides: Partial<ModelProfile> = {}): ModelProfile {
  return {
    modelId, providerId: "test-provider", health: "healthy", qualityScore: 80,
    reliabilityBasisPoints: 9_900, estimatedCostMicroUsd: 10_000, estimatedLatencyMs: 200,
    dataBoundaries: ["approved_provider"], riskClasses: ["read"],
    capabilities: { toolUse: true, structuredOutput: true, contextTokens: 32_000, modalities: ["text"] },
    ...overrides,
  };
}

test("routing is deterministic and breaks equal scores by model id", () => {
  const plan = route(baseRequest, [profile("z.model"), profile("Z.model")]);
  assert.equal(plan.selectedModelId, "Z.model");
  assert.deepEqual(plan.eligible.map((candidate) => candidate.modelId), ["Z.model", "z.model"]);
});

test("routing explains capability, boundary, risk, health, cost, and latency rejections", () => {
  const request: RouteRequest = { ...baseRequest, risk: "workspace_write", constraints: { dataBoundary: "approved_provider", maxCostMicroUsd: 20_000, maxLatencyMs: 1_000 } };
  const plan = route(request, [
    profile("offline", { health: "unavailable", riskClasses: ["workspace_write"] }),
    profile("local", { dataBoundaries: ["local_only"], riskClasses: ["workspace_write"] }),
    profile("read-only"),
    profile("small", { riskClasses: ["workspace_write"], capabilities: { toolUse: true, structuredOutput: true, contextTokens: 100, modalities: ["text"] } }),
    profile("expensive", { riskClasses: ["workspace_write"], estimatedCostMicroUsd: 20_001 }),
    profile("slow", { riskClasses: ["workspace_write"], estimatedLatencyMs: 1_001 }),
  ]);
  assert.equal(plan.selectedModelId, null);
  const reasons = new Map(plan.rejected.map((entry) => [entry.modelId, entry.reasonCodes]));
  assert.deepEqual(reasons.get("local"), ["data_boundary_unsupported"]);
  assert.deepEqual(reasons.get("offline"), ["health_unavailable"]);
  assert.deepEqual(reasons.get("read-only"), ["risk_class_unsupported"]);
  assert.deepEqual(reasons.get("small"), ["context_too_small"]);
  assert.deepEqual(reasons.get("expensive"), ["cost_budget_exceeded"]);
  assert.deepEqual(reasons.get("slow"), ["latency_budget_exceeded"]);
});

test("risk classes are routable metadata when a profile explicitly supports them", () => {
  const plan = route({ ...baseRequest, risk: "workspace_write" }, [profile("write-capable", { riskClasses: ["read", "workspace_write"] })]);
  assert.equal(plan.selectedModelId, "write-capable");
});

test("quality and cost objectives produce explainably different winners", () => {
  const quality = profile("quality", { qualityScore: 100, estimatedCostMicroUsd: 100_000, estimatedLatencyMs: 1_000 });
  const economy = profile("economy", { qualityScore: 70, estimatedCostMicroUsd: 0, estimatedLatencyMs: 100 });
  assert.equal(route({ ...baseRequest, objective: "quality" }, [quality, economy]).selectedModelId, "quality");
  assert.equal(route({ ...baseRequest, objective: "cost" }, [quality, economy]).selectedModelId, "economy");
});

test("explicit ceilings keep cost and latency scores stable when catalog membership changes", () => {
  const request: RouteRequest = {
    ...baseRequest,
    constraints: { dataBoundary: "approved_provider", maxCostMicroUsd: 100_000, maxLatencyMs: 1_000 },
  };
  const lower = profile("lower", { estimatedCostMicroUsd: 20_000, estimatedLatencyMs: 200 });
  const middle = profile("middle", { estimatedCostMicroUsd: 60_000, estimatedLatencyMs: 600 });
  const upper = profile("upper", { estimatedCostMicroUsd: 90_000, estimatedLatencyMs: 900 });

  const full = route(request, [lower, middle, upper]);
  const reduced = route(request, [lower, middle]);
  const fullById = new Map(full.eligible.map((candidate) => [candidate.modelId, candidate]));
  const reducedById = new Map(reduced.eligible.map((candidate) => [candidate.modelId, candidate]));

  assert.equal(fullById.get("lower")?.components.cost, 1_600);
  assert.equal(fullById.get("lower")?.components.latency, 1_200);
  assert.equal(fullById.get("middle")?.components.cost, 800);
  assert.equal(fullById.get("middle")?.components.latency, 600);
  assert.ok((fullById.get("middle")?.components.cost ?? 0) > 0);
  assert.deepEqual(reducedById.get("lower")?.components, fullById.get("lower")?.components);
  assert.deepEqual(reducedById.get("middle")?.components, fullById.get("middle")?.components);
  assert.deepEqual(reduced.eligible.map((candidate) => candidate.modelId), ["lower", "middle"]);
});

test("zero ceilings give a fully compliant zero-cost zero-latency model full utility", () => {
  const plan = route({
    ...baseRequest,
    constraints: { dataBoundary: "approved_provider", maxCostMicroUsd: 0, maxLatencyMs: 0 },
  }, [profile("zero", { estimatedCostMicroUsd: 0, estimatedLatencyMs: 0 })]);

  assert.equal(plan.eligible[0]?.components.cost, 2_000);
  assert.equal(plan.eligible[0]?.components.latency, 1_500);
});

test("an incumbent receives a visible stickiness bonus", () => {
  const plan = route({ ...baseRequest, incumbentModelId: "z.model" }, [profile("a.model"), profile("z.model")]);
  assert.equal(plan.selectedModelId, "z.model");
  assert.equal(plan.eligible[0]?.components.stickiness, 250);
});

test("invalid and duplicate profiles fail closed", () => {
  assert.throws(
    () => route(baseRequest, [profile("invalid", { qualityScore: 101 })]),
    /routing payload is invalid/,
  );
  const duplicate = route(baseRequest, [profile("duplicate"), profile("duplicate")]);
  assert.equal(duplicate.selectedModelId, null);
  assert.ok(duplicate.rejected.every((entry) => entry.reasonCodes.includes("duplicate_model_id")));
  assert.throws(
    () => route(baseRequest, [profile("bad-health", { health: "unknown" as ModelProfile["health"] })]),
    /routing payload is invalid/,
  );
});

test("the exported router rejects malformed JavaScript runtime shapes deterministically", () => {
  const malformedProfiles: unknown[] = [
    [null],
    [{ modelId: "missing-fields" }],
    [{ ...profile("scalar-arrays"), dataBoundaries: "approved_provider" }],
    [{ ...profile("missing-capabilities"), capabilities: null }],
  ];
  for (const profiles of malformedProfiles) {
    assert.throws(() => route(baseRequest, profiles), /routing payload is invalid/);
  }
  assert.throws(() => route(null, [profile("valid")]), /routing payload is invalid/);
});
