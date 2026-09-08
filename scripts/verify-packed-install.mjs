import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const candidateMode = process.argv.slice(2).includes("--candidate");
assert.deepEqual(process.argv.slice(2).filter((value) => value !== "--candidate"), [], "unsupported packed-install verifier option");
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
  assert.equal(result.status, 0, `${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
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
  if (!candidateMode) {
    const canonicalBytes = readFileSync(path.join(root, "public", "downloads", "nymrel-agent-0.4.0.tgz"));
    const releaseManifest = JSON.parse(readFileSync(path.join(root, "public", "downloads", "v0.4.0.json"), "utf8"));
    const generatedSha256 = createHash("sha256").update(generatedBytes).digest("hex");
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
