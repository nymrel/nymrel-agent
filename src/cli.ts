#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { CONTRACT_VERSION, PRODUCT_VERSION } from "./contracts.js";
import { createDefaultRouteRequest, createDemoRuntime } from "./defaults.js";
import { NymrelError, publicError } from "./errors.js";
import { createConfiguredAdapters, parseLocalAgentConfig } from "./local-config.js";
import { route } from "./router.js";
import { AgentRuntime } from "./runtime.js";
import { parsePublicRoutePayload } from "./validation.js";

function flagValue(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function requireFlag(args: readonly string[], flag: string): string {
  const value = flagValue(args, flag);
  if (!value) throw new NymrelError("usage_error", `${flag} is required.`, 64);
  return value;
}

function parseJson(text: string, label: string): unknown {
  try { return JSON.parse(text) as unknown; }
  catch { throw new NymrelError("invalid_json", `${label} does not contain valid JSON.`, 65); }
}

function readText(path: string): string {
  try { return readFileSync(path === "-" ? 0 : path, "utf8"); }
  catch { throw new NymrelError("input_unreadable", `Could not read ${path === "-" ? "stdin" : "the requested file"}.`, 66); }
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function endpointUrl(value: string): string {
  const url = new URL(value);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  if (url.username || url.password || url.search || url.hash || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) {
    throw new NymrelError("endpoint_invalid", "The endpoint must use HTTPS (or HTTP localhost) and contain no credentials, query, or fragment.", 64);
  }
  return `${url.toString().replace(/\/$/, "")}/v1/route`;
}

async function remoteRoute(endpoint: string, payload: unknown): Promise<number> {
  let response: Response;
  try {
    response = await fetch(endpointUrl(endpoint), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new NymrelError("endpoint_unavailable", "The routing endpoint could not be reached.", 69);
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 1024 * 1024) throw new NymrelError("response_too_large", "The routing endpoint returned an oversized response.", 69);
  const result = parseJson(new TextDecoder().decode(bytes), "The endpoint response");
  printJson(result);
  return response.ok ? 0 : 69;
}

function localConfig(args: readonly string[]): ReturnType<typeof parseLocalAgentConfig> {
  return parseLocalAgentConfig(parseJson(readText(requireFlag(args, "--config")), "The local config"));
}

function taskText(args: readonly string[]): string {
  const inline = flagValue(args, "--task");
  const file = flagValue(args, "--task-file");
  if (inline !== undefined && file !== undefined) throw new NymrelError("usage_error", "Use either --task or --task-file, not both.", 64);
  if (inline !== undefined) return inline;
  if (file !== undefined) return readText(file);
  throw new NymrelError("usage_error", "--task or --task-file is required.", 64);
}

function help(): void {
  process.stdout.write(`Nymrel Agent ${PRODUCT_VERSION}\n\n` +
    "Usage:\n" +
    "  nymrel-agent route --file PAYLOAD.json [--endpoint https://host]\n" +
    "  nymrel-agent models doctor [--config CONFIG.json]\n" +
    "  nymrel-agent run --config CONFIG.json (--task TEXT | --task-file FILE|-) [--max-output-tokens N]\n" +
    "  nymrel-agent contract\n" +
    "  nymrel-agent demo\n\n" +
    "Local routing is the default. Live execution reads provider credentials only from environment-variable names declared in CONFIG.json.\n");
}

export async function main(args: readonly string[] = process.argv.slice(2)): Promise<number> {
  const command = args[0];
  if (command === undefined || command === "help" || command === "--help" || command === "-h") { help(); return 0; }
  if (command === "contract") { printJson({ name: "Nymrel Agent", version: PRODUCT_VERSION, contractVersion: CONTRACT_VERSION, publicExecution: false, localExecutionProfile: "read-only" }); return 0; }
  if (command === "demo") {
    const result = await createDemoRuntime().run({ task: "Explain the demo boundary.", profile: "read-only", route: createDefaultRouteRequest() });
    printJson(result);
    return result.receipt.status === "completed" ? 0 : 2;
  }
  if (command === "route") {
    const payload = parsePublicRoutePayload(parseJson(readText(requireFlag(args, "--file")), "The route payload"));
    const endpoint = flagValue(args, "--endpoint");
    if (endpoint !== undefined) return remoteRoute(endpoint, payload);
    printJson({ ok: true, requestId: "local", plan: route(payload.request, payload.models) });
    return 0;
  }
  if (command === "models" && args[1] === "doctor") {
    const configPath = flagValue(args, "--config");
    const runtime = configPath === undefined
      ? createDemoRuntime()
      : new AgentRuntime(createConfiguredAdapters(localConfig(args), process.env));
    printJson(await runtime.doctor());
    return 0;
  }
  if (command === "run") {
    const config = localConfig(args);
    const runtime = new AgentRuntime(createConfiguredAdapters(config, process.env));
    const maxOutputRaw = flagValue(args, "--max-output-tokens");
    const maxOutputTokens = maxOutputRaw === undefined ? undefined : Number(maxOutputRaw);
    const result = await runtime.run({
      task: taskText(args), profile: "read-only", route: config.route,
      ...(maxOutputTokens === undefined ? {} : { maxOutputTokens }),
    });
    printJson(result);
    return result.receipt.status === "completed" ? 0 : 2;
  }
  throw new NymrelError("usage_error", "Unknown command. Run nymrel-agent --help.", 64);
}

async function invoked(): Promise<void> {
  try { process.exitCode = await main(); }
  catch (caught) {
    const error = publicError(caught);
    process.stderr.write(`${JSON.stringify({ ok: false, error: { code: error.code, message: error.message, ...(error.details.length === 0 ? {} : { details: error.details }) } })}\n`);
    const code = error.code;
    process.exitCode = code === "usage_error" || code === "endpoint_invalid" ? 64
      : code === "input_unreadable" ? 66
      : code === "credential_missing" || code.startsWith("endpoint_") ? 69
      : code === "invalid_json" || code === "invalid_request" || code === "config_invalid" ? 65
      : 70;
  }
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href) await invoked();
