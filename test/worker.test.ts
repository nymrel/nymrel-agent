import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PUBLIC_ROUTES, handleRequest, type WorkerEnv } from "../src/worker.js";

const endpoint = "https://agent.example/v1/route";
const endpointV2 = "https://agent.example/v2/route";
function example(): string { return readFileSync("examples/route-request.json", "utf8"); }
function exampleV2(): string { return readFileSync("examples/route-request-v2.json", "utf8"); }
async function jsonBody(response: Response): Promise<Record<string, unknown>> { return await response.json() as Record<string, unknown>; }

test("health and readiness expose only bounded operational facts", async () => {
  const health = await handleRequest(new Request("https://agent.example/healthz"));
  const ready = await handleRequest(new Request("https://agent.example/readyz"));
  assert.equal(health.status, 200);
  assert.equal(ready.status, 200);
  assert.equal((await jsonBody(health)).status, "healthy");
  assert.equal((await jsonBody(ready)).status, "ready");
  assert.equal(health.headers.get("cache-control"), "no-store");
  assert.equal(health.headers.get("x-content-type-options"), "nosniff");
});

test("public route returns an explainable decision with request correlation", async () => {
  const response = await handleRequest(new Request(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: example() }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("nymrel-request-id") ?? "", /^[0-9a-f-]{36}$/);
  const payload = await jsonBody(response) as { ok?: boolean; plan?: { selectedModelId?: string } };
  assert.equal(payload.ok, true);
  assert.equal(payload.plan?.selectedModelId, "provider-b/fast");
});

test("v2 has separate discovery, route, preflight, and validation surfaces", async () => {
  const discovery = await handleRequest(new Request("https://agent.example/v2"));
  assert.equal(discovery.status, 200);
  const discovered = await jsonBody(discovery) as { contractVersion?: string; route?: string; openapi?: string };
  assert.deepEqual(discovered, { ok: true, name: "Nymrel Agent", version: "0.2.0", contractVersion: "nymrel.agent.route/v2", route: "/v2/route", openapi: "/v2/openapi.json" });
  assert.equal((await handleRequest(new Request(endpointV2, { method: "OPTIONS" }))).status, 204);

  const response = await handleRequest(new Request(endpointV2, { method: "POST", headers: { "content-type": "application/json" }, body: exampleV2() }));
  assert.equal(response.status, 200);
  const payload = await jsonBody(response) as { plan?: { contractVersion?: string; paretoFrontierModelIds?: string[]; decisionCodes?: string[] } };
  assert.equal(payload.plan?.contractVersion, "nymrel.agent.route/v2");
  assert.deepEqual(payload.plan?.paretoFrontierModelIds, ["provider-a/reasoning-large", "provider-b/fast"]);
  assert.ok(payload.plan?.decisionCodes?.includes("normalization_request_budget"));
  assert.ok(payload.plan?.decisionCodes?.includes("pareto_frontier_computed"));

  assert.equal((await handleRequest(new Request(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: exampleV2() }))).status, 400);
  assert.equal((await handleRequest(new Request(endpointV2, { method: "POST", headers: { "content-type": "application/json" }, body: example() }))).status, 400);
});

test("v2 shares body, media, method, and rate guards with v1", async () => {
  assert.equal((await handleRequest(new Request(endpointV2, { method: "POST", body: exampleV2() }))).status, 415);
  assert.equal((await handleRequest(new Request(endpointV2, { method: "POST", headers: { "content-type": "application/json" }, body: "x".repeat(256 * 1024 + 1) }))).status, 413);
  const method = await handleRequest(new Request(endpointV2, { method: "GET" }));
  assert.equal(method.status, 405);
  assert.equal(method.headers.get("allow"), "POST, OPTIONS");
  const env: WorkerEnv = { ROUTE_RATE_LIMITER: { async limit() { return { success: false }; } } };
  const limited = await handleRequest(new Request(endpointV2, { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": "192.0.2.2" }, body: exampleV2() }), env);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "60");
});

test("route rejects prompt fields and never echoes their value", async () => {
  const input = JSON.parse(example()) as Record<string, unknown>;
  input.prompt = "private-prompt-value";
  const response = await handleRequest(new Request(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }));
  const body = await response.text();
  assert.equal(response.status, 400);
  assert.match(body, /invalid_request/);
  assert.doesNotMatch(body, /prompt/);
  assert.doesNotMatch(body, /private-prompt-value/);
});

test("route enforces media type, payload size, method, and rate limits", async () => {
  assert.equal((await handleRequest(new Request(endpoint, { method: "POST", body: example() }))).status, 415);
  assert.equal((await handleRequest(new Request(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: "x".repeat(256 * 1024 + 1) }))).status, 413);
  const method = await handleRequest(new Request(endpoint, { method: "GET" }));
  assert.equal(method.status, 405);
  assert.equal(method.headers.get("allow"), "POST, OPTIONS");
  const env: WorkerEnv = { ROUTE_RATE_LIMITER: { async limit() { return { success: false }; } } };
  const limited = await handleRequest(new Request(endpoint, { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": "192.0.2.1" }, body: example() }), env);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "60");
});

test("chunked oversized bodies are cancelled before the stream is fully consumed", async () => {
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
  const request = new Request(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  const response = await handleRequest(request);
  assert.equal(response.status, 413);
  assert.equal(cancelled, true);
  assert.ok(produced < 20, `oversized stream was fully consumed (${produced} chunks)`);
});

test("malformed Content-Length and incomplete production bindings fail closed", async () => {
  const malformed = await handleRequest(new Request(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", "content-length": "not-a-number" },
    body: example(),
  }));
  assert.equal(malformed.status, 400);
  assert.match(await malformed.text(), /invalid_content_length/);

  const missingSource: WorkerEnv = {
    APP_ENV: "production",
    ROUTE_RATE_LIMITER: { async limit() { return { success: true }; } },
  };
  assert.equal((await handleRequest(new Request("https://agent.example/readyz"), missingSource)).status, 503);

  const invalidScope: WorkerEnv = {
    APP_ENV: "production",
    SOURCE_COMMIT: "a".repeat(40),
    RATE_LIMIT_SCOPE: "function_instance",
    PLATFORM_RATE_LIMITER: {
      async limit() { return { status: "allowed" }; },
      async probe() { return { status: "ready" }; },
    },
  };
  assert.equal((await handleRequest(new Request("https://agent.example/readyz"), invalidScope)).status, 503);
});

test("static assets receive browser security headers", async () => {
  const env: WorkerEnv = { ASSETS: { async fetch() { return new Response("<h1>asset</h1>", { headers: { "content-type": "text/html" } }); } } };
  const response = await handleRequest(new Request("https://agent.example/"), env);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
});

test("every declared public route has a reviewable reason and unique method/path", () => {
  const identities = PUBLIC_ROUTES.map((entry) => `${entry.method} ${entry.path}`);
  assert.equal(new Set(identities).size, identities.length);
  assert.ok(PUBLIC_ROUTES.every((entry) => entry.reason.length >= 20));
});
