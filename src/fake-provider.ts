import type {
  ModelProfile,
  ProviderAdapter,
  ProviderHealth,
  ProviderRunEvent,
  ProviderRunInput,
} from "./contracts.js";

export interface FakeProviderBehavior {
  readonly response?: string;
  readonly chunkSize?: number;
  readonly failProbe?: boolean;
  readonly failRun?: boolean;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
}

export class FakeProvider implements ProviderAdapter {
  public readonly executionKind = "synthetic" as const;
  public probeCount = 0;
  public runCount = 0;

  public constructor(
    public readonly profile: ModelProfile,
    private readonly behavior: FakeProviderBehavior = {},
  ) {}

  public async probe(checkedAt: string): Promise<ProviderHealth> {
    this.probeCount += 1;
    if (this.behavior.failProbe) throw new Error("Synthetic probe failure");
    return {
      modelId: this.profile.modelId,
      providerId: this.profile.providerId,
      state: this.profile.health,
      code: this.profile.health === "healthy" ? "fake_ready" : `fake_${this.profile.health}`,
      checkedAt,
    };
  }

  public async *run(input: ProviderRunInput): AsyncIterable<ProviderRunEvent> {
    this.runCount += 1;
    if (this.behavior.failRun) throw new Error("Synthetic execution failure");
    const response = this.behavior.response ?? `Fake provider completed read-only task ${input.runId}.`;
    const chunkSize = Math.max(1, this.behavior.chunkSize ?? 12);
    for (let index = 0; index < response.length; index += chunkSize) {
      yield { type: "delta", text: response.slice(index, index + chunkSize) };
    }
    yield {
      type: "usage",
      inputTokens: this.behavior.inputTokens ?? Math.ceil(input.task.length / 4),
      outputTokens: this.behavior.outputTokens ?? Math.ceil(response.length / 4),
    };
  }
}
