import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? sourceFiles(fullPath) : entry.name.endsWith(".ts") ? [fullPath] : [];
  });
}

function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

test("package is private, non-publishable, and has zero runtime dependencies", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as Record<string, unknown>;
  assert.equal(packageJson.private, true);
  assert.equal(packageJson.publishConfig, undefined);
  assert.equal(packageJson.bin, undefined);
  assert.equal(packageJson.files, undefined);
  assert.deepEqual(packageJson.dependencies ?? {}, {});
  const scripts = (packageJson.scripts ?? {}) as Record<string, unknown>;
  for (const hook of [
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
  ]) {
    assert.equal(Object.hasOwn(scripts, hook), false, hook);
  }
  for (const key of [
    "optionalDependencies",
    "peerDependencies",
    "bundledDependencies",
    "bundleDependencies",
  ]) {
    assert.equal(packageJson[key], undefined, key);
  }
});

test("runtime source imports no network or process execution modules", () => {
  const forbiddenImport = /node:(?:http|https|http2|net|tls|dgram|dns|child_process|worker_threads)/;
  const fetchName = ["fet", "ch"].join("");
  const webSocketName = ["Web", "Socket"].join("");
  const eventSourceName = ["Event", "Source"].join("");
  const environmentName = ["process", "env"].join(".");
  const forbiddenCapability = new RegExp(
    `\\b(?:${fetchName}\\s*\\(|${webSocketName}\\b|${eventSourceName}\\b|${environmentName}\\b)`,
  );
  for (const file of sourceFiles(path.join(process.cwd(), "src"))) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, forbiddenImport, file);
    assert.doesNotMatch(source, forbiddenCapability, file);
  }
});

test("candidate source contains no private control-plane identifiers", () => {
  const forbidden = [
    "studio-model-router",
    "studio-comm",
    "council-decisions",
    "portfolio-control",
    "quota-sharing",
    "surface_ids",
  ];
  const combined = sourceFiles(path.join(process.cwd(), "src"))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n")
    .toLowerCase();
  for (const marker of forbidden) assert.equal(combined.includes(marker), false, marker);
});

test("sunset deadline has not expired while the candidate remains pending", () => {
  const receipt = JSON.parse(readFileSync("evidence/phase0-receipt.json", "utf8")) as {
    status: string;
    sunset: { decisionDue: string };
  };
  assert.equal(validIsoDate(receipt.sunset.decisionDue), true);
  if (receipt.status === "candidate_review_required") {
    assert.ok(new Date().toISOString().slice(0, 10) <= receipt.sunset.decisionDue);
  }
});
