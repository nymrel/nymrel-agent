import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

interface RpcResponse { readonly id?: number; readonly result?: Record<string, unknown>; readonly error?: unknown }

function rpcHarness(child: ChildProcessWithoutNullStreams): {
  request(method: string, params: Record<string, unknown>): Promise<RpcResponse>;
  notify(method: string, params?: Record<string, unknown>): void;
} {
  let nextId = 1;
  let buffer = "";
  const pending = new Map<number, { resolve(value: RpcResponse): void; reject(error: Error): void; timer: NodeJS.Timeout }>();
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buffer += chunk;
    while (buffer.includes("\n")) {
      const index = buffer.indexOf("\n");
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line) continue;
      const response = JSON.parse(line) as RpcResponse;
      if (typeof response.id !== "number") continue;
      const waiter = pending.get(response.id);
      if (!waiter) continue;
      clearTimeout(waiter.timer);
      pending.delete(response.id);
      waiter.resolve(response);
    }
  });
  return {
    request(method, params) {
      const id = nextId++;
      const promise = new Promise<RpcResponse>((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`MCP request timed out: ${method}`)); }, 5_000);
        pending.set(id, { resolve, reject, timer });
      });
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
      return promise;
    },
    notify(method, params = {}) { child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`); },
  };
}

async function verifyLegacyHandshake(): Promise<void> {
  const child = spawn(process.execPath, [path.join(process.cwd(), "dist", "src", "bin", "nymrel-agent-mcp.js")], { cwd: process.cwd(), stdio: ["pipe", "pipe", "pipe"] });
  const rpc = rpcHarness(child);
  try {
    const initialized = await rpc.request("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "nymrel-agent-test", version: "1.0.0" } });
    assert.equal(initialized.error, undefined);
    assert.equal(initialized.result?.protocolVersion, "2025-11-25");
    rpc.notify("notifications/initialized");
    const listed = await rpc.request("tools/list", {});
    const tools = listed.result?.tools as Array<{ name: string; annotations?: { readOnlyHint?: boolean } }>;
    assert.deepEqual(tools.map((tool) => tool.name).sort(), ["explain_contract", "route_models"]);
    assert.ok(tools.every((tool) => tool.annotations?.readOnlyHint === true));
    const payload = readFileSync("examples/route-request.json", "utf8");
    const called = await rpc.request("tools/call", { name: "route_models", arguments: { payload } });
    assert.equal(called.error, undefined);
    const structured = called.result?.structuredContent as { selectedModelId?: string };
    assert.equal(structured.selectedModelId, "provider-b/fast");
  } finally {
    child.stdin.end();
    child.kill();
  }
}

const modernMeta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientCapabilities": {},
  "io.modelcontextprotocol/clientInfo": { name: "nymrel-agent-test", version: "1.0.0" },
};

async function verifyModernHandshake(): Promise<void> {
  const child = spawn(process.execPath, [path.join(process.cwd(), "dist", "src", "bin", "nymrel-agent-mcp.js")], { cwd: process.cwd(), stdio: ["pipe", "pipe", "pipe"] });
  const rpc = rpcHarness(child);
  try {
    const discovered = await rpc.request("server/discover", { _meta: modernMeta });
    assert.equal(discovered.error, undefined);
    assert.equal(discovered.result?.resultType, "complete");
    assert.deepEqual(discovered.result?.supportedVersions, ["2026-07-28"]);
    const discoveryMeta = discovered.result?._meta as Record<string, unknown>;
    assert.deepEqual(discoveryMeta["io.modelcontextprotocol/serverInfo"], { name: "nymrel-agent", version: "0.1.0" });

    const listed = await rpc.request("tools/list", { _meta: modernMeta });
    assert.equal(listed.error, undefined);
    assert.equal(listed.result?.resultType, "complete");
    const tools = listed.result?.tools as Array<{ name: string; annotations?: { readOnlyHint?: boolean } }>;
    assert.deepEqual(tools.map((tool) => tool.name).sort(), ["explain_contract", "route_models"]);
    assert.ok(tools.every((tool) => tool.annotations?.readOnlyHint === true));

    const payload = readFileSync("examples/route-request.json", "utf8");
    const called = await rpc.request("tools/call", { name: "route_models", arguments: { payload }, _meta: modernMeta });
    assert.equal(called.error, undefined);
    assert.equal(called.result?.resultType, "complete");
    const structured = called.result?.structuredContent as { selectedModelId?: string };
    assert.equal(structured.selectedModelId, "provider-b/fast");
  } finally {
    child.stdin.end();
    child.kill();
  }
}

test("MCP 2025-11-25 stdio initialize lists and calls the read-only routing tools", verifyLegacyHandshake);
test("MCP 2026-07-28 stdio discovery and per-request envelopes list and call the read-only routing tools", verifyModernHandshake);
