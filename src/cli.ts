#!/usr/bin/env node
import { readFileSync, statSync } from "node:fs";
import { CONTRACT_VERSION, CONTRACT_VERSION_V2, PRODUCT_VERSION } from "./contracts.js";
import { createDefaultRouteRequest, createDemoRuntime } from "./defaults.js";
import { NymrelError, publicError } from "./errors.js";
import { createConfiguredAdapters, parseLocalAgentConfig } from "./local-config.js";
import { route, routeV2 } from "./router.js";
import { AgentRuntime } from "./runtime.js";
import { parseJobManifest, planJob } from "./job.js";
import { createJobPlanReceipt } from "./receipt.js";
import { isLoopbackHostname } from "./url-security.js";
import { parsePublicRoutePayload, parsePublicRoutePayloadV2 } from "./validation.js";

function flagValue(args: readonly string[], flag: string): string | undefined {
  const indexes = args.flatMap((value, index) => value === flag ? [index] : []);
  if (indexes.length > 1) throw new NymrelError("usage_error", `${flag} may be provided only once.`, 64);
  const index = indexes[0];
  if (index === undefined) return undefined;
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) throw new NymrelError("usage_error", `${flag} requires a value.`, 64);
  return value;
}

function validateOptions(args: readonly string[], start: number, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  const seen = new Set<string>();
  for (let index = start; index < args.length; index += 2) {
    const flag = args[index];
    if (flag === undefined || !allowedSet.has(flag)) throw new NymrelError("usage_error", "Unknown or misplaced command option.", 64);
    if (seen.has(flag)) throw new NymrelError("usage_error", `${flag} may be provided only once.`, 64);
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) throw new NymrelError("usage_error", `${flag} requires a value.`, 64);
    seen.add(flag);
  }
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

function readText(path: string, maximumBytes?: number): string {
  try {
    if (maximumBytes !== undefined && path !== "-" && statSync(path).size > maximumBytes) {
      throw new NymrelError("invalid_request", "The requested input exceeds the allowed size.", 65);
    }
    const text = readFileSync(path === "-" ? 0 : path, "utf8");
    if (maximumBytes !== undefined && Buffer.byteLength(text, "utf8") > maximumBytes) {
      throw new NymrelError("invalid_request", "The requested input exceeds the allowed size.", 65);
    }
    return text;
  }
  catch (caught) {
    if (caught instanceof NymrelError) throw caught;
    throw new NymrelError("input_unreadable", `Could not read ${path === "-" ? "stdin" : "the requested file"}.`, 66);
  }
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function endpointUrl(value: string, contractVersion: "v1" | "v2"): string {
  let url: URL;
  try { url = new URL(value); }
  catch { throw new NymrelError("endpoint_invalid", "The endpoint must be a valid URL.", 64); }
  const local = isLoopbackHostname(url.hostname);
  if (url.username || url.password || url.search || url.hash || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) {
    throw new NymrelError("endpoint_invalid", "The endpoint must use HTTPS (or HTTP localhost) and contain no credentials, query, or fragment.", 64);
  }
  return `${url.toString().replace(/\/$/, "")}/${contractVersion}/route`;
}

export async function boundedResponseBody(response: Response, maximum: number): Promise<Uint8Array> {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength) || !Number.isSafeInteger(Number(declaredLength))) {
      throw new NymrelError("endpoint_invalid_response", "The routing endpoint returned an invalid Content-Length.", 69);
    }
    if (Number(declaredLength) > maximum) {
      throw new NymrelError("response_too_large", "The routing endpoint returned an oversized response.", 69);
    }
  }
  if (response.body === null) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximum) {
        try { await reader.cancel(); } catch { /* The bounded error remains authoritative. */ }
        throw new NymrelError("response_too_large", "The routing endpoint returned an oversized response.", 69);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

async function remoteRoute(endpoint: string, payload: unknown, contractVersion: "v1" | "v2"): Promise<number> {
  const url = endpointUrl(endpoint, contractVersion);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new NymrelError("endpoint_unavailable", "The routing endpoint could not be reached.", 69);
  }
  const bytes = await boundedResponseBody(response, 1024 * 1024);
  const result = parseJson(new TextDecoder().decode(bytes), "The endpoint response");
  printJson(result);
  return response.ok ? 0 : 69;
}

