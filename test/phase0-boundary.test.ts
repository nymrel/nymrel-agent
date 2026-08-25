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

test("package is private, non-publishable, and has zero runtime dependencies", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as Record<string, unknown>;
  assert.equal(packageJson.private, true);
  assert.equal(packageJson.publishConfig, undefined);
  assert.equal(packageJson.prepublishOnly, undefined);
  assert.equal(packageJson.bin, undefined);
  assert.deepEqual(packageJson.dependencies ?? {}, {});
});

test("runtime source imports no network or process execution modules", () => {
  const forbiddenImport = /node:(?:http|https|http2|net|tls|dgram|dns|child_process|worker_threads)/;
  const forbiddenCapability = /\b(?:fetch\s*\(|WebSocket\b|EventSource\b|process\.env\b)/;
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
