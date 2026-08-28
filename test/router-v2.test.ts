import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { ModelProfile, RouteRequestV2 } from "../src/contracts.js";
import { route, routeV2 } from "../src/router.js";

const request: RouteRequestV2 = {
  phase: "research", risk: "read", objective: "balanced",
  requirements: { toolUse: false, structuredOutput: true, minContextTokens: 8_000, modalities: ["text"] },
  constraints: { dataBoundary: "approved_provider" },
  normalization: { basis: "request_budget", costAnchorMicroUsd: 1_000, latencyAnchorMs: 1_000 },
};

function profile(modelId: string, overrides: Partial<ModelProfile> = {}): ModelProfile {
  return {
    modelId, providerId: "test-provider", health: "healthy", qualityScore: 80,
    reliabilityBasisPoints: 9_900, estimatedCostMicroUsd: 200, estimatedLatencyMs: 200,
    dataBoundaries: ["approved_provider"], riskClasses: ["read"],
    capabilities: { toolUse: true, structuredOutput: true, contextTokens: 32_000, modalities: ["text"] },
    ...overrides,
  };
}

test("v1 production fixture is byte-shape stable", () => {
  const input = JSON.parse(readFileSync("examples/route-request.json", "utf8")) as { request: unknown; models: unknown };
  const golden = JSON.parse(readFileSync("test/fixtures/route-v1-golden.json", "utf8")) as unknown;
  assert.deepEqual(route(input.request, input.models), golden);
});

test("v2 request-budget scores remain stable when irrelevant dominated profiles change", () => {
  const cheap = profile("cheap", { qualityScore: 80, estimatedCostMicroUsd: 200, estimatedLatencyMs: 200 });
  const capable = profile("capable", { qualityScore: 90, estimatedCostMicroUsd: 500, estimatedLatencyMs: 300 });
  const dominated = profile("dominated", { qualityScore: 70, reliabilityBasisPoints: 9_800, estimatedCostMicroUsd: 600, estimatedLatencyMs: 400 });
  const reduced = routeV2(request, [cheap, capable]);
  const full = routeV2(request, [cheap, capable, dominated]);
  const reducedById = new Map(reduced.eligible.map((candidate) => [candidate.modelId, candidate]));
  const fullById = new Map(full.eligible.map((candidate) => [candidate.modelId, candidate]));
  assert.deepEqual(fullById.get("cheap"), reducedById.get("cheap"));
  assert.deepEqual(fullById.get("capable"), reducedById.get("capable"));
  assert.deepEqual(full.paretoFrontierModelIds, reduced.paretoFrontierModelIds);
  assert.equal(full.selectedModelId, reduced.selectedModelId);
});

test("v2 rejects missing, zero, and unsafe request-budget anchors without accepting v1 shapes", () => {
  const missing = { ...request, normalization: undefined };
  const zero = { ...request, normalization: { ...request.normalization, costAnchorMicroUsd: 0 } };
  const unsafe = { ...request, normalization: { ...request.normalization, latencyAnchorMs: Number.MAX_SAFE_INTEGER + 1 } };
  assert.throws(() => routeV2(missing, [profile("valid")]), /routing payload is invalid/);
  assert.throws(() => routeV2(zero, [profile("valid")]), /routing payload is invalid/);
  assert.throws(() => routeV2(unsafe, [profile("valid")]), /routing payload is invalid/);
  assert.throws(() => route({ ...request }, [profile("valid")]), /routing payload is invalid/);
});

test("v2 retains independent hard-ceiling rejection before Pareto scoring", () => {
  const plan = routeV2({ ...request, constraints: { dataBoundary: "approved_provider", maxCostMicroUsd: 100, maxLatencyMs: 100 } }, [
    profile("over-cost", { estimatedCostMicroUsd: 101, estimatedLatencyMs: 100 }),
    profile("over-latency", { estimatedCostMicroUsd: 100, estimatedLatencyMs: 101 }),
  ]);
  assert.equal(plan.selectedModelId, null);
  assert.deepEqual(plan.paretoFrontierModelIds, []);
  assert.ok(plan.rejected.find((candidate) => candidate.modelId === "over-cost")?.reasonCodes.includes("cost_budget_exceeded"));
  assert.ok(plan.rejected.find((candidate) => candidate.modelId === "over-latency")?.reasonCodes.includes("latency_budget_exceeded"));
  assert.deepEqual(plan.decisionCodes, ["normalization_request_budget", "pareto_frontier_computed", "no_eligible_model", "policy_blocked"]);
});

test("v2 keeps all equal profiles on the frontier and uses deterministic tie selection", () => {
  const plan = routeV2(request, [profile("z.model"), profile("A.model")]);
  assert.deepEqual(plan.paretoFrontierModelIds, ["A.model", "z.model"]);
  assert.equal(plan.selectedModelId, "A.model");
  assert.ok(plan.decisionCodes.includes("normalization_request_budget"));
  assert.ok(plan.decisionCodes.includes("pareto_frontier_computed"));
  assert.ok(plan.decisionCodes.includes("model_selected"));
});

test("v2 excludes dominated profiles and permits incumbent only for an exact frontier tie", () => {
  const dominant = profile("dominant", { qualityScore: 90, reliabilityBasisPoints: 9_950, estimatedCostMicroUsd: 100, estimatedLatencyMs: 100 });
  const dominated = profile("dominated", { qualityScore: 80, reliabilityBasisPoints: 9_900, estimatedCostMicroUsd: 200, estimatedLatencyMs: 200 });
  const dominancePlan = routeV2(request, [dominant, dominated]);
  assert.deepEqual(dominancePlan.paretoFrontierModelIds, ["dominant"]);
  assert.equal(dominancePlan.selectedModelId, "dominant");
  assert.ok(!dominancePlan.decisionCodes.includes("selected_is_dominated"));

  const tiedIncumbent = routeV2({ ...request, incumbentModelId: "z.model" }, [profile("A.model"), profile("z.model")]);
  assert.equal(tiedIncumbent.selectedModelId, "z.model");
  assert.ok(tiedIncumbent.decisionCodes.includes("incumbent_exact_score_tie_break"));
  assert.equal(tiedIncumbent.eligible.find((candidate) => candidate.modelId === "z.model")?.components.cost, tiedIncumbent.eligible.find((candidate) => candidate.modelId === "A.model")?.components.cost);

  const noBonus = routeV2({ ...request, incumbentModelId: "incumbent" }, [profile("winner", { qualityScore: 100 }), profile("incumbent", { qualityScore: 80 })]);
  assert.equal(noBonus.selectedModelId, "winner");
  assert.ok(!noBonus.decisionCodes.includes("incumbent_exact_score_tie_break"));
});
