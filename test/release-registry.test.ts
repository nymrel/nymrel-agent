import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const registry = path.join(root, "scripts", "release-public-registry.mjs");

function invokeValidator(onboarding: string, launchPacket: string): { readonly context: boolean; readonly bundle: boolean } {
  const result = spawnSync(process.execPath, [
    "--input-type=module",
    "--eval",
    [
      `import { hasCanonicalVercelContextProbe, hasCanonicalVerifiedCliBundleBlock } from ${JSON.stringify(new URL(`file:///${registry.replaceAll("\\", "/")}`).href)};`,
      "let input = ''; for await (const chunk of process.stdin) input += chunk;",
      "const documents = JSON.parse(input);",
      "process.stdout.write(JSON.stringify({ context: hasCanonicalVercelContextProbe(documents.onboarding), bundle: hasCanonicalVerifiedCliBundleBlock(documents.onboarding) && hasCanonicalVerifiedCliBundleBlock(documents.launchPacket) }));",
    ].join("\n"),
  ], { cwd: root, input: JSON.stringify({ onboarding, launchPacket }), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout) as { readonly context: boolean; readonly bundle: boolean };
}

test("release documentation uses the exact registry-backed Vercel command blocks", () => {
  const onboarding = readFileSync(path.join(root, "docs", "ONBOARDING.md"), "utf8");
  const launchPacket = readFileSync(path.join(root, "docs", "PRODUCTION_LAUNCH_PACKET.md"), "utf8");
  assert.deepEqual(invokeValidator(onboarding, launchPacket), { context: true, bundle: true });
});

test("stray Vercel tokens cannot mask a corrupted verified CLI bundle command", () => {
  const onboarding = readFileSync(path.join(root, "docs", "ONBOARDING.md"), "utf8");
  const launchPacket = readFileSync(path.join(root, "docs", "PRODUCTION_LAUNCH_PACKET.md"), "utf8");
  const corrupted = onboarding.replace(
    "npx vercel deploy --prod --skip-domain --project nymrel-agent --env \"VERCEL_GIT_COMMIT_SHA=$carrier\" --meta \"githubCommitSha=$carrier\"",
    "npx vercel deploy --prod --skip-domain --project nymrel-agent --meta \"githubCommitSha=$carrier\"",
  ) + "\nStray token: VERCEL_GIT_COMMIT_SHA --env --project nymrel-agent --skip-domain\n";
  assert.deepEqual(invokeValidator(corrupted, launchPacket), { context: true, bundle: false });
});
