import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { VERCEL_SOURCE_FILES } from "./release-public-registry.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedFiles = VERCEL_SOURCE_FILES;

let input = "";
for await (const chunk of process.stdin) {
  input += chunk;
  assert.ok(input.length <= 2 * 1024 * 1024, "Vercel file inventory exceeds 2 MiB");
}
assert.ok(input.trim(), "expected the Vercel deployment file inventory on stdin");

const inventory = JSON.parse(input);
assert.ok(Array.isArray(inventory), "Vercel file inventory must be an array");
assert.deepEqual(
  inventory.map((entry) => ({ name: entry?.name, type: entry?.type })).sort((a, b) => String(a.name).localeCompare(String(b.name))),
  [{ name: "out", type: "directory" }, { name: "src", type: "directory" }],
  "Vercel file inventory must contain exactly one source root and one build-output root",
);
const sourceRoot = inventory.find((entry) => entry.name === "src");

const deployedFiles = new Map();
function visit(node, parent = "") {
  assert.ok(node && typeof node === "object", "invalid Vercel inventory node");
  assert.match(node.name, /^[A-Za-z0-9._-]+$/, "invalid Vercel inventory path segment");
  const relative = parent ? `${parent}/${node.name}` : node.name;
  assert.ok(node.type === "directory" || node.type === "file", `unsupported Vercel source node type at ${relative}`);
  if (node.type === "directory") {
    for (const child of node.children ?? []) visit(child, relative);
    return;
  }
  assert.equal(node.children, undefined, `Vercel source file cannot contain children: ${relative}`);
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
