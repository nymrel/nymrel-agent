import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(path.join(root, relative), "utf8");
const json = (relative) => JSON.parse(read(relative));
const required = [
  "README.md", "LICENSE", "SECURITY.md", "CHANGELOG.md", "CONTRIBUTING.md", "AGENTS.md", ".gitattributes",
  "authz-allowlist.json", "wrangler.jsonc", "vercel.json", ".vercelignore", "server.ts", "homepage.json", "tsconfig.package.json", "public/index.html", "public/docs.html", "public/demo.js", "public/sitemap.xml", "public/og-image.svg", "public/og-image.png", "public/0e2a8eae9dfa779ba2f3282c3c6e3d2d.txt",
  "public/downloads/nymrel-agent-0.1.0.tgz", "public/downloads/nymrel-agent-v0.1.0-source.tar.gz", "public/downloads/v0.1.0.json",
  "public/downloads/nymrel-agent-0.1.1.tgz", "public/downloads/nymrel-agent-v0.1.1-source.tar.gz", "public/downloads/v0.1.1.json",
  "public/downloads/nymrel-agent-0.1.2.tgz", "public/downloads/nymrel-agent-v0.1.2-source.tar.gz", "public/downloads/v0.1.2.json",
  "public/downloads/nymrel-agent-0.1.3.tgz", "public/downloads/nymrel-agent-v0.1.3-source.tar.gz", "public/downloads/v0.1.3.json",
  "public/downloads/nymrel-agent-0.2.0.tgz", "public/downloads/nymrel-agent-v0.2.0-source.tar.gz", "public/downloads/v0.2.0.json",
  "public/openapi.json", "public/llms.txt", "examples/route-request.json", "examples/route-request-v2.json", "public/examples/route-request-v2.json",
  "examples/openai-local-config.example.json", "docs/PRODUCTION_LAUNCH_PACKET.md", "docs/FIRST_USER_ACTIVATION.md",
  "docs/PRODUCT_SERVICE_CONTRACT.md", "docs/ARCHITECTURE.md",
  "src/bin/nymrel-agent.ts", "src/bin/nymrel-agent-mcp.ts", "scripts/verify-packed-install.mjs",
  "scripts/verify-vercel-source.mjs",
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
assert.equal(read("examples/route-request-v2.json"), read("public/examples/route-request-v2.json"), "source and hosted v2 examples drifted");
const routeExample = json("examples/route-request.json");
const routeExampleV2 = json("examples/route-request-v2.json");
assert.deepEqual(Object.keys(routeExample).sort(), ["models", "request"]);
assert.equal(Object.hasOwn(routeExample, "prompt"), false);
assert.deepEqual(Object.keys(routeExampleV2).sort(), ["models", "request"]);
assert.equal(routeExampleV2.request?.normalization?.basis, "request_budget");

const openapi = json("public/openapi.json");
assert.equal(openapi.openapi, "3.1.0");
assert.equal(openapi.info.version, packageJson.version);
assert.ok(openapi.paths?.["/v1/route"]?.post, "OpenAPI route operation is missing");
assert.ok(openapi.paths?.["/v1/route"]?.options, "OpenAPI preflight operation is missing");
assert.ok(openapi.paths?.["/v1"]?.get, "OpenAPI discovery operation is missing");
assert.ok(openapi.paths?.["/v1/openapi.json"]?.get, "OpenAPI document operation is missing");
assert.ok(openapi.paths?.["/v2/route"]?.post, "OpenAPI v2 route operation is missing");
assert.ok(openapi.paths?.["/v2/route"]?.options, "OpenAPI v2 preflight operation is missing");
assert.ok(openapi.paths?.["/v2"]?.get, "OpenAPI v2 discovery operation is missing");
assert.ok(openapi.paths?.["/v2/openapi.json"]?.get, "OpenAPI v2 document operation is missing");
assert.ok(openapi.paths?.["/readyz"]?.get?.responses?.["503"], "OpenAPI readiness 503 response is missing");
assert.equal(openapi.components?.schemas?.RoutePayload?.additionalProperties, false);
assert.equal(openapi.components?.schemas?.ModelProfile?.additionalProperties, false);
assert.equal(openapi.components?.schemas?.RoutePayloadV2?.additionalProperties, false);
assert.equal(openapi.servers?.[0]?.url, packageJson.homepage);

const releaseManifest = json("public/downloads/v0.2.0.json");
assert.equal(releaseManifest.schemaVersion, "nymrel.agent.release/v1");
assert.equal(releaseManifest.version, packageJson.version);
assert.equal(releaseManifest.releaseSourceCommit, "c5850361b19f72315b22bbe2794530d9415897ff");
assert.equal(releaseManifest.license, packageJson.license);
for (const [kind, filename] of [
  ["package", "nymrel-agent-0.2.0.tgz"],
  ["source", "nymrel-agent-v0.2.0-source.tar.gz"],
]) {
  const bytes = readFileSync(path.join(root, "public", "downloads", filename));
  assert.equal(releaseManifest[kind].bytes, bytes.length, `${kind} release byte count drifted`);
  assert.equal(releaseManifest[kind].sha256, createHash("sha256").update(bytes).digest("hex"), `${kind} release digest drifted`);
  assert.equal(releaseManifest[kind].url, `${packageJson.homepage}/downloads/${filename}`);
}

for (const historical of [
  {
    version: "0.1.3",
    sourceCommit: "02963d50f0a5bb9f080bfec783aa8436e17a400d",
    artifacts: {
      package: { filename: "nymrel-agent-0.1.3.tgz", bytes: 44032, sha256: "66145b09576323f667c7f76e36bb91bd09f8d251a089355c5e458a867d676385" },
      source: { filename: "nymrel-agent-v0.1.3-source.tar.gz", bytes: 159368, sha256: "55760fe1be6eeffac73de4bd734ea0dd434ec88b5a48a44669bb74a36471eb2c" },
    },
  },
  {
    version: "0.1.2",
    sourceCommit: "c960dc34523790a34497df3f2ac222d6f7a74894",
    artifacts: {
      package: { filename: "nymrel-agent-0.1.2.tgz", bytes: 42893, sha256: "9516c4815e0ca4daaa09cc34da7bb703e4caccf80d9e3101f065bf17a3cf513b" },
      source: { filename: "nymrel-agent-v0.1.2-source.tar.gz", bytes: 154534, sha256: "bf48100858819a53df17626f12a3c3d4ae666daec6c43186155ba3b24bffe175" },
    },
  },
  {
    version: "0.1.1",
    sourceCommit: "c3eb03691d986ea1cb98970a90c755ccdbc0d983",
    artifacts: {
      package: { filename: "nymrel-agent-0.1.1.tgz", bytes: 42701, sha256: "5f01a74f8a172e36b9b084abdaedd96da8f6709e6b32edf948e0f34557f6e39f" },
      source: { filename: "nymrel-agent-v0.1.1-source.tar.gz", bytes: 153423, sha256: "0e321667ac1d9ebbfdcba7e73eb97745b6f3f07c584c9588181efd959a993939" },
    },
  },
  {
    version: "0.1.0",
    sourceCommit: "ad8a6cc19994026de7323b074ffba8a282ee4046",
    artifacts: {
      package: { filename: "nymrel-agent-0.1.0.tgz", bytes: 42610, sha256: "41586801596b0f84d32fdf02049920bd6999f498b04d09ba21c3448981abe584" },
      source: { filename: "nymrel-agent-v0.1.0-source.tar.gz", bytes: 85552, sha256: "d7d2d99f61d2ad59ea65c048662cfc7f50b6d7663abe0bb916f682d546eb19e2" },
    },
  },
]) {
  const historicalReleaseManifest = json(`public/downloads/v${historical.version}.json`);
  assert.equal(historicalReleaseManifest.schemaVersion, "nymrel.agent.release/v1");
  assert.equal(historicalReleaseManifest.version, historical.version);
  assert.equal(historicalReleaseManifest.releaseSourceCommit, historical.sourceCommit);
  assert.equal(historicalReleaseManifest.license, packageJson.license);
  for (const [kind, artifact] of Object.entries(historical.artifacts)) {
    const bytes = readFileSync(path.join(root, "public", "downloads", artifact.filename));
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    assert.equal(bytes.length, artifact.bytes, `${kind} v${historical.version} immutable byte count drifted`);
    assert.equal(sha256, artifact.sha256, `${kind} v${historical.version} immutable digest drifted`);
    assert.equal(historicalReleaseManifest[kind].bytes, artifact.bytes, `${kind} v${historical.version} manifest byte count drifted`);
    assert.equal(historicalReleaseManifest[kind].sha256, artifact.sha256, `${kind} v${historical.version} manifest digest drifted`);
    assert.equal(historicalReleaseManifest[kind].url, `${packageJson.homepage}/downloads/${artifact.filename}`);
  }
}

assert.match(read(".gitattributes"), /^public\/downloads\/ export-ignore\r?$/m, "release archives must exclude hosted release artifacts");

const sourceArchive = path.join(root, "public", "downloads", "nymrel-agent-v0.2.0-source.tar.gz");
const archiveRoot = "nymrel-agent-0.2.0/";
const archiveNames = execFileSync("tar", ["-tzf", sourceArchive], { encoding: "utf8" }).trimEnd().split(/\r?\n/);
assert.ok(archiveNames.length > 1, "source archive is empty");
assert.equal(archiveNames[0], archiveRoot, "source archive must begin with one versioned root");
assert.equal(archiveNames.filter((name) => name === archiveRoot).length, 1, "source archive has a duplicate root");
assert.equal(new Set(archiveNames).size, archiveNames.length, "source archive has duplicate members");
for (const name of archiveNames) {
  assert.ok(name.startsWith(archiveRoot), `source archive member escaped its versioned root: ${name}`);
  assert.equal(name.startsWith("/"), false, `source archive contains an absolute path: ${name}`);
  assert.equal(name.includes("\\"), false, `source archive contains a backslash path: ${name}`);
  assert.equal(name.split("/").includes(".."), false, `source archive contains traversal: ${name}`);
}
const archiveDetails = execFileSync("tar", ["-tvzf", sourceArchive], { encoding: "utf8" }).trimEnd().split(/\r?\n/);
assert.equal(archiveDetails.length, archiveNames.length, "source archive detail listing drifted");
for (const detail of archiveDetails) {
  assert.match(detail, /^[d-]/, `source archive contains a link or special member: ${detail}`);
}

const indexHtml = read("public/index.html");
assert.ok(indexHtml.includes(`<link rel="canonical" href="${packageJson.homepage}/">`));
const docsHtml = read("public/docs.html");
const llmsText = read("public/llms.txt");
const demoScript = read("public/demo.js");
const sitemap = read("public/sitemap.xml");
const robots = read("public/robots.txt");
const indexNowKey = "0e2a8eae9dfa779ba2f3282c3c6e3d2d";
const socialImageUrl = `${packageJson.homepage}/og-image.png`;
for (const [document, canonical, title] of [
  [indexHtml, `${packageJson.homepage}/`, "Nymrel Agent"],
  [docsHtml, `${packageJson.homepage}/docs`, "Nymrel Agent documentation"],
]) {
  assert.ok(document.includes(`<meta property="og:title" content="${title}">`));
  assert.ok(document.includes(`<meta property="og:url" content="${canonical}">`));
  assert.ok(document.includes(`<meta property="og:image" content="${socialImageUrl}">`));
  assert.ok(document.includes('<meta property="og:image:width" content="1200">'));
  assert.ok(document.includes('<meta property="og:image:height" content="630">'));
  assert.ok(document.includes('<meta name="twitter:card" content="summary_large_image">'));
  assert.ok(document.includes(`<meta name="twitter:title" content="${title}">`));
  assert.ok(document.includes(`<meta name="twitter:image" content="${socialImageUrl}">`));
}
assert.equal(read(`public/${indexNowKey}.txt`).trim(), indexNowKey, "IndexNow key proof drifted");
const socialPng = readFileSync(path.join(root, "public", "og-image.png"));
assert.deepEqual([...socialPng.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], "social image is not PNG");
assert.equal(socialPng.readUInt32BE(16), 1200, "social image width drifted");
assert.equal(socialPng.readUInt32BE(20), 630, "social image height drifted");
assert.ok(indexHtml.includes('src="/demo.js"'));
assert.ok(indexHtml.includes("data-live-demo"));
assert.ok(indexHtml.includes("utm_campaign=nymrel-agent-first-user"));
assert.ok(demoScript.includes('fetch("/examples/route-request.json"'));
assert.ok(demoScript.includes('fetch("/v1/route"'));
assert.equal(/localStorage|sessionStorage|document\.cookie|sendBeacon/.test(demoScript), false, "activation script must not add browser tracking state");
assert.equal(/api[_-]?key|provider credential/i.test(demoScript), false, "activation script must not handle provider credentials");
assert.ok(sitemap.includes(`<loc>${packageJson.homepage}/</loc>`));
assert.ok(sitemap.includes(`<loc>${packageJson.homepage}/docs</loc>`));
assert.ok(robots.includes(`Sitemap: ${packageJson.homepage}/sitemap.xml`));
for (const crawler of ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot", "PerplexityBot", "Perplexity-User"]) {
  assert.ok(robots.includes(`User-agent: ${crawler}\nAllow: /`) || robots.includes(`User-agent: ${crawler}\r\nAllow: /`), `robots.txt omits explicit ${crawler} posture`);
}
for (const publicDocument of [indexHtml, docsHtml, llmsText]) {
  assert.ok(publicDocument.includes("https://github.com/Nymrel/nymrel-agent"), "public launch document omits the verified Nymrel source repository");
  assert.equal(publicDocument.includes("github.com/JalenBuildsHub/nymrel-agent"), false, "public launch document links to the suspended personal-account mirror");
}
for (const filename of ["nymrel-agent-0.2.0.tgz", "nymrel-agent-v0.2.0-source.tar.gz", "v0.2.0.json"]) {
  assert.ok(`${indexHtml}\n${docsHtml}\n${llmsText}`.includes(`/downloads/${filename}`), `public launch documents omit ${filename}`);
}
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
const homepage = read("public/index.html");
assert.equal(json("homepage.json").html, homepage, "Vercel homepage payload drifted from the canonical homepage");
assert.equal(homepage.includes('aria-label="Nymrel Agent home"'), false, "visible brand text must remain part of the accessible link name");
assert.equal(homepage.includes('class="number"'), false, "landing-page step labels must not reuse the low-contrast decorative number style");
assert.ok(vercel.headers?.some((entry) => entry.source === "/" && entry.headers?.some((header) => header.key === "Content-Security-Policy" && header.value.includes(cspHash))), "Vercel CSP does not authorize the exact JSON-LD block");
assert.ok(vercel.headers?.some((entry) => entry.source === "/" && entry.headers?.some((header) => header.key === "Content-Security-Policy" && header.value.includes("script-src 'self'"))), "Vercel CSP must permit the same-origin activation script");
assert.ok(vercel.headers?.some((entry) => entry.source === "/demo.js"
  && entry.headers?.some((header) => header.key === "Cache-Control" && header.value === "public, max-age=300")
  && entry.headers?.some((header) => header.key === "Cross-Origin-Resource-Policy" && header.value === "same-origin")
  && entry.headers?.some((header) => header.key === "X-Content-Type-Options" && header.value === "nosniff")), "Vercel activation-script header contract is missing");
assert.ok(vercel.headers?.some((entry) => entry.source === "/sitemap.xml"
  && entry.headers?.some((header) => header.key === "Cache-Control" && header.value === "public, max-age=3600")
  && entry.headers?.some((header) => header.key === "Cross-Origin-Resource-Policy" && header.value === "same-origin")
  && entry.headers?.some((header) => header.key === "X-Content-Type-Options" && header.value === "nosniff")), "Vercel sitemap header contract is missing");
for (const [source, contentType, cacheControl, resourcePolicy] of [
  ["/og-image.png", "image/png", "public, max-age=86400, stale-while-revalidate=604800", "cross-origin"],
  ["/og-image.svg", "image/svg+xml", "public, max-age=86400, stale-while-revalidate=604800", "cross-origin"],
  [`/${indexNowKey}.txt`, "text/plain; charset=utf-8", "public, max-age=3600", "same-origin"],
]) {
  const headerEntry = vercel.headers?.find((entry) => entry.source === source);
  assert.ok(headerEntry, `Vercel header contract is missing for ${source}`);
  assert.ok(headerEntry.headers?.some((header) => header.key === "Content-Type" && header.value === contentType), `${source} content-type contract is missing`);
  assert.ok(headerEntry.headers?.some((header) => header.key === "Cache-Control" && header.value === cacheControl), `${source} cache contract is missing`);
  assert.ok(headerEntry.headers?.some((header) => header.key === "Cross-Origin-Resource-Policy" && header.value === resourcePolicy), `${source} resource-policy contract is missing`);
  assert.ok(headerEntry.headers?.some((header) => header.key === "X-Content-Type-Options" && header.value === "nosniff"), `${source} nosniff contract is missing`);
}
assert.ok(vercel.headers?.some((entry) => entry.source === "/downloads/:path*" && entry.headers?.some((header) => header.key === "Cache-Control" && header.value.includes("immutable"))), "Vercel download cache contract is missing");
const vercelIgnore = read(".vercelignore");
for (const requiredIgnore of [
  "/dist/", "/.github/", "/.playwright-cli/", "/.vercel/", "/.wrangler/",
  "/coverage/", "/output/", "/test/", "/evidence/", "src/bin/", "public/_headers",
]) {
  assert.ok(vercelIgnore.split(/\r?\n/).includes(requiredIgnore), `Vercel source bundle must exclude ${requiredIgnore}`);
}
for (const localOnlySource of [
  "src/cli.ts", "src/defaults.ts", "src/local-config.ts", "src/mcp.ts",
  "src/openai-responses-provider.ts", "src/receipt.ts", "src/runtime.ts", "src/url-security.ts",
]) {
  assert.ok(vercelIgnore.split(/\r?\n/).includes(localOnlySource), `Vercel source bundle must exclude ${localOnlySource}`);
}
assert.ok(vercelIgnore.split(/\r?\n/).includes("scripts/verify-*.mjs"), "Vercel source bundle must exclude release-only verification scripts");
assert.ok(vercelIgnore.split(/\r?\n/).includes("/*.tgz"), "Vercel must exclude root package artifacts without excluding public downloads");
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
  "releaseSourceCommit",
  "deploymentSourceCommit",
]) {
  assert.ok(launchPacket.includes(requiredLaunchHold), `production launch packet is missing staged-promotion hold: ${requiredLaunchHold}`);
}

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if ([".git", ".vercel", ".wrangler", "dist", "node_modules"].includes(entry.name)) return [];
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
