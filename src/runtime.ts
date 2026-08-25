import { randomUUID } from "node:crypto";
import {
  type DoctorReport,
  type ModelProfile,
  type ProviderAdapter,
  type RunEvent,
  type RunRequest,
  type RunResult,
  type RunStatus,
  type RoutePlan,
  type RouteRequest,
} from "./contracts.js";
import { doctorProviders } from "./doctor.js";
import { compareCodeUnits } from "./ordering.js";
import { createRunReceipt } from "./receipt.js";
import { route } from "./router.js";

export interface RuntimeOptions {
  readonly clock?: () => string;
  readonly idFactory?: () => string;
  readonly maxOutputBytes?: number;
  readonly maxProviderEvents?: number;
}

type WithoutEventEnvelope<T> = T extends unknown ? Omit<T, "sequence" | "at"> : never;
type PendingRunEvent = WithoutEventEnvelope<RunEvent>;

function providerFailureReason(error: unknown): string {
  if (!(error instanceof Error)) return "provider_execution_failed";
  if (["provider_event_limit", "provider_output_limit"].includes(error.message)) return error.message;
  if (/^provider_http_4\d\d$/.test(error.message)) return "provider_http_4xx";
  if (/^provider_http_5\d\d$/.test(error.message)) return "provider_http_5xx";
  if (error.message === "provider_timeout") return "provider_timeout";
  if (error.message === "provider_response_incomplete") return "provider_response_incomplete";
  if (error.message === "provider_response_too_large") return "provider_response_limit";
  if (["provider_response_invalid", "provider_output_missing", "provider_response_not_completed"].includes(error.message)) {
    return "provider_response_invalid";
  }
  return "provider_execution_failed";
}

export class AgentRuntime {
  private readonly adaptersByModel = new Map<string, ProviderAdapter>();
  private readonly clock: () => string;
  private readonly idFactory: () => string;
  private readonly maxOutputBytes: number;
  private readonly maxProviderEvents: number;

  public constructor(adapters: readonly ProviderAdapter[], options: RuntimeOptions = {}) {
    for (const adapter of adapters) {
      if (this.adaptersByModel.has(adapter.profile.modelId)) {
        throw new Error(`Duplicate adapter model id: ${adapter.profile.modelId}`);
      }
      this.adaptersByModel.set(adapter.profile.modelId, adapter);
    }
    this.clock = options.clock ?? (() => new Date().toISOString());
    this.idFactory = options.idFactory ?? randomUUID;
    this.maxOutputBytes = options.maxOutputBytes ?? 4 * 1024 * 1024;
    this.maxProviderEvents = options.maxProviderEvents ?? 10_000;
  }

  private adapters(): ProviderAdapter[] {
    return [...this.adaptersByModel.values()].sort((a, b) => compareCodeUnits(a.profile.modelId, b.profile.modelId));
  }

  private staticProfiles(): ModelProfile[] {
    return this.adapters().map((adapter) => adapter.profile);
  }

  public async doctor(): Promise<DoctorReport> {
    return doctorProviders(this.adapters(), this.clock());
  }

  public async plan(request: RouteRequest): Promise<RoutePlan> {
    const checkedAt = this.clock();
    const profiles: ModelProfile[] = [];
    for (const adapter of this.adapters()) {
      let health = adapter.profile.health;
      let healthCode = adapter.profile.healthCode;
      try {
        const probe = await adapter.probe(checkedAt);
        health = probe.state;
        healthCode = probe.code;
      } catch {
        health = "unavailable";
        healthCode = "probe_failed";
      }
      profiles.push({ ...adapter.profile, health, ...(healthCode === undefined ? {} : { healthCode }) });
    }
    return route(request, profiles);
  }

