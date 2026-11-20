import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { once } from "node:events";
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
      return new Response(JSON.stringify({ status: "completed", output_text: "provider output", usage: { input_tokens: 11, output_tokens: 7 } }), { status: 200, headers: { "content-type": "application/json" } });
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
    fetcher: async () => new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "part one" }, { type: "output_text", text: " part two" }] }], usage: {} }), { status: 200 }),
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

test("OpenAI adapter binds local_only custody to loopback transport", () => {
  const localProfile = { ...profile, dataBoundaries: ["local_only"] as const };
  assert.throws(
    () => new OpenAIResponsesProvider(localProfile, { apiKey: "credential-value" }),
    /local_only profiles require a loopback base URL/,
  );
  assert.throws(
    () => new OpenAIResponsesProvider(localProfile, { apiKey: "credential-value", baseUrl: "https://remote.example/v1" }),
    /local_only profiles require a loopback base URL/,
  );
  assert.throws(
    () => new OpenAIResponsesProvider(localProfile, { apiKey: "credential-value", baseUrl: "http://127.attacker.example/v1" }),
    /must use HTTPS/,
  );
  assert.doesNotThrow(
    () => new OpenAIResponsesProvider(localProfile, { apiKey: "credential-value", baseUrl: "http://127.0.0.2:8080/v1" }),
  );
});

test("OpenAI adapter rejects incomplete 200 responses instead of returning partial output", async () => {
  const provider = new OpenAIResponsesProvider(profile, {
    apiKey: "credential-value",
    fetcher: async () => new Response(JSON.stringify({ status: "incomplete", output_text: "partial" }), { status: 200 }),
  });
  await assert.rejects(() => collect(provider), /provider_response_incomplete/);
});

test("OpenAI adapter cancels oversized chunked response bodies before full buffering", async () => {
  let produced = 0;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      produced += 1;
      controller.enqueue(new Uint8Array(1024 * 1024));
      if (produced === 12) controller.close();
    },
    cancel() { cancelled = true; },
  });
  const provider = new OpenAIResponsesProvider(profile, {
    apiKey: "credential-value",
    fetcher: async () => new Response(body, { status: 200 }),
  });
  await assert.rejects(() => collect(provider), /provider_response_too_large/);
  assert.equal(cancelled, true);
  assert.ok(produced < 12);
});

test("OpenAI adapter rejects capabilities it does not execute", () => {
  assert.throws(() => new OpenAIResponsesProvider({ ...profile, capabilities: { ...profile.capabilities, toolUse: true } }, { apiKey: "credential-value" }), /does not execute tools/);
  assert.throws(() => new OpenAIResponsesProvider({ ...profile, capabilities: { ...profile.capabilities, structuredOutput: true } }, { apiKey: "credential-value" }), /does not enforce structured output/);
  assert.throws(() => new OpenAIResponsesProvider({ ...profile, capabilities: { ...profile.capabilities, modalities: ["text", "image"] } }, { apiKey: "credential-value" }), /accepts text only/);
});

test("OpenAI adapter does not forward task bodies through 307 or 308 redirects", async () => {
  let forwarded = 0;
  const destination = createServer((_request, response) => {
    forwarded++;
    response.end(JSON.stringify({ status: "completed", output_text: "redirected" }));
  });
  destination.listen(0, "127.0.0.1");
  await once(destination, "listening");
  const address = destination.address();
  assert.ok(address && typeof address === "object");
  try {
    for (const statusCode of [307, 308]) {
      const origin = createServer((_request, response) => {
        response.writeHead(statusCode, { Location: `http://127.0.0.1:${address.port}/responses` });
        response.end();
      });
      origin.listen(0, "127.0.0.1");
      await once(origin, "listening");
      const originAddress = origin.address();
      assert.ok(originAddress && typeof originAddress === "object");
      try {
        const provider = new OpenAIResponsesProvider({
          ...profile, dataBoundaries: ["local_only"],
        }, {
          apiKey: "synthetic-test-key",
          baseUrl: `http://127.0.0.1:${originAddress.port}/v1`,
        });
        await assert.rejects(() => collect(provider));
        assert.equal(forwarded, 0);
      } finally {
        origin.closeAllConnections();
        await new Promise<void>((resolve, reject) => origin.close((error) => error ? reject(error) : resolve()));
      }
    }
  } finally {
    destination.closeAllConnections();
    await new Promise<void>((resolve, reject) => destination.close((error) => error ? reject(error) : resolve()));
  }
});
