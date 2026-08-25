import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

const cli = path.join(process.cwd(), "dist", "src", "cli.js");

function runCli(args: readonly string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { PATH: process.env.PATH },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

test("model doctor reports only fake adapters", () => {
  const result = runCli(["models", "doctor"]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout) as { checks: Array<{ providerId: string }> };
  assert.ok(report.checks.length > 0);
  assert.ok(report.checks.every((check) => check.providerId.startsWith("fake-")));
});

test("route explain selects the synthetic local model for local-only data", () => {
  const result = runCli(["route", "--local-only"]);
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout) as { selectedModelId: string };
  assert.equal(plan.selectedModelId, "fake.local.text");
});

test("read-only CLI smoke returns a truthful completion receipt", () => {
  const result = runCli(["run", "--task", "offline smoke"]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout) as { receipt: { status: string; reasonCodes: string[] } };
  assert.equal(payload.receipt.status, "completed");
  assert.ok(payload.receipt.reasonCodes.includes("fake_provider_only"));
});
