import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

const packageJson = JSON.parse(read("package.json")) as {
  packageManager?: string;
  engines?: { node?: string };
  allowScripts?: Record<string, boolean>;
  devEngines?: {
    runtime?: { name?: string; version?: string; onFail?: string };
    packageManager?: { name?: string; version?: string; onFail?: string };
  };
};

function actionReferences(workflow: string): Array<{ action: string; reference: string }> {
  return [...workflow.matchAll(/uses:\s+([^@\s]+)@([^\s#]+)/g)].map((match) => ({
    action: match[1]!,
    reference: match[2]!,
  }));
}

test("contributor and CI runtimes share one reviewed toolchain contract", () => {
  assert.equal(read(".node-version").trim(), "24.20.0");
  assert.equal(packageJson.packageManager, "npm@11.19.1");
  assert.deepEqual(packageJson.devEngines?.runtime, {
    name: "node",
    version: ">=22 <25",
    onFail: "error",
  });
  assert.deepEqual(packageJson.devEngines?.packageManager, {
    name: "npm",
    version: "11.19.1",
    onFail: "error",
  });
});

test("CI verifies every supported Node boundary on pinned hosted runners", () => {
  const workflow = read(".github/workflows/ci.yml");
  assert.match(workflow, /os: \[ubuntu-24\.04, windows-2025\]/);
  assert.match(workflow, /node: \[22, 24\]/);
  assert.ok(workflow.includes("npm install --global npm@11.19.1"));
  assert.match(workflow, /Use the reviewed npm toolchain\s*\r?\n\s+working-directory: \$\{\{ runner\.temp \}\}/);
  assert.match(workflow, /run: npm ci\s*(?:\r?\n|$)/);
  assert.equal(workflow.includes("npm ci --ignore-scripts"), false);
  assert.ok(workflow.includes("npm run verify"));
  assert.ok(workflow.includes("npm run audit"));
  assert.equal(workflow.includes("npm run audit:prod"), false);
  assert.equal(/(?:ubuntu|windows)-latest/.test(workflow), false);
  assert.equal(/continue-on-error|\|\|\s*true/.test(workflow), false);
});

test("GitHub Actions execute only immutable reviewed action bytes", () => {
  const workflows = [read(".github/workflows/ci.yml"), read(".github/workflows/codeql.yml")];
  const references = workflows.flatMap(actionReferences);
  assert.equal(references.length, 5);
  for (const { action, reference } of references) {
    assert.match(reference, /^[0-9a-f]{40}$/, `${action} is not pinned to a full commit SHA`);
  }
  assert.deepEqual(new Set(references.map(({ action }) => action)), new Set([
    "actions/checkout",
    "actions/setup-node",
    "github/codeql-action/init",
    "github/codeql-action/analyze",
  ]));
});

test("CodeQL has the minimum write permission and a recurring extended scan", () => {
  const workflow = read(".github/workflows/codeql.yml");
  assert.ok(workflow.includes("security-events: write"));
  assert.ok(workflow.includes("languages: javascript-typescript"));
  assert.ok(workflow.includes("build-mode: none"));
  assert.ok(workflow.includes("queries: security-extended"));
  assert.match(workflow, /schedule:\s*\r?\n\s+- cron:/);
  assert.equal(/continue-on-error|\|\|\s*true/.test(workflow), false);
});

test("Dependabot covers npm and immutable workflow dependencies", () => {
  const configuration = read(".github/dependabot.yml");
  assert.ok(configuration.includes("package-ecosystem: npm"));
  assert.ok(configuration.includes("package-ecosystem: github-actions"));
  assert.equal((configuration.match(/interval: weekly/g) ?? []).length, 2);
});

test("packed-install acceptance never concatenates arguments through a command shell", () => {
  const verifier = read("scripts/verify-packed-install.mjs");
  assert.equal(/shell\s*:/.test(verifier), false);
  assert.ok(verifier.includes("process.env.npm_execpath"));
  assert.ok(verifier.includes("spawnSync(command, args"));
  assert.ok(verifier.includes("spawn(process.execPath, [entrypoint]"));
});

test("dependency lifecycle scripts are denied unless an exact locked version was reviewed", () => {
  assert.deepEqual(packageJson.allowScripts, {
    "esbuild@0.28.1": true,
    "workerd@1.20260828.1": true,
  });
  assert.deepEqual(read(".npmrc").trim().split(/\r?\n/), [
    "engine-strict=true",
    "strict-allow-scripts=true",
    "strict-peer-deps=true",
  ]);
});

test("developer and launch instructions use the same fail-closed local gate", () => {
  for (const relative of ["README.md", "CONTRIBUTING.md", "docs/ONBOARDING.md", "docs/PRODUCTION_LAUNCH_PACKET.md"]) {
    const document = read(relative);
    for (const command of ["corepack enable npm", "npm --version", "npm ci", "npm run verify", "npm run audit"]) {
      assert.ok(document.includes(command), `${relative} omits ${command}`);
    }
    assert.equal(document.includes("npm ci --ignore-scripts"), false, `${relative} bypasses the reviewed install-script policy`);
  }
  assert.equal(read("CONTRIBUTING.md").includes("read-only in v0.1"), false);
});
