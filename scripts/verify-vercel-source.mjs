import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedFiles = [
  ".vercelignore",
  "homepage.json",
  "package-lock.json",
  "package.json",
  "public/404.html",
  "public/docs.html",
  "public/examples/route-request.json",
  "public/favicon.svg",
  "public/index.html",
  "public/llms.txt",
  "public/openapi.json",
  "public/robots.txt",
  "public/styles.css",
  "scripts/clean.mjs",
  "server.ts",
  "src/contracts.ts",
  "src/defaults.ts",
  "src/errors.ts",
  "src/ordering.ts",
  "src/router.ts",
  "src/url-security.ts",
  "src/validation.ts",
  "src/worker.ts",
  "tsconfig.json",
  "vercel.json",
].sort();

let input = "";
for await (const chunk of process.stdin) {
  input += chunk;
  assert.ok(input.length <= 2 * 1024 * 1024, "Vercel file inventory exceeds 2 MiB");
}
assert.ok(input.trim(), "expected the Vercel deployment file inventory on stdin");

const inventory = JSON.parse(input);
assert.ok(Array.isArray(inventory), "Vercel file inventory must be an array");
const sourceRoot = inventory.find((entry) => entry?.name === "src" && entry?.type === "directory");
assert.ok(sourceRoot, "Vercel file inventory is missing the source root");

const deployedFiles = new Map();
function visit(node, parent = "") {
  assert.ok(node && typeof node === "object", "invalid Vercel inventory node");
  assert.match(node.name, /^[A-Za-z0-9._-]+$/, "invalid Vercel inventory path segment");
  const relative = parent ? `${parent}/${node.name}` : node.name;
  if (node.type === "directory") {
    for (const child of node.children ?? []) visit(child, relative);
    return;
  }
  if (node.type !== "file") return;
  assert.match(node.uid, /^[0-9a-f]{40}$/, `invalid Vercel content digest for ${relative}`);
  assert.equal(deployedFiles.has(relative), false, `duplicate Vercel source file: ${relative}`);
  deployedFiles.set(relative, node.uid);
}
for (const child of sourceRoot.children ?? []) visit(child);

assert.deepEqual([...deployedFiles.keys()].sort(), expectedFiles, "Vercel source file allowlist drifted");
for (const relative of expectedFiles) {
  const digest = createHash("sha1").update(readFileSync(path.join(root, ...relative.split("/")))).digest("hex");
  assert.equal(deployedFiles.get(relative), digest, `Vercel source bytes differ for ${relative}`);
}

process.stdout.write(`vercel-source-verification: pass (${expectedFiles.length} exact files)\n`);
