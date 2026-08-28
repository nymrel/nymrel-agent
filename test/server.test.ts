import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createApp, VERCEL_RATE_LIMIT_ID, type VercelRateLimitChecker } from "../server.js";

const SOURCE_COMMIT = "a".repeat(40);

function example(): string {
  return readFileSync("examples/route-request.json", "utf8");
}

function exampleV2(): string {
  return readFileSync("examples/route-request-v2.json", "utf8");
}

const allowed: VercelRateLimitChecker = async () => ({ rateLimited: false });

test("Vercel adapter verifies its deployment-wide WAF rule and serves API discovery", async () => {
  let observedRateLimitId: string | undefined;
  const checker: VercelRateLimitChecker = async (rateLimitId) => {
    observedRateLimitId = rateLimitId;
    return { rateLimited: false };
  };
  const app = createApp({ rateLimitChecker: checker, sourceCommit: SOURCE_COMMIT });
  const homepage = await app.request("https://agent.example/");
  assert.equal(homepage.status, 200);
  assert.match(await homepage.text(), /<title>Nymrel Agent/);
  assert.equal(homepage.headers.get("cache-control"), "public, max-age=300");

  const ready = await app.request("https://agent.example/readyz");
  assert.equal(ready.status, 200);
  const readyPayload = await ready.json() as { ok?: boolean; checks?: Record<string, string> };
  assert.equal(readyPayload.ok, true);
  assert.equal(readyPayload.checks?.rateLimit, "platform_ready");
  assert.equal(readyPayload.checks?.rateLimitScope, "deployment");
  assert.equal(readyPayload.checks?.platformAbuseProtection, "vercel_waf_rate_limit");
  assert.equal(readyPayload.checks?.sourceCommit, SOURCE_COMMIT);
  assert.equal(observedRateLimitId, VERCEL_RATE_LIMIT_ID);

  const discovery = await app.request("https://agent.example/v1");
  assert.equal(discovery.status, 200);
  assert.equal((await discovery.json() as { contractVersion?: string }).contractVersion, "nymrel.agent.route/v1");

  const openapi = await app.request("https://agent.example/v1/openapi.json");
  assert.equal(openapi.status, 200);
  assert.equal((await openapi.json() as { openapi?: string }).openapi, "3.1.0");

  const v2Discovery = await app.request("https://agent.example/v2");
  assert.equal(v2Discovery.status, 200);
  assert.equal((await v2Discovery.json() as { contractVersion?: string }).contractVersion, "nymrel.agent.route/v2");
  const v2Route = await app.request("https://agent.example/v2/route", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: exampleV2(),
  });
  assert.equal(v2Route.status, 200);
  assert.equal((await v2Route.json() as { plan?: { contractVersion?: string } }).plan?.contractVersion, "nymrel.agent.route/v2");
});

test("Vercel adapter shares one external limiter across independent app instances", async () => {
  const counts = new Map<string, number>();
  const observedOptionKeys: string[][] = [];
  const checker: VercelRateLimitChecker = async (_rateLimitId, options) => {
    observedOptionKeys.push(Object.keys(options).sort());
    const platformIp = options.request.headers.get("x-vercel-forwarded-for") ?? "unknown";
    const count = (counts.get(platformIp) ?? 0) + 1;
    counts.set(platformIp, count);
    return { rateLimited: count > 120 };
  };
  const first = createApp({ rateLimitChecker: checker, sourceCommit: SOURCE_COMMIT });
  const second = createApp({ rateLimitChecker: checker, sourceCommit: SOURCE_COMMIT });
  const request = (app: ReturnType<typeof createApp>, spoofedCloudflareIp: string) => app.request("https://agent.example/v1/route", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-vercel-forwarded-for": "198.51.100.42",
      "cf-connecting-ip": spoofedCloudflareIp,
    },
    body: example(),
  });
  for (let index = 0; index < 120; index += 1) {
    assert.equal((await request(index % 2 === 0 ? first : second, `192.0.2.${index % 255}`)).status, 200);
  }
  const limited = await request(first, "203.0.113.250");
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "60");
  assert.ok(observedOptionKeys.every((keys) => keys.length === 1 && keys[0] === "request"));
});

test("Vercel adapter fails readiness and routing closed when the WAF rule is missing", async () => {
  const missing: VercelRateLimitChecker = async () => ({ rateLimited: false, error: "not-found" });
  const app = createApp({ rateLimitChecker: missing, sourceCommit: SOURCE_COMMIT });
  assert.equal((await app.request("https://agent.example/readyz")).status, 503);
  const routed = await app.request("https://agent.example/v1/route", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: example(),
  });
  assert.equal(routed.status, 503);
  assert.match(await routed.text(), /service_misconfigured/);
});

test("offline fallback keeps the product surface up and routing disabled", async () => {
  const app = createApp({ rateLimitChecker: allowed, routingApiEnabled: false, sourceCommit: SOURCE_COMMIT });
  assert.equal((await app.request("https://agent.example/")).status, 200);
  assert.equal((await app.request("https://agent.example/readyz")).status, 503);
  const routed = await app.request("https://agent.example/v1/route", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: example(),
  });
  assert.equal(routed.status, 503);
  assert.match(await routed.text(), /service_disabled/);
});
