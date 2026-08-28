import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NymrelError } from "../src/errors.js";
import { parsePublicRoutePayload, parsePublicRoutePayloadV2 } from "../src/validation.js";

function example(): Record<string, unknown> {
  return JSON.parse(readFileSync("examples/route-request.json", "utf8")) as Record<string, unknown>;
}

function exampleV2(): Record<string, unknown> {
  return JSON.parse(readFileSync("examples/route-request-v2.json", "utf8")) as Record<string, unknown>;
}

test("the documented example validates", () => {
  const parsed = parsePublicRoutePayload(example());
  assert.equal(parsed.models.length, 3);
  assert.equal(parsed.request.objective, "balanced");
});

test("the v2 example requires explicit safe request-budget normalization", () => {
  const parsed = parsePublicRoutePayloadV2(exampleV2());
  assert.equal(parsed.request.normalization.basis, "request_budget");
  assert.equal(parsed.request.normalization.costAnchorMicroUsd, 50_000);
  assert.equal(parsed.request.normalization.latencyAnchorMs, 10_000);
  const invalid = exampleV2();
  const request = invalid.request as Record<string, unknown>;
  request.normalization = { basis: "request_budget", costAnchorMicroUsd: 0, latencyAnchorMs: 10_000 };
  assert.throws(() => parsePublicRoutePayloadV2(invalid), /invalid/i);
});

test("unknown fields fail closed without echoing their values", () => {
  const payload = { ...example(), prompt: "private-body-value" };
  assert.throws(
    () => parsePublicRoutePayload(payload),
    (error: unknown) => error instanceof NymrelError && error.code === "invalid_request" && !JSON.stringify(error).includes("prompt") && !JSON.stringify(error).includes("private-body-value"),
  );
});

test("identifiers reject control characters and whitespace", () => {
  const payload = example();
  const models = payload.models as Array<Record<string, unknown>>;
  models[0] = { ...models[0], modelId: " model\nwith-control" };
  assert.throws(() => parsePublicRoutePayload(payload), /invalid/i);
});

test("duplicate enum entries and out-of-range metrics fail", () => {
  const duplicate = example();
  const models = duplicate.models as Array<Record<string, unknown>>;
  models[0] = { ...models[0], riskClasses: ["read", "read"] };
  assert.throws(() => parsePublicRoutePayload(duplicate), /invalid/i);
  const outOfRange = example();
  const rows = outOfRange.models as Array<Record<string, unknown>>;
  rows[0] = { ...rows[0], qualityScore: 101 };
  assert.throws(() => parsePublicRoutePayload(outOfRange), /invalid/i);
});

test("catalog size is bounded", () => {
  const payload = example();
  const first = (payload.models as unknown[])[0];
  payload.models = Array.from({ length: 101 }, () => first);
  assert.throws(() => parsePublicRoutePayload(payload), /invalid/i);
});
