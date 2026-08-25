import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import app from "../server.js";

function example(): string {
  return readFileSync("examples/route-request.json", "utf8");
}

test("Vercel adapter reports its production limiter scope and serves API discovery", async () => {
  const homepage = await app.request("https://agent.example/");
  assert.equal(homepage.status, 200);
  assert.match(await homepage.text(), /<title>Nymrel Agent/);
  assert.equal(homepage.headers.get("cache-control"), "public, max-age=300");

  const ready = await app.request("https://agent.example/readyz");
  assert.equal(ready.status, 200);
  const readyPayload = await ready.json() as { ok?: boolean; checks?: Record<string, string> };
  assert.equal(readyPayload.ok, true);
  assert.equal(readyPayload.checks?.rateLimit, "ready");
  assert.equal(readyPayload.checks?.rateLimitScope, "function_instance");
  assert.equal(readyPayload.checks?.platformAbuseProtection, "vercel");

  const discovery = await app.request("https://agent.example/v1");
  assert.equal(discovery.status, 200);
  assert.equal((await discovery.json() as { contractVersion?: string }).contractVersion, "nymrel.agent.route/v1");

  const openapi = await app.request("https://agent.example/v1/openapi.json");
  assert.equal(openapi.status, 200);
  assert.equal((await openapi.json() as { openapi?: string }).openapi, "3.1.0");
});

test("Vercel adapter enforces its bounded per-instance routing window", async () => {
  const request = () => app.request("https://agent.example/v1/route", {
    method: "POST",
    headers: { "content-type": "application/json", "x-vercel-forwarded-for": "198.51.100.42" },
    body: example(),
  });
  for (let index = 0; index < 120; index += 1) assert.equal((await request()).status, 200);
  const limited = await request();
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "60");
});
