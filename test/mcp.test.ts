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

async function verifyHandshake(protocolVersion: string): Promise<void> {
  const child = spawn(process.execPath, [path.join(process.cwd(), "dist", "src", "bin", "nymrel-agent-mcp.js")], { cwd: process.cwd(), stdio: ["pipe", "pipe", "pipe"] });
  const rpc = rpcHarness(child);
  try {
    const initialized = await rpc.request("initialize", { protocolVersion, capabilities: {}, clientInfo: { name: "nymrel-agent-test", version: "1.0.0" } });
    assert.equal(initialized.error, undefined);
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

for (const protocolVersion of ["2025-11-25", "2026-07-28"]) {
  test(`MCP ${protocolVersion} stdio handshake lists and calls the read-only routing tools`, async () => {
    await verifyHandshake(protocolVersion);
  });
}
