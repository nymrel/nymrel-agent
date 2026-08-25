import { randomUUID } from "node:crypto";
import {
  type DoctorReport,
  type ModelProfile,
  type RunEvent,
  type RunRequest,
  type RunResult,
  type RunStatus,
  type RoutePlan,
  type RouteRequest,
} from "./contracts.js";
import { doctorProviders } from "./doctor.js";
import { FakeProvider } from "./fake-provider.js";
import { compareCodeUnits } from "./ordering.js";
import { createRunReceipt } from "./receipt.js";
import { route } from "./router.js";

export interface RuntimeOptions {
  readonly clock?: () => string;
  readonly idFactory?: () => string;
}

type WithoutEventEnvelope<T> = T extends unknown ? Omit<T, "sequence" | "at"> : never;
type PendingRunEvent = WithoutEventEnvelope<RunEvent>;

export class AgentRuntime {
  private readonly adaptersByModel = new Map<string, FakeProvider>();
  private readonly clock: () => string;
  private readonly idFactory: () => string;

  public constructor(
    adapters: readonly FakeProvider[],
    options: RuntimeOptions = {},
  ) {
    for (const adapter of adapters) {
      if (
        !(adapter instanceof FakeProvider) ||
        Object.getPrototypeOf(adapter) !== FakeProvider.prototype ||
        adapter.executionKind !== "synthetic"
      ) {
        throw new Error("Phase 0 accepts exact FakeProvider instances only");
      }
      if (this.adaptersByModel.has(adapter.profile.modelId)) {
        throw new Error(`Duplicate adapter model id: ${adapter.profile.modelId}`);
      }
      this.adaptersByModel.set(adapter.profile.modelId, adapter);
    }
    this.clock = options.clock ?? (() => new Date().toISOString());
    this.idFactory = options.idFactory ?? randomUUID;
  }

  private adapters(): FakeProvider[] {
    return [...this.adaptersByModel.values()].sort((a, b) =>
      compareCodeUnits(a.profile.modelId, b.profile.modelId),
    );
  }

  private staticProfiles(): ModelProfile[] {
    return this.adapters().map((adapter) => adapter.profile);
  }

  public async doctor(): Promise<DoctorReport> {
    return doctorProviders(this.adapters(), this.clock());
  }

  public async plan(request: RouteRequest): Promise<RoutePlan> {
    if (request.risk !== "read") return route(request, this.staticProfiles());
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
      profiles.push({
        ...adapter.profile,
        health,
        ...(healthCode === undefined ? {} : { healthCode }),
      });
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
    if (request.profile !== "read-only") policyReasons.push("phase0_profile_rejected");
    if (request.route.risk !== "read") policyReasons.push("phase0_non_read_rejected");
    if (request.task.trim().length === 0) policyReasons.push("task_empty");

    if (policyReasons.length > 0) {
      const plan = route(request.route, this.staticProfiles());
      const reasons = [...new Set(policyReasons)].sort(compareCodeUnits);
      addEvent({ type: "run.blocked", reasonCodes: reasons });
      const endedAt = this.clock();
      return {
        plan,
        events,
        receipt: createRunReceipt({
          runId,
          status: "blocked",
          task: request.task,
          events,
          selectedModelId: plan.selectedModelId,
          reasonCodes: reasons,
          inputTokens: 0,
          outputTokens: 0,
          startedAt,
          endedAt,
        }),
      };
    }

    const plan = await this.plan(request.route);
    if (plan.selectedModelId === null) {
      const reasons = [...new Set(plan.decisionCodes)].sort(compareCodeUnits);
      addEvent({ type: "run.blocked", reasonCodes: reasons });
      const endedAt = this.clock();
      return {
        plan,
        events,
        receipt: createRunReceipt({
          runId,
          status: "blocked",
          task: request.task,
          events,
          selectedModelId: null,
          reasonCodes: reasons,
          inputTokens: 0,
          outputTokens: 0,
          startedAt,
          endedAt,
        }),
      };
    }

    const modelId = plan.selectedModelId;
    const adapter = this.adaptersByModel.get(modelId);
    if (!adapter) throw new Error(`Selected model has no adapter: ${modelId}`);
    addEvent({ type: "route.selected", modelId, decisionCodes: plan.decisionCodes });

    let output = "";
    let inputTokens = 0;
    let outputTokens = 0;
    let status: RunStatus = "completed";
    const reasonCodes: string[] = ["fake_provider_verified", "read_only_policy_allowed"];

    try {
      for await (const providerEvent of adapter.run({
        runId,
        task: request.task,
        phase: request.route.phase,
        risk: "read",
      })) {
        if (providerEvent.type === "delta") {
          output += providerEvent.text;
          addEvent({
            type: "provider.chunk",
            modelId,
            byteLength: Buffer.byteLength(providerEvent.text, "utf8"),
          });
        } else {
          inputTokens = providerEvent.inputTokens;
          outputTokens = providerEvent.outputTokens;
        }
      }
      addEvent({ type: "run.completed", modelId });
    } catch {
      status = "failed";
      reasonCodes.push("provider_execution_failed");
      addEvent({ type: "run.failed", reasonCode: "provider_execution_failed" });
    }

    const endedAt = this.clock();
    return {
      ...(status === "completed" ? { output } : {}),
      plan,
      events,
      receipt: createRunReceipt({
        runId,
        status,
        task: request.task,
        ...(status === "completed" ? { output } : {}),
        events,
        selectedModelId: modelId,
        reasonCodes,
        inputTokens,
        outputTokens,
        startedAt,
        endedAt,
      }),
    };
  }
}
