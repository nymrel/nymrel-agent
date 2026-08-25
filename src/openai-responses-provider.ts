import type { ModelProfile, ProviderAdapter, ProviderHealth, ProviderRunEvent, ProviderRunInput } from "./contracts.js";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface OpenAIResponsesProviderOptions {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly providerModelId?: string;
  readonly organization?: string;
  readonly project?: string;
  readonly timeoutMs?: number;
  readonly fetcher?: Fetcher;
}

function validatedBaseUrl(value: string): string {
  const url = new URL(value);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  if (url.username || url.password || url.search || url.hash || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) {
    throw new Error("OpenAI Responses base URL must use HTTPS (or HTTP localhost) with no credentials, query, or fragment");
  }
  return url.toString().replace(/\/$/, "");
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function outputText(value: unknown): string {
  const root = record(value);
  if (!root) throw new Error("provider_response_invalid");
  if (typeof root.output_text === "string" && root.output_text.length > 0) return root.output_text;
  if (!Array.isArray(root.output)) throw new Error("provider_output_missing");
  const parts: string[] = [];
  for (const item of root.output) {
    const message = record(item);
    if (!message || !Array.isArray(message.content)) continue;
    for (const contentItem of message.content) {
      const content = record(contentItem);
      if (content?.type === "output_text" && typeof content.text === "string") parts.push(content.text);
    }
  }
  const combined = parts.join("");
  if (combined.length === 0) throw new Error("provider_output_missing");
  return combined;
}

function usage(value: unknown): { inputTokens: number; outputTokens: number } {
  const root = record(value);
  const row = record(root?.usage);
  const inputTokens = Number.isSafeInteger(row?.input_tokens) && (row?.input_tokens as number) >= 0 ? row?.input_tokens as number : 0;
  const outputTokens = Number.isSafeInteger(row?.output_tokens) && (row?.output_tokens as number) >= 0 ? row?.output_tokens as number : 0;
  return { inputTokens, outputTokens };
}

export class OpenAIResponsesProvider implements ProviderAdapter {
  public readonly profile: ModelProfile;
  public readonly executionKind = "live" as const;
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #providerModelId: string;
  readonly #organization: string | undefined;
  readonly #project: string | undefined;
  readonly #timeoutMs: number;
  readonly #fetcher: Fetcher;

  public constructor(profile: ModelProfile, options: OpenAIResponsesProviderOptions) {
    if (options.apiKey.trim().length === 0) throw new Error("OpenAI API key is required");
    if (!profile.riskClasses.includes("read")) throw new Error("OpenAI Responses adapter requires a read-capable profile");
    if (profile.capabilities.toolUse) throw new Error("OpenAI Responses adapter v0.1 does not execute tools");
    if (profile.capabilities.structuredOutput) throw new Error("OpenAI Responses adapter v0.1 does not enforce structured output");
    if (profile.capabilities.modalities.some((modality) => modality !== "text")) throw new Error("OpenAI Responses adapter v0.1 accepts text only");
    if (options.providerModelId !== undefined && options.providerModelId.trim().length === 0) throw new Error("OpenAI provider model id must not be empty");
    this.profile = profile;
    this.#apiKey = options.apiKey;
    this.#baseUrl = validatedBaseUrl(options.baseUrl ?? "https://api.openai.com/v1");
    this.#providerModelId = options.providerModelId ?? profile.modelId;
    this.#organization = options.organization;
    this.#project = options.project;
    this.#timeoutMs = Math.min(Math.max(options.timeoutMs ?? 60_000, 1_000), 300_000);
    this.#fetcher = options.fetcher ?? fetch;
  }

  public async probe(checkedAt: string): Promise<ProviderHealth> {
    return { modelId: this.profile.modelId, providerId: this.profile.providerId, state: this.profile.health, code: "configured_no_network_probe", checkedAt };
  }

  public async *run(input: ProviderRunInput): AsyncIterable<ProviderRunEvent> {
    if (input.risk !== "read") throw new Error("runtime_non_read_rejected");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      const headers = new Headers({
        "Authorization": `Bearer ${this.#apiKey}`,
        "Content-Type": "application/json",
      });
      if (this.#organization) headers.set("OpenAI-Organization", this.#organization);
      if (this.#project) headers.set("OpenAI-Project", this.#project);
      const response = await this.#fetcher(`${this.#baseUrl}/responses`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: this.#providerModelId,
          input: input.task,
          max_output_tokens: input.maxOutputTokens ?? 2_048,
          store: false,
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`provider_http_${response.status}`);
      const payload = await response.json() as unknown;
      yield { type: "delta", text: outputText(payload) };
      yield { type: "usage", ...usage(payload) };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw new Error("provider_timeout");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
