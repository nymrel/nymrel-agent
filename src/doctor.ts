import {
  CONTRACT_VERSION,
  type DoctorReport,
  type ProviderAdapter,
  type ProviderHealth,
} from "./contracts.js";

export async function doctorProviders(
  adapters: readonly ProviderAdapter[],
  checkedAt: string,
): Promise<DoctorReport> {
  const checks: ProviderHealth[] = [];
  for (const adapter of [...adapters].sort((a, b) => a.profile.modelId.localeCompare(b.profile.modelId))) {
    try {
      checks.push(await adapter.probe(checkedAt));
    } catch {
      checks.push({
        modelId: adapter.profile.modelId,
        providerId: adapter.profile.providerId,
        state: "unavailable",
        code: "probe_failed",
        checkedAt,
      });
    }
  }
  return {
    contractVersion: CONTRACT_VERSION,
    overall: checks.some((check) => check.state !== "unavailable") ? "ready" : "not_ready",
    checks,
  };
}
