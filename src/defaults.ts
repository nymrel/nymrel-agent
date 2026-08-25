import type { DataBoundary, ModelProfile, RouteRequest } from "./contracts.js";
import { FakeProvider } from "./fake-provider.js";
import { AgentRuntime } from "./runtime.js";

const profiles: readonly ModelProfile[] = [
  {
    modelId: "demo.frontier.general", providerId: "demo-cloud", health: "healthy",
    qualityScore: 92, reliabilityBasisPoints: 9_800, estimatedCostMicroUsd: 25_000,
    estimatedLatencyMs: 900, dataBoundaries: ["approved_provider"], riskClasses: ["read"],
    capabilities: { toolUse: true, structuredOutput: true, contextTokens: 128_000, modalities: ["text", "image"] },
  },
  {
    modelId: "demo.local.text", providerId: "demo-local", health: "healthy",
    qualityScore: 65, reliabilityBasisPoints: 9_900, estimatedCostMicroUsd: 0,
    estimatedLatencyMs: 50, dataBoundaries: ["local_only", "approved_provider"], riskClasses: ["read"],
    capabilities: { toolUse: false, structuredOutput: true, contextTokens: 16_000, modalities: ["text"] },
  },
  {
    modelId: "demo.fast.general", providerId: "demo-cloud", health: "healthy",
    qualityScore: 75, reliabilityBasisPoints: 9_950, estimatedCostMicroUsd: 5_000,
    estimatedLatencyMs: 250, dataBoundaries: ["approved_provider"], riskClasses: ["read"],
    capabilities: { toolUse: false, structuredOutput: true, contextTokens: 64_000, modalities: ["text"] },
  },
];

export function createDemoAdapters(): FakeProvider[] {
  return profiles.map((profile) => new FakeProvider(profile, {
    response: `Synthetic response from ${profile.modelId}.`, chunkSize: 10, inputTokens: 8, outputTokens: 9,
  }));
}

export function createDemoRuntime(): AgentRuntime {
  return new AgentRuntime(createDemoAdapters());
}

export function createDefaultRouteRequest(dataBoundary: DataBoundary = "approved_provider"): RouteRequest {
  return {
    phase: "research", risk: "read", objective: "balanced",
    requirements: { toolUse: false, structuredOutput: true, minContextTokens: 8_000, modalities: ["text"] },
    constraints: { dataBoundary, maxCostMicroUsd: 50_000, maxLatencyMs: 2_000 },
  };
}
