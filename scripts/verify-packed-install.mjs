import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
  try {
    const response = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("packed MCP bin did not answer initialize")), 10_000);
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        buffer += chunk;
        const newline = buffer.indexOf("\n");
        if (newline < 0) return;
        clearTimeout(timer);
        try { resolve(JSON.parse(buffer.slice(0, newline))); }
        catch (error) { reject(error); }
      });
      child.once("error", reject);
      child.once("exit", (code) => {
        if (code !== null && buffer.length === 0) reject(new Error(`packed MCP bin exited before handshake (${code})`));
      });
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2026-07-28", capabilities: {}, clientInfo: { name: "packed-smoke", version: "1.0.0" } } })}\n`);
    });
    assert.equal(response?.id, 1);
    assert.ok(response?.result, "packed MCP initialize response is missing result");
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
  run(npm, ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], { cwd: installRoot });

  const contract = JSON.parse(run(bin("nymrel-agent"), ["contract"], { cwd: installRoot }));
  assert.equal(contract.contractVersion, "nymrel.agent.route/v1");
  await verifyMcp(bin("nymrel-agent-mcp"));
  process.stdout.write(`packed-install-verification: pass (${process.platform})\n`);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
