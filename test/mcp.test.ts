import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

interface RpcResponse { readonly id?: number; readonly result?: Record<string, unknown>; readonly error?: unknown }

const legacyContract = {
  contractVersion: "nymrel.agent.route/v1",
  objectives: ["balanced", "quality", "cost", "latency"],
  filters: ["health", "risk", "data_boundary", "tool_use", "structured_output", "context", "modality", "cost", "latency"],
  scoring: {
    cost: "request_ceiling_when_present_else_eligible_set_range",
    latency: "request_ceiling_when_present_else_eligible_set_range",
    receiptModeField: "decisionCodes",
    receiptBoundsField: "explanation",
  },
  publicService: "routing_metadata_only",
  localExecution: "read_only",
  prohibitedInputs: ["prompts", "provider_credentials", "customer_data"],
};

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
    assert.deepEqual(tools.map((tool) => tool.name).sort(), ["explain_contract", "explain_contract_v2", "route_models", "route_models_v2"]);
    assert.ok(tools.every((tool) => tool.annotations?.readOnlyHint === true));
    const explained = await rpc.request("tools/call", { name: "explain_contract", arguments: {} });
    assert.deepEqual(explained.result?.structuredContent, legacyContract);
    const v2Explained = await rpc.request("tools/call", { name: "explain_contract_v2", arguments: {} });
    assert.equal(v2Explained.error, undefined);
    assert.deepEqual(v2Explained.result?.structuredContent, {
      contractVersion: "nymrel.agent.route/v2",
      objectives: ["balanced", "quality", "cost", "latency"],
      filters: ["health", "risk", "data_boundary", "tool_use", "structured_output", "context", "modality", "cost", "latency"],
      normalization: { basis: "request_budget", anchors: ["costAnchorMicroUsd", "latencyAnchorMs"] },
      scoring: { selection: "hard_eligibility_then_pareto_frontier_then_weighted_score", incumbent: "exact_frontier_weighted_score_tie_only" },
      publicService: "routing_metadata_only",
      localExecution: "read_only",
      prohibitedInputs: ["prompts", "provider_credentials", "customer_data"],
    });
    const payload = readFileSync("examples/route-request.json", "utf8");
    const called = await rpc.request("tools/call", { name: "route_models", arguments: { payload } });
    assert.equal(called.error, undefined);
    const structured = called.result?.structuredContent as { selectedModelId?: string };
    assert.equal(structured.selectedModelId, "provider-b/fast");
    const v2Payload = readFileSync("examples/route-request-v2.json", "utf8");
    const v2Called = await rpc.request("tools/call", { name: "route_models_v2", arguments: { payload: v2Payload } });
    assert.equal(v2Called.error, undefined);
    const v2Structured = v2Called.result?.structuredContent as { contractVersion?: string; selectedModelId?: string };
    assert.equal(v2Structured.contractVersion, "nymrel.agent.route/v2");
    assert.equal(v2Structured.selectedModelId, "provider-b/fast");
    const v1WithV2 = await rpc.request("tools/call", { name: "route_models", arguments: { payload: v2Payload } });
    assert.equal(v1WithV2.result?.isError, true);
    const v2WithV1 = await rpc.request("tools/call", { name: "route_models_v2", arguments: { payload } });
    assert.equal(v2WithV1.result?.isError, true);
    for (const [field, privateValue] of [["prompt", "prompt-private-value"], ["customerData", "customer-private-value"]] as const) {
      const badPayload = JSON.stringify({ ...JSON.parse(v2Payload) as object, [field]: privateValue });
      const rejected = await rpc.request("tools/call", { name: "route_models_v2", arguments: { payload: badPayload } });
      assert.equal(rejected.result?.isError, true);
      assert.doesNotMatch(JSON.stringify(rejected.result), new RegExp(privateValue));
    }
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
    assert.deepEqual(discoveryMeta["io.modelcontextprotocol/serverInfo"], { name: "nymrel-agent", version: "0.1.3" });

    const listed = await rpc.request("tools/list", { _meta: modernMeta });
    assert.equal(listed.error, undefined);
    assert.equal(listed.result?.resultType, "complete");
    const tools = listed.result?.tools as Array<{ name: string; annotations?: { readOnlyHint?: boolean } }>;
    assert.deepEqual(tools.map((tool) => tool.name).sort(), ["explain_contract", "explain_contract_v2", "route_models", "route_models_v2"]);
    assert.ok(tools.every((tool) => tool.annotations?.readOnlyHint === true));

    const payload = readFileSync("examples/route-request.json", "utf8");
    const called = await rpc.request("tools/call", { name: "route_models", arguments: { payload }, _meta: modernMeta });
    assert.equal(called.error, undefined);
    assert.equal(called.result?.resultType, "complete");
    const structured = called.result?.structuredContent as { selectedModelId?: string };
    assert.equal(structured.selectedModelId, "provider-b/fast");
    const v2Payload = readFileSync("examples/route-request-v2.json", "utf8");
    const v2Called = await rpc.request("tools/call", { name: "route_models_v2", arguments: { payload: v2Payload }, _meta: modernMeta });
    assert.equal(v2Called.error, undefined);
    const v2Structured = v2Called.result?.structuredContent as { contractVersion?: string; selectedModelId?: string };
    assert.equal(v2Structured.contractVersion, "nymrel.agent.route/v2");
    assert.equal(v2Structured.selectedModelId, "provider-b/fast");
  } finally {
    child.stdin.end();
    child.kill();
  }
}

test("MCP 2025-11-25 stdio initialize lists and calls the read-only routing tools", verifyLegacyHandshake);
test("MCP 2026-07-28 stdio discovery and per-request envelopes list and call the read-only routing tools", verifyModernHandshake);
