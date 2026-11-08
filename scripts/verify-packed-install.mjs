import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyRouterWorkerConsumer } from "./verify-router-browser.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const candidateMode = process.argv.slice(2).includes("--candidate");
const browserMode = process.argv.slice(2).includes("--browser");
assert.deepEqual(process.argv.slice(2).filter((value) => !["--candidate", "--browser"].includes(value)), [], "unsupported packed-install verifier option");
assert.ok(!browserMode || candidateMode, "native browser verification requires an explicit source candidate");
const temporaryRoot = mkdtempSync(path.join(tmpdir(), "nymrel-agent-packed-"));
const installRoot = path.join(temporaryRoot, "install");
const installedPackageRoot = path.join(installRoot, "node_modules", "@nymrel", "agent");
const npmExecPath = process.env.npm_execpath;
assert.ok(npmExecPath && existsSync(npmExecPath), "packed-install verification must be invoked through npm");
const binShim = (name) => path.join(installRoot, "node_modules", ".bin", process.platform === "win32" ? `${name}.cmd` : name);
const binEntrypoint = (name) => path.join(installedPackageRoot, "dist", "src", "bin", `${name}.js`);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    env: process.env,
  });
  assert.equal(result.status, options.expectedStatus ?? 0, `${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  return result.stdout;
}

function runNpm(args, options = {}) {
  return run(process.execPath, [npmExecPath, ...args], options);
}

async function verifyMcp(entrypoint) {
  const child = spawn(process.execPath, [entrypoint], {
    cwd: installRoot,
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let buffer = "";
  let nextId = 1;
  const pending = new Map();
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    while (buffer.includes("\n")) {
      const newline = buffer.indexOf("\n");
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const response = JSON.parse(line);
      const waiter = pending.get(response.id);
      if (!waiter) continue;
      clearTimeout(waiter.timer);
      pending.delete(response.id);
      waiter.resolve(response);
    }
  });
  const request = (method, params) => {
    const id = nextId++;
    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`packed MCP bin did not answer ${method}`));
      }, 10_000);
      pending.set(id, { resolve, reject, timer });
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return promise;
  };
  const meta = {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientCapabilities": {},
    "io.modelcontextprotocol/clientInfo": { name: "packed-smoke", version: "1.0.0" },
  };
  try {
    const discovered = await request("server/discover", { _meta: meta });
    assert.equal(discovered.error, undefined);
    assert.equal(discovered.result?.resultType, "complete");
    assert.deepEqual(discovered.result?.supportedVersions, ["2026-07-28"]);

    const listed = await request("tools/list", { _meta: meta });
    assert.equal(listed.error, undefined);
    assert.equal(listed.result?.resultType, "complete");
    assert.deepEqual(listed.result?.tools.map((tool) => tool.name).sort(), ["explain_contract", "explain_contract_v2", "plan_job", "route_models", "route_models_v2"]);

    const payload = readFileSync(path.join(root, "examples", "route-request.json"), "utf8");
    const called = await request("tools/call", { name: "route_models", arguments: { payload }, _meta: meta });
    assert.equal(called.error, undefined);
    assert.equal(called.result?.resultType, "complete");
    assert.equal(called.result?.structuredContent?.selectedModelId, "provider-b/fast");

    const payloadV2 = readFileSync(path.join(root, "examples", "route-request-v2.json"), "utf8");
    const calledV2 = await request("tools/call", { name: "route_models_v2", arguments: { payload: payloadV2 }, _meta: meta });
    assert.equal(calledV2.error, undefined);
    assert.equal(calledV2.result?.resultType, "complete");
    assert.equal(calledV2.result?.structuredContent?.contractVersion, "nymrel.agent.route/v2");
    const jobPayload = readFileSync(path.join(root, "examples", "job-48h-game-builder.json"), "utf8");
    const job = await request("tools/call", { name: "plan_job", arguments: { payload: jobPayload }, _meta: meta });
    assert.equal(job.error, undefined);
    assert.equal(job.result?.structuredContent?.profile, "plan-only");
  } finally {
    child.stdin.end();
    if (child.exitCode === null) {
      await Promise.race([
        new Promise((resolve) => child.once("exit", resolve)),
        new Promise((resolve) => setTimeout(resolve, 2_000)),
      ]);
    }
    if (child.exitCode === null) {
      child.kill();
      await Promise.race([
        new Promise((resolve) => child.once("exit", resolve)),
        new Promise((resolve) => setTimeout(resolve, 2_000)),
      ]);
    }
  }
}

try {
  mkdirSync(installRoot);
  writeFileSync(path.join(installRoot, "package.json"), "{\"private\":true}\n", "utf8");
  const packed = JSON.parse(runNpm(["pack", "--ignore-scripts", "--json", "--pack-destination", temporaryRoot]));
  assert.equal(packed.length, 1);
  const tarball = path.join(temporaryRoot, packed[0].filename);
  const generatedBytes = readFileSync(tarball);
  const generatedSha256 = createHash("sha256").update(generatedBytes).digest("hex");
  if (!candidateMode) {
    const canonicalBytes = readFileSync(path.join(root, "public", "downloads", "nymrel-agent-0.4.1.tgz"));
    const releaseManifest = JSON.parse(readFileSync(path.join(root, "public", "downloads", "v0.4.1.json"), "utf8"));
    assert.equal(generatedBytes.length, releaseManifest.package.bytes, "generated package byte count drifted from the canonical release manifest");
    assert.equal(generatedSha256, releaseManifest.package.sha256, "generated package digest drifted from the canonical release manifest");
    assert.deepEqual(generatedBytes, canonicalBytes, "generated package bytes drifted from the canonical hosted artifact");
  }
  runNpm(["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], { cwd: installRoot });

  for (const name of ["nymrel-agent", "nymrel-agent-mcp"]) {
    assert.ok(existsSync(binShim(name)), `npm did not install the ${name} executable shim`);
    assert.ok(existsSync(binEntrypoint(name)), `package does not contain the ${name} JavaScript entrypoint`);
  }
  const installedReadme = readFileSync(path.join(installedPackageRoot, "README.md"), "utf8");
  assert.match(installedReadme, /\(docs\/JOB_MODE\.md\)/, "packed README must link to the packaged Job Mode guide");
  assert.match(readFileSync(path.join(installedPackageRoot, "docs", "JOB_MODE.md"), "utf8"), /Job Mode \(local plan only\)/);

  if (candidateMode) {
    assert.match(installedReadme, /\(docs\/ROUTER_LIBRARY\.md\)/, "library consumer guide must be packaged");
    assert.match(readFileSync(path.join(installedPackageRoot, "docs", "ROUTER_LIBRARY.md"), "utf8"), /unreleased source addition/);
    const nodeConsumer = path.join(installRoot, "router-node-consumer.mjs");
    writeFileSync(nodeConsumer, readFileSync(path.join(installedPackageRoot, "examples", "router-node-consumer.mjs")));
    const fixturePath = path.join(installedPackageRoot, "examples", "route-request-v2.json");
    const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
    const selected = JSON.parse(run(process.execPath, [nodeConsumer, fixturePath], { cwd: installRoot }));
    assert.equal(selected.status, "selected");
    assert.equal(selected.plan.contractVersion, "nymrel.agent.route/v2");
    assert.equal(selected.plan.selectedModelId, "provider-b/fast");
    const reversedPath = path.join(installRoot, "reversed.json");
    writeFileSync(reversedPath, JSON.stringify({ ...fixture, models: [...fixture.models].reverse() }));
    assert.deepEqual(JSON.parse(run(process.execPath, [nodeConsumer, reversedPath], { cwd: installRoot })), selected);
    const blockedPath = path.join(installRoot, "blocked.json");
    writeFileSync(blockedPath, JSON.stringify({ ...fixture, models: fixture.models.map((model) => ({ ...model, health: "unavailable" })) }));
    const blocked = JSON.parse(run(process.execPath, [nodeConsumer, blockedPath], { cwd: installRoot, expectedStatus: 2 }));
    assert.equal(blocked.status, "blocked");
    assert.equal(blocked.plan.selectedModelId, null);
    assert.equal(blocked.plan.eligible.length, 0);

    // A downstream worker can consume the public declarations without ambient Node types.
    writeFileSync(path.join(installRoot, "package.json"), JSON.stringify({ private: true, type: "module" }));
    writeFileSync(path.join(installRoot, "router-worker.ts"), `
      import { routeV2, CONTRACT_VERSION_V2, type ModelProfile, type RouteRequestV2,
        type RoutePlanV2 } from '@nymrel/agent/router';
      const metadata = ${JSON.stringify(fixture)} as const satisfies {
        request: RouteRequestV2; models: readonly ModelProfile[];
      };
      const plan: RoutePlanV2 = routeV2(metadata.request, metadata.models);
      const contract: typeof CONTRACT_VERSION_V2 = plan.contractVersion;
      self.onmessage = (event: MessageEvent<{request: RouteRequestV2; models: ModelProfile[]}>) => {
        self.postMessage(routeV2(event.data.request, event.data.models));
      };
      // @ts-expect-error This worker deliberately has no Node ambient globals.
      type NoNodeProcess = typeof process;
      void contract;
    `);
    writeFileSync(path.join(installRoot, "tsconfig.json"), JSON.stringify({
      compilerOptions: { target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext",
        strict: true, noEmit: true, types: [], lib: ["ES2022", "WebWorker"] },
      files: ["router-worker.ts"],
    }));
    run(process.execPath, [path.join(root, "node_modules", "typescript", "bin", "tsc"), "--project", path.join(installRoot, "tsconfig.json")], { cwd: installRoot });
    const workerProof = await verifyRouterWorkerConsumer(installRoot, { browser: browserMode });
    process.stdout.write(JSON.stringify({ kind: "synthetic-installed-router-consumers", sourceRevision: run("git", ["rev-parse", "HEAD"]).trim(),
      sourceDirty: run("git", ["status", "--porcelain"]).trim() !== "",
      tarballSha256: generatedSha256, tarballBytes: generatedBytes.length,
      nodeConsumerChecks: 3, workerTypes: "PASS; WebWorker lib with no Node ambient types", worker: workerProof,
      providerCalls: 0, externalAdoption: "not measured" }) + "\n");
  }

  const contract = JSON.parse(run(process.execPath, [binEntrypoint("nymrel-agent"), "contract"], { cwd: installRoot }));
  assert.equal(contract.contractVersion, "nymrel.agent.route/v1");
  const jobPlan = JSON.parse(run(process.execPath, [binEntrypoint("nymrel-agent"),
    "job", "plan", "--file", path.join(installedPackageRoot, "examples", "job-48h-game-builder.json"),
  ], { cwd: installRoot }));
  assert.equal(jobPlan.ok, true);
  assert.equal(jobPlan.plan?.status, "ready_with_handoffs");
  assert.equal(jobPlan.plan?.executionStatus, "not_started");
  assert.equal(jobPlan.plan?.summary?.totalSteps, 5);
  assert.equal(jobPlan.plan?.summary?.externalHandoffRequiredSteps, 2);
  assert.equal(jobPlan.receipt?.status, "planned");
  assert.equal(jobPlan.receipt?.counts?.totalSteps, 5);
  const summary = run(process.execPath, [binEntrypoint("nymrel-agent"), "job", "plan", "--file", path.join(installedPackageRoot, "examples", "job-48h-game-builder.json"), "--format", "summary"], { cwd: installRoot });
  assert.ok(summary.split(/\r?\n/).filter(Boolean).length <= 40);
  await verifyMcp(binEntrypoint("nymrel-agent-mcp"));
  process.stdout.write(`${candidateMode ? "candidate-" : ""}packed-install-verification: pass (${process.platform})\n`);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
