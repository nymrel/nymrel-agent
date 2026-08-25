import type { ModelProfile, ProviderAdapter, RouteRequest } from "./contracts.js";
import { NymrelError } from "./errors.js";
import { OpenAIResponsesProvider } from "./openai-responses-provider.js";
import { parsePublicRoutePayload } from "./validation.js";

export interface OpenAIAdapterConfig {
  readonly kind: "openai-responses";
  readonly modelId: string;
  readonly providerModelId?: string;
  readonly apiKeyEnv: string;
  readonly baseUrl?: string;
  readonly organizationEnv?: string;
  readonly projectEnv?: string;
  readonly timeoutMs?: number;
}

export interface LocalAgentConfig {
  readonly route: RouteRequest;
  readonly models: readonly ModelProfile[];
  readonly adapters: readonly OpenAIAdapterConfig[];
}

function object(value: unknown, path: string, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new NymrelError("config_invalid", `${path} must be an object.`, 400);
  const row = value as Record<string, unknown>;
  const extra = Object.keys(row).filter((key) => !keys.includes(key));
  if (extra.length > 0) throw new NymrelError("config_invalid", `${path} contains unsupported fields: ${extra.sort().join(", ")}.`, 400);
  return row;
}

function stringValue(value: unknown, path: string, maximum = 200): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maximum) throw new NymrelError("config_invalid", `${path} must be a non-empty string of at most ${maximum} characters.`, 400);
  return value;
}

function optionalString(value: unknown, path: string, maximum = 200): string | undefined {
  return value === undefined ? undefined : stringValue(value, path, maximum);
}

function environmentName(value: unknown, path: string): string {
  const name = stringValue(value, path, 100);
  if (!/^[A-Z_][A-Z0-9_]*$/.test(name)) throw new NymrelError("config_invalid", `${path} must be an uppercase environment-variable name.`, 400);
  return name;
}

function optionalEnvironmentName(value: unknown, path: string): string | undefined {
  return value === undefined ? undefined : environmentName(value, path);
}

function adapter(value: unknown, index: number): OpenAIAdapterConfig {
  const path = `adapters[${index}]`;
  const row = object(value, path, ["kind", "modelId", "providerModelId", "apiKeyEnv", "baseUrl", "organizationEnv", "projectEnv", "timeoutMs"]);
  if (row.kind !== "openai-responses") throw new NymrelError("config_invalid", `${path}.kind must be openai-responses.`, 400);
  const providerModelId = optionalString(row.providerModelId, `${path}.providerModelId`, 160);
  const baseUrl = optionalString(row.baseUrl, `${path}.baseUrl`, 500);
  const organizationEnv = optionalEnvironmentName(row.organizationEnv, `${path}.organizationEnv`);
  const projectEnv = optionalEnvironmentName(row.projectEnv, `${path}.projectEnv`);
  if (row.timeoutMs !== undefined && (!Number.isSafeInteger(row.timeoutMs) || (row.timeoutMs as number) < 1_000 || (row.timeoutMs as number) > 300_000)) {
    throw new NymrelError("config_invalid", `${path}.timeoutMs must be an integer from 1000 to 300000.`, 400);
  }
  return {
    kind: "openai-responses",
    modelId: stringValue(row.modelId, `${path}.modelId`, 160),
    ...(providerModelId === undefined ? {} : { providerModelId }),
    apiKeyEnv: environmentName(row.apiKeyEnv, `${path}.apiKeyEnv`),
    ...(baseUrl === undefined ? {} : { baseUrl }),
    ...(organizationEnv === undefined ? {} : { organizationEnv }),
    ...(projectEnv === undefined ? {} : { projectEnv }),
    ...(row.timeoutMs === undefined ? {} : { timeoutMs: row.timeoutMs as number }),
  };
}

export function parseLocalAgentConfig(value: unknown): LocalAgentConfig {
  const root = object(value, "$", ["route", "models", "adapters"]);
  const payload = parsePublicRoutePayload({ request: root.route, models: root.models });
  if (!Array.isArray(root.adapters) || root.adapters.length === 0 || root.adapters.length > 100) throw new NymrelError("config_invalid", "adapters must contain 1 to 100 entries.", 400);
  const adapters = root.adapters.map(adapter);
  const ids = new Set<string>();
  const modelIds = new Set(payload.models.map((model) => model.modelId));
  for (const row of adapters) {
    if (!modelIds.has(row.modelId)) throw new NymrelError("config_invalid", `Adapter model ${row.modelId} has no matching model profile.`, 400);
    if (ids.has(row.modelId)) throw new NymrelError("config_invalid", `Duplicate adapter model id: ${row.modelId}.`, 400);
    ids.add(row.modelId);
  }
  return { route: payload.request, models: payload.models, adapters };
}

export function createConfiguredAdapters(config: LocalAgentConfig, environment: Readonly<Record<string, string | undefined>>): ProviderAdapter[] {
  const profiles = new Map(config.models.map((profile) => [profile.modelId, profile]));
  return config.adapters.map((row) => {
    const profile = profiles.get(row.modelId);
    if (!profile) throw new NymrelError("config_invalid", `Missing model profile for ${row.modelId}.`, 400);
    const apiKey = environment[row.apiKeyEnv];
    if (!apiKey) throw new NymrelError("credential_missing", `Required credential environment variable ${row.apiKeyEnv} is not set.`, 69);
    const organization = row.organizationEnv === undefined ? undefined : environment[row.organizationEnv];
    const project = row.projectEnv === undefined ? undefined : environment[row.projectEnv];
    return new OpenAIResponsesProvider(profile, {
      apiKey,
      ...(row.providerModelId === undefined ? {} : { providerModelId: row.providerModelId }),
      ...(row.baseUrl === undefined ? {} : { baseUrl: row.baseUrl }),
      ...(organization === undefined ? {} : { organization }),
      ...(project === undefined ? {} : { project }),
      ...(row.timeoutMs === undefined ? {} : { timeoutMs: row.timeoutMs }),
    });
  });
}