function routeContractVersion(args: readonly string[]): "v1" | "v2" {
  const value = flagValue(args, "--contract-version");
  if (value === undefined || value === "v1") return "v1";
  if (value === "v2") return "v2";
  throw new NymrelError("usage_error", "--contract-version must be v1 or v2.", 64);
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
    "  nymrel-agent route --file PAYLOAD.json [--contract-version v2] [--endpoint https://host]\n" +
    "  nymrel-agent job plan --file MANIFEST.json\n" +
    "  nymrel-agent models doctor [--config CONFIG.json]\n" +
    "  nymrel-agent run --config CONFIG.json (--task TEXT | --task-file FILE|-) [--max-output-tokens N]\n" +
    "  nymrel-agent contract\n" +
    "  nymrel-agent demo\n\n" +
    "Local routing is the default. Live execution reads provider credentials only from environment-variable names declared in CONFIG.json.\n");
}

export async function main(args: readonly string[] = process.argv.slice(2)): Promise<number> {
  const command = args[0];
  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    if (args.length > 1) throw new NymrelError("usage_error", "Help does not accept additional options.", 64);
    help(); return 0;
  }
  if (command === "contract") {
    validateOptions(args, 1, []);
    printJson({ name: "Nymrel Agent", version: PRODUCT_VERSION, contractVersion: CONTRACT_VERSION, publicExecution: false, localExecutionProfile: "read-only" }); return 0;
  }
  if (command === "demo") {
    validateOptions(args, 1, []);
    const result = await createDemoRuntime().run({ task: "Explain the demo boundary.", profile: "read-only", route: createDefaultRouteRequest() });
    printJson(result);
    return result.receipt.status === "completed" ? 0 : 2;
  }
  if (command === "route") {
    validateOptions(args, 1, ["--file", "--endpoint", "--contract-version"]);
    const contractVersion = routeContractVersion(args);
    const payloadValue = parseJson(readText(requireFlag(args, "--file")), "The route payload");
    const payload = contractVersion === "v1" ? parsePublicRoutePayload(payloadValue) : parsePublicRoutePayloadV2(payloadValue);
    const endpoint = flagValue(args, "--endpoint");
    if (endpoint !== undefined) return remoteRoute(endpoint, payload, contractVersion);
    const plan = contractVersion === "v1"
      ? route(payload.request, payload.models)
      : routeV2(payload.request, payload.models);
    printJson({ ok: true, requestId: "local", plan });
    return 0;
  }
  if (command === "job" && args[1] === "plan") {
    validateOptions(args, 2, ["--file"]);
    const manifest = parseJobManifest(parseJson(readText(requireFlag(args.slice(2), "--file"), 256 * 1024), "The job manifest"));
    const plan = planJob(manifest);
    printJson({ ok: true, plan, receipt: createJobPlanReceipt(manifest, plan) });
    return plan.status === "blocked" ? 2 : 0;
  }
  if (command === "models" && args[1] === "doctor") {
    validateOptions(args, 2, ["--config"]);
    const configPath = flagValue(args, "--config");
    const runtime = configPath === undefined
      ? createDemoRuntime()
      : new AgentRuntime(createConfiguredAdapters(localConfig(args), process.env));
    printJson(await runtime.doctor());
    return 0;
  }
  if (command === "run") {
    validateOptions(args, 1, ["--config", "--task", "--task-file", "--max-output-tokens"]);
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

export async function invokeCli(): Promise<void> {
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
