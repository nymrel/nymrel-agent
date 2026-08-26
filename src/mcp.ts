#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio, type StdioServerHandle } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { CONTRACT_VERSION, PRODUCT_VERSION } from "./contracts.js";
import { NymrelError, publicError } from "./errors.js";
import { route } from "./router.js";
import { parsePublicRoutePayload } from "./validation.js";

const readOnlyAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

export function createNymrelMcpServer(): McpServer {
  const server = new McpServer({ name: "nymrel-agent", version: PRODUCT_VERSION }, { capabilities: { tools: {} } });
  server.registerTool(
    "route_models",
    {
      title: "Route models",
      description: "Select and explain a model from caller-supplied routing metadata. Do not include prompts, credentials, or customer data.",
      inputSchema: z.object({ payload: z.string().min(2).max(256 * 1024).describe("JSON with exactly request and models, matching nymrel.agent.route/v1") }),
      annotations: readOnlyAnnotations,
    },
    async ({ payload }) => {
      try {
        if (new TextEncoder().encode(payload).byteLength > 256 * 1024) throw new NymrelError("payload_too_large", "The routing payload exceeds 256 KiB.", 413);
        const parsed = parsePublicRoutePayload(JSON.parse(payload) as unknown);
        const plan = route(parsed.request, parsed.models);
        return { content: [{ type: "text", text: JSON.stringify(plan, null, 2) }], structuredContent: JSON.parse(JSON.stringify(plan)) as Record<string, unknown> };
      } catch (caught) {
        const error = publicError(caught);
        return { isError: true, content: [{ type: "text", text: JSON.stringify({ code: error.code, message: error.message, ...(error.details.length === 0 ? {} : { details: error.details }) }) }] };
      }
    },
  );
  server.registerTool(
    "explain_contract",
    {
      title: "Explain the routing contract",
      description: "Return the stable Nymrel Agent v0.1 routing and custody boundary.",
      inputSchema: z.object({}),
      annotations: readOnlyAnnotations,
    },
    async () => {
      const contract = {
        contractVersion: CONTRACT_VERSION,
        objectives: ["balanced", "quality", "cost", "latency"],
        filters: ["health", "risk", "data_boundary", "tool_use", "structured_output", "context", "modality", "cost", "latency"],
        scoring: {
          cost: "request_ceiling_when_present_else_eligible_set_range",
          latency: "request_ceiling_when_present_else_eligible_set_range",
          receiptField: "scoreNormalization",
        },
        publicService: "routing_metadata_only",
        localExecution: "read_only",
        prohibitedInputs: ["prompts", "provider_credentials", "customer_data"],
      };
      return { content: [{ type: "text", text: JSON.stringify(contract, null, 2) }], structuredContent: contract };
    },
  );
  return server;
}

export function serve(): StdioServerHandle {
  return serveStdio(() => createNymrelMcpServer());
}
