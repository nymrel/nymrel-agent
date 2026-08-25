import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(path.join(root, relative), "utf8");
const json = (relative) => JSON.parse(read(relative));
const required = [
  "README.md", "LICENSE", "SECURITY.md", "CHANGELOG.md", "CONTRIBUTING.md", "AGENTS.md",
  "authz-allowlist.json", "wrangler.jsonc", "vercel.json", ".vercelignore", "server.ts", "homepage.json", "tsconfig.package.json", "public/index.html", "public/docs.html",
  "public/openapi.json", "public/llms.txt", "examples/route-request.json",
  "examples/openai-local-config.example.json", "docs/PRODUCTION_LAUNCH_PACKET.md",
  "docs/PRODUCT_SERVICE_CONTRACT.md", "docs/ARCHITECTURE.md",
  "src/bin/nymrel-agent.ts", "src/bin/nymrel-agent-mcp.ts", "scripts/verify-packed-install.mjs",
  "src/url-security.ts",
  ".github/workflows/ci.yml",
];
for (const relative of required) assert.ok(existsSync(path.join(root, relative)), `missing release file: ${relative}`);

const packageJson = json("package.json");
const packageLock = json("package-lock.json");
assert.equal(packageJson.name, "@nymrel/agent");
assert.match(packageJson.version, /^\d+\.\d+\.\d+$/);
assert.notEqual(packageJson.private, true);
assert.equal(packageJson.license, "MIT");
assert.equal(packageJson.publishConfig?.access, "public");
assert.equal(packageJson.publishConfig?.provenance, true);
assert.equal(packageJson.engines?.node, ">=22 <25");
assert.equal(packageJson.bin?.["nymrel-agent"], "dist/src/bin/nymrel-agent.js");
assert.equal(packageJson.bin?.["nymrel-agent-mcp"], "dist/src/bin/nymrel-agent-mcp.js");
assert.equal(packageJson.scripts?.build, undefined, "Vercel Hono detection requires no package build script");
assert.equal(packageJson.scripts?.compile, "npm run clean --silent && tsc -p tsconfig.package.json");
assert.equal(packageJson.scripts?.typecheck, "tsc -p tsconfig.json --noEmit && tsc -p tsconfig.package.json --noEmit");
assert.equal(packageLock.name, packageJson.name);
assert.equal(packageLock.version, packageJson.version);
assert.equal(packageLock.packages?.[""]?.version, packageJson.version);
assert.equal(packageJson.dependencies?.["@modelcontextprotocol/server"], "2.0.0");
assert.equal(packageJson.dependencies?.["@vercel/firewall"], "1.2.5");
assert.equal(packageJson.dependencies?.hono, "4.13.4");
assert.equal(packageJson.dependencies?.zod, "4.4.3");

const contracts = read("src/contracts.ts");
assert.ok(contracts.includes(`PRODUCT_VERSION = "${packageJson.version}"`), "source product version must match package version");
assert.ok(contracts.includes('CONTRACT_VERSION = "nymrel.agent.route/v1"'), "stable route contract is missing");

assert.equal(read("examples/route-request.json"), read("public/examples/route-request.json"), "source and hosted examples drifted");
const routeExample = json("examples/route-request.json");
assert.deepEqual(Object.keys(routeExample).sort(), ["models", "request"]);
assert.equal(Object.hasOwn(routeExample, "prompt"), false);

const openapi = json("public/openapi.json");
assert.equal(openapi.openapi, "3.1.0");
assert.equal(openapi.info.version, packageJson.version);
assert.ok(openapi.paths?.["/v1/route"]?.post, "OpenAPI route operation is missing");
assert.ok(openapi.paths?.["/v1/route"]?.options, "OpenAPI preflight operation is missing");
assert.ok(openapi.paths?.["/v1"]?.get, "OpenAPI discovery operation is missing");
assert.ok(openapi.paths?.["/v1/openapi.json"]?.get, "OpenAPI document operation is missing");
assert.ok(openapi.paths?.["/readyz"]?.get?.responses?.["503"], "OpenAPI readiness 503 response is missing");
assert.equal(openapi.components?.schemas?.RoutePayload?.additionalProperties, false);
assert.equal(openapi.components?.schemas?.ModelProfile?.additionalProperties, false);
assert.equal(openapi.servers?.[0]?.url, packageJson.homepage);

