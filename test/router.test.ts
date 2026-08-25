import assert from "node:assert/strict";
import test from "node:test";
import type { ModelProfile, RouteRequest } from "../src/contracts.js";
import { route } from "../src/router.js";

const baseRequest: RouteRequest = {
  phase: "research",
  risk: "read",
  requirements: {
    toolUse: false,
    structuredOutput: true,
    minContextTokens: 8_000,
    modalities: ["text"],
  },
  constraints: { dataBoundary: "approved_provider" },
};

function profile(modelId: string, overrides: Partial<ModelProfile> = {}): ModelProfile {
  return {
    modelId,
    providerId: "fake",
    health: "healthy",
    qualityScore: 80,
    reliabilityBasisPoints: 9_900,
    estimatedCostMicroUsd: 10_000,
    estimatedLatencyMs: 200,
    dataBoundaries: ["approved_provider"],
    capabilities: {
      toolUse: true,
      structuredOutput: true,
      contextTokens: 32_000,
      modalities: ["text"],
    },
    ...overrides,
  };
}

test("routing is deterministic and breaks equal scores by model id", () => {
  const plan = route(baseRequest, [profile("z.model"), profile("a.model")]);
  assert.equal(plan.selectedModelId, "a.model");
  assert.deepEqual(
    plan.eligible.map((candidate) => candidate.modelId),
    ["a.model", "z.model"],
  );
});

test("routing explains every capability and boundary rejection", () => {
  const plan = route(baseRequest, [
    profile("offline", { health: "unavailable" }),
    profile("local", { dataBoundaries: ["local_only"] }),
    profile("small", {
      capabilities: {
        toolUse: true,
        structuredOutput: true,
        contextTokens: 100,
        modalities: ["text"],
      },
    }),
  ]);
  assert.equal(plan.selectedModelId, null);
  assert.deepEqual(plan.rejected[0]?.reasonCodes, ["data_boundary_unsupported"]);
  assert.deepEqual(plan.rejected[1]?.reasonCodes, ["health_unavailable"]);
  assert.deepEqual(plan.rejected[2]?.reasonCodes, ["context_too_small"]);
});

test("phase zero rejects non-read work before scoring", () => {
  const plan = route({ ...baseRequest, risk: "workspace_write" }, [profile("capable")]);
  assert.equal(plan.selectedModelId, null);
  assert.deepEqual(plan.decisionCodes, ["policy_blocked", "phase0_non_read_rejected"]);
  assert.deepEqual(plan.eligible, []);
});

test("an incumbent receives a visible stickiness bonus", () => {
  const plan = route({ ...baseRequest, incumbentModelId: "z.model" }, [
    profile("a.model"),
    profile("z.model"),
  ]);
  assert.equal(plan.selectedModelId, "z.model");
  assert.equal(plan.eligible[0]?.components.stickinessBonus, 250);
});
