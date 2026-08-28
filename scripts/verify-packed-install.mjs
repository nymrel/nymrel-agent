import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const candidateMode = process.argv.slice(2).includes("--candidate");
assert.deepEqual(process.argv.slice(2).filter((value) => value !== "--candidate"), [], "unsupported packed-install verifier option");
const temporaryRoot = mkdtempSync(path.join(tmpdir(), "nymrel-agent-packed-"));
const installRoot = path.join(temporaryRoot, "install");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const bin = (name) => path.join(installRoot, "node_modules", ".bin", process.platform === "win32" ? `${name}.cmd` : name);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    env: process.env,
    shell: process.platform === "win32" && command.endsWith(".cmd"),
  });
  assert.equal(result.status, 0, `${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  return result.stdout;
}

async function verifyMcp(executable) {
  const child = spawn(executable, [], {
    cwd: installRoot,
    env: process.env,
    shell: process.platform === "win32",
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
    assert.deepEqual(listed.result?.tools.map((tool) => tool.name).sort(), ["explain_contract", "explain_contract_v2", "route_models", "route_models_v2"]);

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
  const packed = JSON.parse(run(npm, ["pack", "--ignore-scripts", "--json", "--pack-destination", temporaryRoot]));
  assert.equal(packed.length, 1);
  const tarball = path.join(temporaryRoot, packed[0].filename);
  const generatedBytes = readFileSync(tarball);
  if (!candidateMode) {
    const canonicalBytes = readFileSync(path.join(root, "public", "downloads", "nymrel-agent-0.3.1.tgz"));
    const releaseManifest = JSON.parse(readFileSync(path.join(root, "public", "downloads", "v0.3.1.json"), "utf8"));
    const generatedSha256 = createHash("sha256").update(generatedBytes).digest("hex");
    assert.equal(generatedBytes.length, releaseManifest.package.bytes, "generated package byte count drifted from the canonical release manifest");
    assert.equal(generatedSha256, releaseManifest.package.sha256, "generated package digest drifted from the canonical release manifest");
    assert.deepEqual(generatedBytes, canonicalBytes, "generated package bytes drifted from the canonical hosted artifact");
  }
  run(npm, ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], { cwd: installRoot });

  const installedPackageRoot = path.join(installRoot, "node_modules", "@nymrel", "agent");
  const installedReadme = readFileSync(path.join(installedPackageRoot, "README.md"), "utf8");
  assert.match(installedReadme, /\(docs\/JOB_MODE\.md\)/, "packed README must link to the packaged Job Mode guide");
  assert.match(readFileSync(path.join(installedPackageRoot, "docs", "JOB_MODE.md"), "utf8"), /Job Mode \(local plan only\)/);

  const contract = JSON.parse(run(bin("nymrel-agent"), ["contract"], { cwd: installRoot }));
  assert.equal(contract.contractVersion, "nymrel.agent.route/v1");
  const jobPlan = JSON.parse(run(bin("nymrel-agent"), [
    "job", "plan", "--file", path.join(installedPackageRoot, "examples", "job-48h-game-builder.json"),
  ], { cwd: installRoot }));
  assert.equal(jobPlan.ok, true);
  assert.equal(jobPlan.plan?.status, "ready_with_handoffs");
  assert.equal(jobPlan.plan?.executionStatus, "not_started");
  assert.equal(jobPlan.plan?.summary?.totalSteps, 5);
  assert.equal(jobPlan.plan?.summary?.externalHandoffRequiredSteps, 2);
  assert.equal(jobPlan.receipt?.status, "planned");
  assert.equal(jobPlan.receipt?.counts?.totalSteps, 5);
  await verifyMcp(bin("nymrel-agent-mcp"));
  process.stdout.write(`${candidateMode ? "candidate-" : ""}packed-install-verification: pass (${process.platform})\n`);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