const indexHtml = read("public/index.html");
assert.ok(indexHtml.includes(`<link rel="canonical" href="${packageJson.homepage}/">`));
const structuredData = indexHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
assert.ok(structuredData, "structured product data is missing");
const cspHash = `sha256-${createHash("sha256").update(structuredData).digest("base64")}`;

const workerModule = await import(`${pathToFileURL(path.join(root, "dist", "src", "worker.js")).href}?verify=${Date.now()}`);
const expectedRoutes = [...workerModule.PUBLIC_ROUTES, ...workerModule.STATIC_ASSET_POLICY]
  .map((entry) => `${entry.method} ${entry.path}`).sort();
const authz = json("authz-allowlist.json");
assert.equal(authz.defaultPolicy, "deny-unregistered-dynamic-route");
assert.deepEqual(authz.guardedRoutes, []);
assert.ok(authz.publicRoutes.every((entry) => typeof entry.reason === "string" && entry.reason.length >= 20));
assert.deepEqual(authz.publicRoutes.map((entry) => `${entry.method} ${entry.path}`).sort(), expectedRoutes, "public route register drifted from the Worker");

const worker = read("src/worker.ts");
for (const forbidden of ["./runtime", "./receipt", "./local-config", "./openai-responses-provider", "console."]) {
  assert.equal(worker.includes(forbidden), false, `public Worker must not include ${forbidden}`);
}
assert.ok(worker.includes("MAX_BODY_BYTES = 256 * 1024"));
assert.ok(worker.includes("parsePublicRoutePayload"));
assert.ok(worker.includes("ROUTE_RATE_LIMITER"));
assert.ok(worker.includes("PLATFORM_RATE_LIMITER"));
assert.ok(worker.includes("SOURCE_COMMIT"));
assert.equal(worker.includes("request.arrayBuffer()"), false, "public request size must be enforced before full buffering");
assert.ok(worker.includes(cspHash), "Worker CSP does not authorize the exact JSON-LD block");

const server = read("server.ts");
assert.ok(server.includes('APP_ENV: "production"'));
assert.ok(server.includes('RATE_LIMIT_SCOPE: "deployment"'));
assert.ok(server.includes('VERCEL_RATE_LIMIT_ID = "nymrel-agent-route-v1"'));
assert.ok(server.includes("@vercel/firewall"));
assert.equal(server.includes("new Map"), false, "Vercel limiter must not be instance-local");
assert.equal(server.includes("rateLimitKey"), false, "Vercel must let the platform derive trusted client identity");
assert.equal(server.includes("NYMREL_SOURCE_COMMIT"), false, "Vercel source identity must come from its provider-supplied system variable");
assert.equal(server.includes("process.env"), false, "Vercel source must typecheck without Node ambient globals");
assert.ok(server.includes("environment.VERCEL_GIT_COMMIT_SHA"));
assert.ok(server.includes("environment.ROUTING_API_ENABLED"));
for (const forbidden of ["./src/runtime", "./src/receipt", "./src/local-config", "./src/openai-responses-provider", "console."]) {
  assert.equal(server.includes(forbidden), false, `public Vercel adapter must not include ${forbidden}`);
}

