import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PUBLIC_ROUTES, handleRequest, type WorkerEnv } from "../src/worker.js";

const endpoint = "https://agent.example/v1/route";
function example(): string { return readFileSync("examples/route-request.json", "utf8"); }
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
