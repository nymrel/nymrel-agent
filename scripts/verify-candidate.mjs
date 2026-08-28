import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseJobManifest, planJob } from "../dist/src/job.js";
import { formatJobPlanSummary } from "../dist/src/cli.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(path.join(root, relative), "utf8");
const packageJson = JSON.parse(read("package.json"));
const packageLock = JSON.parse(read("package-lock.json"));

assert.equal(packageJson.version, "0.4.0");
assert.equal(packageLock.version, packageJson.version);
assert.equal(packageLock.packages?.[""]?.version, packageJson.version);
assert.ok(packageJson.files.includes("docs/JOB_MODE.md"));
const ignored = read(".vercelignore").split(/\r?\n/);
for (const localOnly of ["src/job.ts", "src/lifecycle.ts", "src/mcp.ts", "src/receipt.ts"]) assert.ok(ignored.includes(localOnly), `${localOnly} must remain outside the Vercel source bundle`);
const worker = read("src/worker.ts");
for (const forbidden of ["./job", "./lifecycle", "./mcp", "./receipt", "plan_job", "lifecycle"]) assert.equal(worker.includes(forbidden), false, `hosted Worker must not include ${forbidden}`);
const manifest = parseJobManifest(JSON.parse(read("examples/job-48h-game-builder.json")));
const plan = planJob(manifest);
assert.equal(plan.status, "ready_with_handoffs");
assert.equal(read("examples/job-48h-game-builder.json"), read("public/examples/job-48h-game-builder.json"), "source and public Job Mode manifests drifted");
const publicSummary = read("public/examples/job-48h-game-builder-summary.txt");
assert.ok(publicSummary.split(/\r?\n/).filter(Boolean).length <= 40, "public Job Mode summary must remain concise");
assert.equal(publicSummary, formatJobPlanSummary(manifest), "public Job Mode summary must match the canonical local planner");
for (const relative of ["examples/lifecycle-checkpoint.example.json", "examples/lifecycle-terminal.example.json"]) {
  const value = JSON.parse(read(relative));
  assert.equal(Object.keys(value).some((key) => ["prompt", "task", "output", "context", "path", "url"].includes(key)), false, `${relative} must remain body-free`);
}
for (const relative of ["README.md", "docs/JOB_MODE.md", "public/index.html", "public/docs.html", "public/llms.txt"]) {
  const source = read(relative);
  assert.match(source, /local/i, `${relative} must state the local boundary`);
  assert.match(source, /no hosted endpoint|hosted API remains metadata-only|metadata-only|There is no hosted|does not execute model calls|do not execute, schedule, or persist/i, `${relative} must not imply hosted lifecycle execution`);
}
process.stdout.write("candidate-verification: pass (local lifecycle boundary, package, fixtures, proof, and hosted exclusion)\n");
