import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createConfiguredAdapters, parseLocalAgentConfig } from "../src/local-config.js";

function config(): Record<string, unknown> {
  const example = JSON.parse(readFileSync("examples/route-request.json", "utf8")) as Record<string, unknown>;
  const source = (example.models as Array<Record<string, unknown>>)[0] as Record<string, unknown>;
  const model = { ...source, modelId: "openai/example", providerId: "openai", riskClasses: ["read"], capabilities: { toolUse: false, structuredOutput: false, contextTokens: 128000, modalities: ["text"] } };
  return { route: { ...(example.request as Record<string, unknown>), risk: "read" }, models: [model], adapters: [{ kind: "openai-responses", modelId: "openai/example", providerModelId: "example", apiKeyEnv: "OPENAI_API_KEY" }] };
}

test("local config stores credential names, not values", () => {
  const parsed = parseLocalAgentConfig(config());
  assert.equal(parsed.adapters[0]?.apiKeyEnv, "OPENAI_API_KEY");
  assert.throws(() => createConfiguredAdapters(parsed, {}), /OPENAI_API_KEY/);
  assert.equal(createConfiguredAdapters(parsed, { OPENAI_API_KEY: "credential-value" }).length, 1);
});

test("local config rejects embedded keys, lowercase env names, and orphan adapters", () => {
  const embedded = config();
  (embedded.adapters as Array<Record<string, unknown>>)[0] = { ...(embedded.adapters as Array<Record<string, unknown>>)[0], apiKey: "embedded-value" };
  assert.throws(() => parseLocalAgentConfig(embedded), /unsupported fields/);
  const lowercase = config();
  (lowercase.adapters as Array<Record<string, unknown>>)[0] = { ...(lowercase.adapters as Array<Record<string, unknown>>)[0], apiKeyEnv: "openai_key" };
  assert.throws(() => parseLocalAgentConfig(lowercase), /uppercase environment-variable/);
  const orphan = config();
  (orphan.adapters as Array<Record<string, unknown>>)[0] = { ...(orphan.adapters as Array<Record<string, unknown>>)[0], modelId: "missing" };
  assert.throws(() => parseLocalAgentConfig(orphan), /no matching model profile/);
});
