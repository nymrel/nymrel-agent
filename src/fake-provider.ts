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

const authenticFakeProviders = new WeakSet<object>();

function freezeProfile(profile: ModelProfile): ModelProfile {
  const capabilities = Object.freeze({
    ...profile.capabilities,
    modalities: Object.freeze([...profile.capabilities.modalities]),
  });
  return Object.freeze({
    ...profile,
    dataBoundaries: Object.freeze([...profile.dataBoundaries]),
    capabilities,
  });
}

export class FakeProvider implements ProviderAdapter {
  readonly #behavior: Readonly<FakeProviderBehavior>;
  #probeCount = 0;
  #runCount = 0;
  public readonly profile: ModelProfile;

  public constructor(
    profile: ModelProfile,
    behavior: FakeProviderBehavior = {},
  ) {
    this.profile = freezeProfile(profile);
    this.#behavior = Object.freeze({ ...behavior });
    authenticFakeProviders.add(this);
    Object.freeze(this);
  }

  public get executionKind(): "synthetic" {
    return "synthetic";
  }

  public get probeCount(): number {
    return this.#probeCount;
  }

  public get runCount(): number {
    return this.#runCount;
  }

  public async probe(checkedAt: string): Promise<ProviderHealth> {
    this.#probeCount += 1;
    if (this.#behavior.failProbe) throw new Error("Synthetic probe failure");
    return {
      modelId: this.profile.modelId,
      providerId: this.profile.providerId,
      state: this.profile.health,
      code: this.profile.health === "healthy" ? "fake_ready" : `fake_${this.profile.health}`,
      checkedAt,
    };
  }

  public async *run(input: ProviderRunInput): AsyncIterable<ProviderRunEvent> {
    this.#runCount += 1;
    if (this.#behavior.failRun) throw new Error("Synthetic execution failure");
    const response = this.#behavior.response ?? `Fake provider completed read-only task ${input.runId}.`;
    const chunkSize = Math.max(1, this.#behavior.chunkSize ?? 12);
    for (let index = 0; index < response.length; index += chunkSize) {
      yield { type: "delta", text: response.slice(index, index + chunkSize) };
    }
    yield {
      type: "usage",
      inputTokens: this.#behavior.inputTokens ?? Math.ceil(input.task.length / 4),
      outputTokens: this.#behavior.outputTokens ?? Math.ceil(response.length / 4),
    };
  }
}

Object.freeze(FakeProvider.prototype);

export function isExactFakeProvider(value: unknown): value is FakeProvider {
  return (
    typeof value === "object" &&
    value !== null &&
    authenticFakeProviders.has(value) &&
    Object.getPrototypeOf(value) === FakeProvider.prototype &&
    Object.isFrozen(value) &&
    !Object.hasOwn(value, "probe") &&
    !Object.hasOwn(value, "run") &&
    !Object.hasOwn(value, "executionKind")
  );
}
