import assert from "node:assert/strict";
import test from "node:test";
import type { ModelProfile, ProviderRunEvent } from "../src/contracts.js";
import { OpenAIResponsesProvider } from "../src/openai-responses-provider.js";

const profile: ModelProfile = {
  modelId: "openai/selected-model", providerId: "openai", health: "healthy", qualityScore: 90,
  reliabilityBasisPoints: 9_900, estimatedCostMicroUsd: 20_000, estimatedLatencyMs: 900,
  dataBoundaries: ["approved_provider"], riskClasses: ["read"],
  capabilities: { toolUse: false, structuredOutput: false, contextTokens: 128_000, modalities: ["text"] },
};

async function collect(provider: OpenAIResponsesProvider): Promise<ProviderRunEvent[]> {
  const events: ProviderRunEvent[] = [];
  for await (const event of provider.run({ runId: "run", task: "local task", phase: "research", risk: "read", maxOutputTokens: 321 })) events.push(event);
  return events;
}

test("OpenAI adapter sends a non-stored Responses request and parses usage", async () => {
  let requestBody: Record<string, unknown> | undefined;
  let authorizationPresent = false;
  const provider = new OpenAIResponsesProvider(profile, {
    apiKey: "credential-value", providerModelId: "selected-model",
    fetcher: async (_input, init) => {
      const headers = new Headers(init?.headers);
      authorizationPresent = headers.has("authorization");
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ output_text: "provider output", usage: { input_tokens: 11, output_tokens: 7 } }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const events = await collect(provider);
  assert.equal(authorizationPresent, true);
  assert.deepEqual(requestBody, { model: "selected-model", input: "local task", max_output_tokens: 321, store: false });
  assert.deepEqual(events, [{ type: "delta", text: "provider output" }, { type: "usage", inputTokens: 11, outputTokens: 7 }]);
});

test("OpenAI adapter parses message content and never includes provider error bodies", async () => {
  const messageProvider = new OpenAIResponsesProvider(profile, {
    apiKey: "credential-value",
    fetcher: async () => new Response(JSON.stringify({ output: [{ type: "message", content: [{ type: "output_text", text: "part one" }, { type: "output_text", text: " part two" }] }], usage: {} }), { status: 200 }),
  });
  assert.equal((await collect(messageProvider))[0]?.type, "delta");
  const failed = new OpenAIResponsesProvider(profile, {
    apiKey: "credential-value",
    fetcher: async () => new Response("provider-private-error-body", { status: 401 }),
  });
  await assert.rejects(() => collect(failed), (error: unknown) => error instanceof Error && error.message === "provider_http_401" && !error.message.includes("provider-private-error-body"));
});

test("OpenAI adapter rejects unsafe base URLs and non-read execution", async () => {
  assert.throws(() => new OpenAIResponsesProvider(profile, { apiKey: "credential-value", baseUrl: "http://api.example.com/v1" }), /HTTPS/);
  const provider = new OpenAIResponsesProvider(profile, { apiKey: "credential-value", fetcher: async () => new Response("{}") });
  await assert.rejects(async () => {
    for await (const _event of provider.run({ runId: "run", task: "task", phase: "implement", risk: "workspace_write" })) { /* no-op */ }
  }, /runtime_non_read_rejected/);
});

test("OpenAI adapter rejects capabilities it does not execute", () => {
  assert.throws(() => new OpenAIResponsesProvider({ ...profile, capabilities: { ...profile.capabilities, toolUse: true } }, { apiKey: "credential-value" }), /does not execute tools/);
  assert.throws(() => new OpenAIResponsesProvider({ ...profile, capabilities: { ...profile.capabilities, structuredOutput: true } }, { apiKey: "credential-value" }), /does not enforce structured output/);
  assert.throws(() => new OpenAIResponsesProvider({ ...profile, capabilities: { ...profile.capabilities, modalities: ["text", "image"] } }, { apiKey: "credential-value" }), /accepts text only/);
});
