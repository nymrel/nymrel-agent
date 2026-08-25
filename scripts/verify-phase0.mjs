import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const receipt = JSON.parse(readFileSync(path.join(root, "evidence", "phase0-receipt.json"), "utf8"));

function walkFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if ([".git", "dist", "node_modules"].includes(entry.name)) return [];
    const absolutePath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(absolutePath) : [absolutePath];
  });
}

function parseIsoDate(value) {
  assert.match(value, /^\d{4}-\d{2}-\d{2}$/, "date must use YYYY-MM-DD");
  const parsed = new Date(`${value}T00:00:00.000Z`);
  assert.equal(Number.isNaN(parsed.valueOf()), false, "date must be valid");
  assert.equal(parsed.toISOString().slice(0, 10), value, "date must round-trip exactly");
  return value;
}

assert.equal(packageJson.private, true, "package must remain private");
for (const key of [
  "publishConfig",
  "bin",
  "files",
  "dependencies",
  "optionalDependencies",
  "peerDependencies",
  "bundledDependencies",
  "bundleDependencies",
]) {
  assert.equal(packageJson[key], undefined, `package must not define ${key}`);
}
const lifecycleHooks = [
  "prepublish",
  "prepublishOnly",
  "prepare",
  "publish",
  "postpublish",
  "prepack",
  "postpack",
  "preinstall",
  "install",
  "postinstall",
];
for (const hook of lifecycleHooks) {
  assert.equal(Object.hasOwn(packageJson.scripts ?? {}, hook), false, `package script ${hook} is forbidden`);
}

const remotes = execFileSync("git", ["remote"], { cwd: root, encoding: "utf8" }).trim();
assert.equal(remotes, "", "phase-0 root must have zero git remotes");
const worktreeStatus = execFileSync(
  "git",
  ["status", "--porcelain", "--untracked-files=all"],
  { cwd: root, encoding: "utf8" },
).trim();
assert.equal(worktreeStatus, "", "phase-0 verification requires a clean worktree");

const candidateFiles = walkFiles(root);
const forbiddenPaths = candidateFiles
  .filter((entry) => /^\.env(?:\.|$)/i.test(path.basename(entry)))
  .map((entry) => path.relative(root, entry));
assert.deepEqual(forbiddenPaths, [], "phase-0 root must contain no environment files");

const forbiddenImport = /node:(?:http|https|http2|net|tls|dgram|dns|child_process|worker_threads)/;
const forbiddenCapability = /\b(?:fetch\s*\(|WebSocket\b|EventSource\b|process\.env\b)/;
for (const sourcePath of candidateFiles.filter((entry) => entry.endsWith(".ts") && entry.includes(`${path.sep}src${path.sep}`))) {
  const source = readFileSync(sourcePath, "utf8");
  assert.doesNotMatch(source, forbiddenImport, `network/process import forbidden: ${sourcePath}`);
  assert.doesNotMatch(source, forbiddenCapability, `network/environment capability forbidden: ${sourcePath}`);
}

assert.equal(receipt.status, "candidate_review_required");
assert.equal(receipt.scope, "read_only_fake_provider");
assert.deepEqual(receipt.claims, {
  realProviderCalls: 0,
  credentialsUsed: 0,
  gitRemotes: 0,
  runtimeDependencies: 0,
  publicationAuthorized: false,
  adoptionAuthorized: false,
});
assert.equal(receipt.validation.status, "pass");
assert.match(receipt.validation.validatedAtUtc, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/);
assert.equal(receipt.validation.tests.passed, 21);
assert.equal(receipt.validation.tests.failed, 0);
assert.ok(
  Object.values(receipt.validation.checks).every((value) => value === "pass"),
  "every recorded validation check must pass",
);
for (const command of [
  "npm test",
  "npm run typecheck",
  "npm run build",
  "npm run verify:phase0",
  "npm run smoke",
  "git diff --check",
]) {
  assert.ok(receipt.validation.commands.includes(command), `receipt must record ${command}`);
}
const packageLockSha256 = createHash("sha256")
  .update(readFileSync(path.join(root, "package-lock.json")))
  .digest("hex");
assert.equal(receipt.validation.packageLockSha256, packageLockSha256, "lockfile digest mismatch");
assert.equal(receipt.sunset.defaultOutcome, "archive");
parseIsoDate(receipt.sunset.decisionDue);
assert.deepEqual(receipt.sunset.allowedOutcomes, ["absorb", "promote", "archive"]);
const todayUtc = new Date().toISOString().slice(0, 10);
if (receipt.status === "candidate_review_required") {
  assert.ok(todayUtc <= receipt.sunset.decisionDue, "sunset expired: archive or record a fresh decision");
}

assert.equal(receipt.sourceBinding.status, "bound", "source receipt must be bound before verification");
assert.match(receipt.sourceBinding.sourceCommitSha, /^[a-f0-9]{40}$/);
assert.match(receipt.sourceBinding.sourceTreeSha, /^[a-f0-9]{40}$/);
const sourceCommit = execFileSync(
  "git",
  ["rev-parse", "--verify", `${receipt.sourceBinding.sourceCommitSha}^{commit}`],
  { cwd: root, encoding: "utf8" },
).trim();
assert.equal(sourceCommit, receipt.sourceBinding.sourceCommitSha, "source commit must resolve exactly");
const sourceTree = execFileSync(
  "git",
  ["rev-parse", `${receipt.sourceBinding.sourceCommitSha}^{tree}`],
  { cwd: root, encoding: "utf8" },
).trim();
assert.equal(sourceTree, receipt.sourceBinding.sourceTreeSha, "source tree must resolve exactly");
const parentCommit = execFileSync("git", ["rev-parse", "HEAD^"], {
  cwd: root,
  encoding: "utf8",
}).trim();
assert.equal(parentCommit, sourceCommit, "attestation commit must directly follow source commit");
const attestationDiff = execFileSync(
  "git",
  ["diff", "--name-only", `${sourceCommit}..HEAD`],
  { cwd: root, encoding: "utf8" },
)
  .trim()
  .split(/\r?\n/)
  .filter(Boolean);
assert.deepEqual(
  attestationDiff,
  ["evidence/phase0-receipt.json"],
  "attestation commit may change only the phase-0 receipt",
);

process.stdout.write(
  `${JSON.stringify({
    status: "pass",
    privatePackage: true,
    runtimeDependencies: 0,
    gitRemotes: 0,
    environmentFiles: 0,
    packageLockSha256,
    sourceCommit,
    sourceTree,
    sunset: receipt.sunset,
  }, null, 2)}\n`,
);
