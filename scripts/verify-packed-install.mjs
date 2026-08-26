import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
    assert.deepEqual(listed.result?.tools.map((tool) => tool.name).sort(), ["explain_contract", "route_models"]);

    const payload = readFileSync(path.join(root, "examples", "route-request.json"), "utf8");
    const called = await request("tools/call", { name: "route_models", arguments: { payload }, _meta: meta });
    assert.equal(called.error, undefined);
    assert.equal(called.result?.resultType, "complete");
    assert.equal(called.result?.structuredContent?.selectedModelId, "provider-b/fast");
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
  const canonicalBytes = readFileSync(path.join(root, "public", "downloads", "nymrel-agent-0.1.3.tgz"));
  const releaseManifest = JSON.parse(readFileSync(path.join(root, "public", "downloads", "v0.1.3.json"), "utf8"));
  const generatedSha256 = createHash("sha256").update(generatedBytes).digest("hex");
  assert.equal(generatedBytes.length, releaseManifest.package.bytes, "generated package byte count drifted from the canonical release manifest");
  assert.equal(generatedSha256, releaseManifest.package.sha256, "generated package digest drifted from the canonical release manifest");
  assert.deepEqual(generatedBytes, canonicalBytes, "generated package bytes drifted from the canonical hosted artifact");
  run(npm, ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], { cwd: installRoot });

  const contract = JSON.parse(run(bin("nymrel-agent"), ["contract"], { cwd: installRoot }));
  assert.equal(contract.contractVersion, "nymrel.agent.route/v1");
  await verifyMcp(bin("nymrel-agent-mcp"));
  process.stdout.write(`packed-install-verification: pass (${process.platform})\n`);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
