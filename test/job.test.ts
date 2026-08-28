import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseJobManifest, planJob } from "../src/job.js";
import { createJobPlanReceipt } from "../src/receipt.js";

function fixture(): Record<string, unknown> {
  return JSON.parse(readFileSync("examples/job-48h-game-builder.json", "utf8")) as Record<string, unknown>;
}

test("Job Mode plans the five-step fixture without executing providers", () => {
  const manifest = parseJobManifest(fixture());
  const plan = planJob(manifest);
  assert.equal(plan.profile, "plan-only");
  assert.equal(plan.status, "ready_with_handoffs");
  assert.equal(plan.executionStatus, "not_started");
  assert.equal(plan.steps.length, 5);
  assert.equal(plan.summary.externalHandoffRequiredSteps, 2);
  assert.equal(plan.summary.localReadOnlyEligibleSteps, 3);
  assert.ok(plan.summary.selectionsByModel.length >= 2);
  assert.equal(plan.steps[0]?.executionDisposition, "local_read_only_eligible");
  assert.equal(plan.steps[2]?.executionDisposition, "external_handoff_required");
  assert.ok(plan.steps.every((step) => step.reasonCodes.includes("local_plan_only")));

  const receipt = createJobPlanReceipt(manifest, plan, "2026-08-28T20:00:00.000Z");
  const serializedReceipt = JSON.stringify(receipt);
  assert.equal(receipt.status, "planned");
  assert.equal(receipt.steps.length, 5);
  assert.ok(!serializedReceipt.includes(manifest.jobId));
  assert.ok(!serializedReceipt.includes(manifest.steps[0]?.stepId ?? "research-scope"));
});

test("Job Mode rejects prompt-bearing, unknown, and forward-dependent manifests", () => {
  const promptBearing = fixture();
  promptBearing.prompt = "do not accept task bodies";
  assert.throws(() => parseJobManifest(promptBearing), /job manifest is invalid/);

  const forward = fixture();
  const steps = forward.steps as Array<Record<string, unknown>>;
  steps[0] = { ...steps[0], dependsOn: ["plan-slice"] };
  assert.throws(() => parseJobManifest(forward), /job manifest is invalid/);

  const unknownStep = fixture();
  const unknownSteps = unknownStep.steps as Array<Record<string, unknown>>;
  unknownSteps[0] = { ...unknownSteps[0], task: "do not accept task bodies" };
  assert.throws(() => parseJobManifest(unknownStep), /job manifest is invalid/);
});

test("Job Mode blocks a plan when a step has no eligible model", () => {
  const value = fixture();
  const steps = value.steps as Array<Record<string, unknown>>;
  const first = steps[0] as Record<string, unknown>;
  const request = first.request as Record<string, unknown>;
  steps[0] = { ...first, request: { ...request, constraints: { dataBoundary: "zero_retention_provider" }, normalization: request.normalization } };
  const manifest = parseJobManifest(value);
  const plan = planJob(manifest);
  assert.equal(plan.status, "blocked");
  assert.equal(plan.summary.blockedSteps, 1);
  assert.equal(createJobPlanReceipt(manifest, plan).status, "blocked");
});

test("Job Mode rejects duplicate IDs, self-dependencies, and more than 32 steps", () => {
  const duplicate = fixture();
  const duplicateSteps = duplicate.steps as Array<Record<string, unknown>>;
  duplicateSteps[1] = { ...duplicateSteps[1], stepId: duplicateSteps[0]?.stepId };
  assert.throws(() => parseJobManifest(duplicate), /job manifest is invalid/);

  const self = fixture();
  const selfSteps = self.steps as Array<Record<string, unknown>>;
  selfSteps[0] = { ...selfSteps[0], dependsOn: [selfSteps[0]?.stepId] };
  assert.throws(() => parseJobManifest(self), /job manifest is invalid/);

  const tooMany = fixture();
  const template = (tooMany.steps as Array<Record<string, unknown>>)[0] as Record<string, unknown>;
  tooMany.steps = Array.from({ length: 33 }, (_, index) => ({ ...template, stepId: `step-${index}`, dependsOn: index === 0 ? [] : [`step-${index - 1}`] }));
  assert.throws(() => parseJobManifest(tooMany), /job manifest is invalid/);
});
