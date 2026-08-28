import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

type InventoryNode = {
  name: string;
  type: string;
  uid?: string;
  children?: InventoryNode[];
};

const root = process.cwd();
const verifier = path.join(root, "scripts", "verify-vercel-source.mjs");
const registryLoad = spawnSync(process.execPath, [
  "--input-type=module",
  "--eval",
  "import { VERCEL_SOURCE_FILES } from './scripts/release-public-registry.mjs'; process.stdout.write(JSON.stringify(VERCEL_SOURCE_FILES));",
], { cwd: root, encoding: "utf8" });
assert.equal(registryLoad.status, 0, registryLoad.stderr);
const sourceFiles = JSON.parse(registryLoad.stdout) as string[];
assert.ok(sourceFiles.includes("public/examples/route-request.json"), "registry must include the v1 public fixture");
assert.ok(sourceFiles.includes("public/examples/route-request-v2.json"), "registry must include the v2 public fixture");
assert.ok(sourceFiles.includes("scripts/release-public-registry.mjs"), "registry must include its own deployed source");
for (const artifact of [
  "public/downloads/nymrel-agent-0.2.0.tgz",
  "public/downloads/nymrel-agent-v0.2.0-source.tar.gz",
  "public/downloads/v0.2.0.json",
  "public/downloads/nymrel-agent-0.3.0.tgz",
  "public/downloads/nymrel-agent-v0.3.0-source.tar.gz",
  "public/downloads/v0.3.0.json",
]) {
  assert.ok(sourceFiles.includes(artifact), `registry must include reviewed release artifact: ${artifact}`);
}

function exactInventory(): InventoryNode[] {
  const sourceRoot: InventoryNode = { name: "src", type: "directory", children: [] };
  for (const relative of sourceFiles) {
    const parts = relative.split("/");
    const name = parts.pop()!;
    let directory = sourceRoot;
    for (const segment of parts) {
      let child = directory.children!.find((entry) => entry.name === segment);
      if (!child) {
        child = { name: segment, type: "directory", children: [] };
        directory.children!.push(child);
      }
      directory = child;
    }
    const bytes = readFileSync(path.join(root, ...relative.split("/")));
    directory.children!.push({ name, type: "file", uid: createHash("sha1").update(bytes).digest("hex") });
  }
  return [sourceRoot, { name: "out", type: "directory", children: [] }];
}

function verify(inventory: InventoryNode[]) {
  return spawnSync(process.execPath, [verifier], {
    cwd: root,
    input: JSON.stringify(inventory),
    encoding: "utf8",
  });
}

test("Vercel source verifier accepts only the exact file and byte allowlist", () => {
  const result = verify(exactInventory());
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /pass \(49 exact files\)/);
});

test("Vercel source verifier rejects every unsupported provider node type", () => {
  for (const type of ["symlink", "lambda", "middleware", "invalid"]) {
    const inventory = exactInventory();
    inventory[0]!.children!.push({ name: `unexpected-${type}`, type });
    const result = verify(inventory);
    assert.notEqual(result.status, 0, `${type} unexpectedly passed`);
    assert.match(result.stderr, /unsupported Vercel source node type/);
  }
});

test("Vercel source verifier rejects unexpected files and byte drift", () => {
  const extra = exactInventory();
  extra[0]!.children!.push({ name: "unexpected.txt", type: "file", uid: "0".repeat(40) });
  assert.notEqual(verify(extra).status, 0);

  const drifted = exactInventory();
  const packageNode = drifted[0]!.children!.find((entry) => entry.name === "package.json")!;
  packageNode.uid = "0".repeat(40);
  assert.notEqual(verify(drifted).status, 0);
});

test("Vercel source verifier rejects duplicate or unexpected inventory roots", () => {
  const duplicate = exactInventory();
  duplicate.push({ name: "src", type: "directory", children: [] });
  assert.notEqual(verify(duplicate).status, 0);

  const unexpected = exactInventory();
  unexpected.push({ name: "assets", type: "directory", children: [] });
  assert.notEqual(verify(unexpected).status, 0);
});
