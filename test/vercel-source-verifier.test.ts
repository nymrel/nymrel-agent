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
const sourceFiles = [
  ".vercelignore",
  "homepage.json",
  "package-lock.json",
  "package.json",
  "public/0e2a8eae9dfa779ba2f3282c3c6e3d2d.txt",
  "public/404.html",
  "public/demo.js",
  "public/docs.html",
  "public/downloads/nymrel-agent-0.1.0.tgz",
  "public/downloads/nymrel-agent-v0.1.0-source.tar.gz",
  "public/downloads/v0.1.0.json",
  "public/downloads/nymrel-agent-0.1.1.tgz",
  "public/downloads/nymrel-agent-v0.1.1-source.tar.gz",
  "public/downloads/v0.1.1.json",
  "public/examples/route-request.json",
  "public/favicon.svg",
  "public/index.html",
  "public/llms.txt",
  "public/openapi.json",
  "public/og-image.png",
  "public/og-image.svg",
  "public/robots.txt",
  "public/sitemap.xml",
  "public/styles.css",
  "scripts/clean.mjs",
  "server.ts",
  "src/contracts.ts",
  "src/errors.ts",
  "src/ordering.ts",
  "src/router.ts",
  "src/validation.ts",
  "src/worker.ts",
  "tsconfig.json",
  "vercel.json",
];

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
  assert.match(result.stdout, /pass \(34 exact files\)/);
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