  public async run(request: RunRequest): Promise<RunResult> {
    const runId = this.idFactory();
    const startedAt = this.clock();
    const events: RunEvent[] = [];
    const addEvent = (event: PendingRunEvent): void => {
      events.push({ ...event, sequence: events.length, at: this.clock() } as RunEvent);
    };
    addEvent({ type: "run.started", runId });

    const policyReasons: string[] = [];
    if (request.profile !== "read-only") policyReasons.push("runtime_profile_rejected");
    if (request.route.risk !== "read") policyReasons.push("runtime_non_read_rejected");
    if (request.task.trim().length === 0) policyReasons.push("task_empty");
    if (Buffer.byteLength(request.task, "utf8") > 256 * 1024) policyReasons.push("task_too_large");
    if (request.maxOutputTokens !== undefined && (!Number.isSafeInteger(request.maxOutputTokens) || request.maxOutputTokens < 1 || request.maxOutputTokens > 100_000)) {
      policyReasons.push("max_output_tokens_invalid");
    }

    if (policyReasons.length > 0) {
      const plan = route(request.route, this.staticProfiles());
      const reasons = [...new Set(policyReasons)].sort(compareCodeUnits);
      addEvent({ type: "run.blocked", reasonCodes: reasons });
      const endedAt = this.clock();
      return {
        plan,
        events,
        receipt: createRunReceipt({
          runId, status: "blocked", task: request.task, events,
          selectedModelId: plan.selectedModelId, selectedProviderId: plan.selectedProviderId,
          reasonCodes: reasons, inputTokens: 0, outputTokens: 0, startedAt, endedAt,
        }),
      };
    }

    const plan = await this.plan(request.route);
    if (plan.selectedModelId === null || plan.selectedProviderId === null) {
      const reasons = [...new Set(plan.decisionCodes)].sort(compareCodeUnits);
      addEvent({ type: "run.blocked", reasonCodes: reasons });
      const endedAt = this.clock();
      return {
        plan,
        events,
        receipt: createRunReceipt({
          runId, status: "blocked", task: request.task, events,
          selectedModelId: null, selectedProviderId: null, reasonCodes: reasons,
          inputTokens: 0, outputTokens: 0, startedAt, endedAt,
        }),
      };
    }

    const modelId = plan.selectedModelId;
    const providerId = plan.selectedProviderId;
    const adapter = this.adaptersByModel.get(modelId);
    if (!adapter || adapter.profile.providerId !== providerId) throw new Error(`Selected model has no matching adapter: ${modelId}`);
    addEvent({ type: "route.selected", modelId, providerId, decisionCodes: plan.decisionCodes });

    let output = "";
    let outputBytes = 0;
    let providerEventCount = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let status: RunStatus = "completed";
    const reasonCodes: string[] = [
      adapter.executionKind === "live" ? "live_provider_executed" : "synthetic_provider_verified",
      "read_only_policy_allowed",
    ];

    try {
      for await (const providerEvent of adapter.run({
        runId, task: request.task, phase: request.route.phase, risk: request.route.risk,
        ...(request.maxOutputTokens === undefined ? {} : { maxOutputTokens: request.maxOutputTokens }),
      })) {
        providerEventCount += 1;
        if (providerEventCount > this.maxProviderEvents) throw new Error("provider_event_limit");
        if (providerEvent.type === "delta") {
          const byteLength = Buffer.byteLength(providerEvent.text, "utf8");
          outputBytes += byteLength;
          if (outputBytes > this.maxOutputBytes) throw new Error("provider_output_limit");
          output += providerEvent.text;
          addEvent({ type: "provider.chunk", modelId, byteLength });
        } else {
          inputTokens = providerEvent.inputTokens;
          outputTokens = providerEvent.outputTokens;
        }
      }
      addEvent({ type: "run.completed", modelId });
    } catch (error) {
      status = "failed";
      const reasonCode = providerFailureReason(error);
      reasonCodes.push(reasonCode);
      addEvent({ type: "run.failed", reasonCode });
    }

    const endedAt = this.clock();
    return {
      ...(status === "completed" ? { output } : {}),
      plan,
      events,
      receipt: createRunReceipt({
        runId, status, task: request.task, ...(status === "completed" ? { output } : {}), events,
        selectedModelId: modelId, selectedProviderId: providerId, reasonCodes,
        inputTokens, outputTokens, startedAt, endedAt,
      }),
    };
  }
}
