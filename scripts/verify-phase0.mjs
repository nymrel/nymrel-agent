import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const receipt = JSON.parse(readFileSync(path.join(root, "evidence", "phase0-receipt.json"), "utf8"));

assert.equal(packageJson.private, true, "package must remain private");
for (const key of ["publishConfig", "prepublishOnly", "bin", "dependencies"]) {
  assert.equal(packageJson[key], undefined, `package must not define ${key}`);
}

const remotes = execFileSync("git", ["remote"], { cwd: root, encoding: "utf8" }).trim();
assert.equal(remotes, "", "phase-0 root must have zero git remotes");

const forbiddenPaths = readdirSync(root).filter((entry) => /^\.env(?:\.|$)/i.test(entry));
assert.deepEqual(forbiddenPaths, [], "phase-0 root must contain no environment files");

assert.equal(receipt.status, "candidate_review_required");
assert.equal(receipt.sunset.defaultOutcome, "archive");
assert.match(receipt.sunset.decisionDue, /^\d{4}-\d{2}-\d{2}$/);
assert.deepEqual(receipt.sunset.allowedOutcomes, ["absorb", "promote", "archive"]);

process.stdout.write(
  `${JSON.stringify({
    status: "pass",
    privatePackage: true,
    runtimeDependencies: 0,
    gitRemotes: 0,
    environmentFiles: 0,
    sunset: receipt.sunset,
  }, null, 2)}\n`,
);
