import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { parsePublicRoutePayloadV2 } from "../src/validation.js";

const runner = path.join(process.cwd(), "examples", "router-workbench", "serve.mjs");

async function start(): Promise<{ child: ChildProcess; origin: string }> {
  const child = spawn(process.execPath, [runner, "--port", "0"], { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });
  let output = "", diagnostic = "";
  try {
    const origin = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Workbench did not start: ${diagnostic}`)), 15_000);
      child.once("error", (error) => { clearTimeout(timer); reject(error); });
      child.once("exit", () => { clearTimeout(timer); reject(new Error(`Workbench exited early: ${diagnostic}`)); });
      child.stderr!.on("data", (chunk: Buffer) => { diagnostic += chunk.toString(); });
      child.stdout!.on("data", (chunk: Buffer) => {
        output += chunk.toString();
        const url = output.match(/http:\/\/127\.0\.0\.1:\d+\//)?.[0];
        if (url) { clearTimeout(timer); resolve(url.slice(0, -1)); }
      });
    });
    return { child, origin };
  } catch (error) { child.kill(); throw error; }
}

async function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  await new Promise<void>((resolve) => {
    child.once("close", () => resolve());
    child.kill();
  });
}

test("workbench browser build includes only original UI, fixture and canonical pure router modules", () => {
  const result = spawnSync(process.execPath, [runner, "--check"], { cwd: process.cwd(), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(result.stdout) as { browserInputs: Record<string, string>; assets: Record<string, { bytes: number; sha256: string }> };
  assert.equal(Object.keys(manifest.browserInputs).length, 10);
  assert.deepEqual(Object.keys(manifest.browserInputs).filter((name) => name.startsWith("dist/")).sort(), [
    "contracts", "errors", "ordering", "router-entry", "router", "scoring", "validation",
  ].map((name) => `dist/src/${name}.js`).sort());
  assert.deepEqual(Object.keys(manifest.assets).sort(), ["/", "/favicon.svg", "/styles.css", "/workbench.js"]);
  assert.ok(manifest.assets["/workbench.js"]!.bytes < 250_000);
  for (const digest of Object.values(manifest.browserInputs)) assert.match(digest, /^[a-f0-9]{64}$/);
  for (const asset of Object.values(manifest.assets)) assert.match(asset.sha256, /^[a-f0-9]{64}$/);
});

test("workbench serves fixed loopback assets with no metadata API or arbitrary file access", async () => {
  const server = await start();
  try {
    for (const route of ["/", "/styles.css", "/workbench.js", "/favicon.svg"]) {
      const response = await fetch(server.origin + route, { signal: AbortSignal.timeout(5000) });
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-security-policy") ?? "", /connect-src 'none'/);
      assert.match(response.headers.get("content-security-policy") ?? "", /form-action 'none'/);
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.equal(response.headers.get("cache-control"), "no-store");
      const bytes = await response.arrayBuffer();
      assert.equal(Number(response.headers.get("content-length")), bytes.byteLength);
      if (route === "/") {
        const html = new TextDecoder().decode(bytes);
        assert.match(html, /Local source example/);
        assert.match(html, /id="export-metadata"[^>]*disabled/);
      }
    }
    const head = await fetch(server.origin + "/workbench.js", { method: "HEAD", signal: AbortSignal.timeout(5000) });
    assert.equal(head.status, 200);
    assert.equal((await head.arrayBuffer()).byteLength, 0);
    assert.ok(Number(head.headers.get("content-length")) > 0);
    for (const route of ["/package.json", "/api/route", "/styles.css?x=1", "/%2e%2e/package.json", "//styles.css"]) {
      const response = await fetch(server.origin + route, { signal: AbortSignal.timeout(5000) });
      assert.equal(response.status, 404, route);
      assert.equal(await response.text(), "");
    }
    const posted = await fetch(server.origin + "/", { method: "POST", body: "not routing metadata", signal: AbortSignal.timeout(5000) });
    assert.equal(posted.status, 405);
    assert.equal(posted.headers.get("allow"), "GET, HEAD");
    assert.equal(posted.headers.get("access-control-allow-origin"), null);
    assert.equal(await posted.text(), "");
  } finally { await stop(server.child); }
});

test("workbench inputs preserve exact USD, zero/unset and canonical numeric boundaries", async () => {
  const inputs = await import(pathToFileURL(path.join(process.cwd(), "examples", "router-workbench", "inputs.mjs")).href) as {
    parseCostCeiling: (value: string) => number | undefined;
    parseLatencyCeiling: (value: string) => number | undefined;
    formatUsd: (value: number) => string;
  };
  const fixture = JSON.parse(readFileSync("examples/route-request-v2.json", "utf8")) as { request: { constraints: { maxCostMicroUsd?: number; maxLatencyMs?: number } } };
  for (const [text, microUsd] of [["0", 0], [".000001", 1], ["0.050000", 50_000], ["1000.000000", 1_000_000_000]] as const) {
    const value = inputs.parseCostCeiling(text);
    assert.equal(value, microUsd);
    fixture.request.constraints.maxCostMicroUsd = value;
    assert.equal(parsePublicRoutePayloadV2(fixture).request.constraints.maxCostMicroUsd, microUsd);
  }
  for (const value of [0, 1, 600_000]) {
    const parsed = inputs.parseLatencyCeiling(String(value));
    assert.equal(parsed, value);
    fixture.request.constraints.maxLatencyMs = parsed;
    assert.equal(parsePublicRoutePayloadV2(fixture).request.constraints.maxLatencyMs, value);
  }
  assert.equal(inputs.parseCostCeiling(""), undefined);
  assert.equal(inputs.parseLatencyCeiling("  "), undefined);
  assert.equal(inputs.formatUsd(1), "0.000001");
  assert.equal(inputs.formatUsd(1_000_000_000), "1000.000000");
  assert.equal(inputs.formatUsd(Number.MAX_SAFE_INTEGER), "9007199254.740991");
  assert.equal(inputs.formatUsd(9_007_199_253_999_999), "9007199253.999999");
  for (const value of ["0.0000001", "1000.000001", "-1", "1e2", "NaN"]) assert.throws(() => inputs.parseCostCeiling(value));
  for (const value of ["600001", "-1", "1.5", "1e2", "Infinity"]) assert.throws(() => inputs.parseLatencyCeiling(value));
});

test("workbench runner cannot select a public interface or an invalid port", () => {
  for (const args of [["--host", "0.0.0.0"], ["--port", "65536"], ["--port", "-1"], ["--check", "--port", "0"]]) {
    const result = spawnSync(process.execPath, [runner, ...args], { cwd: process.cwd(), encoding: "utf8" });
    assert.equal(result.status, 64);
    assert.doesNotMatch(result.stdout, /http:/);
    assert.match(result.stderr, /binds only 127\.0\.0\.1/);
    assert.doesNotMatch(result.stderr, /Error:|file:\/\//);
  }
});