const vercel = json("vercel.json");
assert.equal(vercel.framework, "hono");
assert.equal(vercel.buildCommand, undefined);
assert.equal(vercel.cleanUrls, false);
assert.deepEqual(vercel.redirects, [
  { source: "/index.html", destination: "/", permanent: true },
  { source: "/docs.html", destination: "/docs", permanent: true },
]);
assert.deepEqual(vercel.rewrites, [
  { source: "/docs", destination: "/docs.html" },
]);
assert.equal(json("homepage.json").html, read("public/index.html"), "Vercel homepage payload drifted from the canonical homepage");
assert.ok(vercel.headers?.some((entry) => entry.source === "/" && entry.headers?.some((header) => header.key === "Content-Security-Policy" && header.value.includes(cspHash))), "Vercel CSP does not authorize the exact JSON-LD block");
const vercelIgnore = read(".vercelignore");
for (const requiredIgnore of ["/dist/", "/.wrangler/", "/test/", "/evidence/", "src/bin/", "public/_headers"]) {
  assert.ok(vercelIgnore.split(/\r?\n/).includes(requiredIgnore), `Vercel source bundle must exclude ${requiredIgnore}`);
}
for (const localOnlySource of ["src/cli.ts", "src/local-config.ts", "src/mcp.ts", "src/openai-responses-provider.ts", "src/receipt.ts", "src/runtime.ts"]) {
  assert.ok(vercelIgnore.split(/\r?\n/).includes(localOnlySource), `Vercel source bundle must exclude ${localOnlySource}`);
}
const vercelTsconfig = json("tsconfig.json");
assert.equal(vercelTsconfig.compilerOptions?.types, undefined);
assert.equal(vercelTsconfig.compilerOptions?.noEmit, true);
const packageTsconfig = json("tsconfig.package.json");
assert.deepEqual(packageTsconfig.compilerOptions?.types, ["node"]);

const wrangler = json("wrangler.jsonc");
assert.equal(wrangler.workers_dev, true);
assert.equal(wrangler.assets?.directory, "./public");
assert.equal(wrangler.observability?.enabled, true);
assert.equal(wrangler.ratelimits?.[0]?.name, "ROUTE_RATE_LIMITER");
assert.equal(wrangler.ratelimits?.[0]?.simple?.limit, 120);
assert.equal(wrangler.ratelimits?.[0]?.simple?.period, 60);
assert.equal(wrangler.vars?.RATE_LIMIT_SCOPE, "edge_location");
assert.equal(wrangler.vars?.ROUTING_API_ENABLED, "true");
assert.equal(wrangler.routes, undefined, "custom DNS route requires a separate protected gate");

const ciWorkflow = read(".github/workflows/ci.yml");
assert.doesNotMatch(ciWorkflow, /uses:\s+\S+@v\d+/i, "CI actions must use immutable commit SHAs");
assert.ok(ciWorkflow.includes("persist-credentials: false"), "CI checkout must not persist its token");

const launchPacket = read("docs/PRODUCTION_LAUNCH_PACKET.md");
for (const requiredLaunchHold of [
  "Auto-assign Custom Production Domains",
  "offline fallback remains `Current`",
  "enabled deployment to remain `Staged`",
  "npx vercel promote <enabled-deployment-url>",
  "Do not use `--yes`, `Force Promote`",
]) {
  assert.ok(launchPacket.includes(requiredLaunchHold), `production launch packet is missing staged-promotion hold: ${requiredLaunchHold}`);
}

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if ([".git", ".wrangler", "dist", "node_modules"].includes(entry.name)) return [];
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? files(absolute) : [absolute];
  });
}
const environmentFiles = files(root).filter((file) => /^\.env(?:\.|$)/i.test(path.basename(file)));
assert.deepEqual(environmentFiles, [], "release tree contains an environment file");
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
];
const textExtensions = new Set([".css", ".html", ".js", ".json", ".jsonc", ".md", ".mjs", ".svg", ".ts", ".txt"]);
for (const file of files(root)) {
  if (!textExtensions.has(path.extname(file).toLowerCase())) continue;
  const source = readFileSync(file, "utf8");
  for (const pattern of secretPatterns) assert.doesNotMatch(source, pattern, `credential-like value in ${path.relative(root, file)}`);
}

const publicFiles = files(path.join(root, "public"));
assert.ok(publicFiles.length >= 10, "public launch surface is incomplete");
for (const file of publicFiles) {
  const relative = path.relative(path.join(root, "public"), file).replaceAll(path.sep, "/");
  assert.equal(relative.includes(".."), false);
}

process.stdout.write(`release-verification: pass (${expectedRoutes.length} public route classes, ${publicFiles.length} public files)\n`);
