/**
 * Reviewed public-surface registry for the active Nymrel Agent release.
 *
 * This is intentionally imported by both release verification and the Vercel
 * inventory verifier. Update it only with the matching release artifacts,
 * route matrix, static matrix, and tests in the same reviewed change.
 */
export const CANONICAL_ORIGIN = "https://github.com/Nymrel/nymrel-agent.git";
export const LEGACY_MIRROR_ORIGIN = "https://github.com/JalenBuildsHub/nymrel-agent.git";
export const ACTIVE_RELEASE_VERSION = "0.2.0";

const releaseArtifacts = (version) => [
  `public/downloads/nymrel-agent-${version}.tgz`,
  `public/downloads/nymrel-agent-v${version}-source.tar.gz`,
  `public/downloads/v${version}.json`,
];

export const RELEASE_ARCHIVE_FILES = Object.freeze([
  ...releaseArtifacts("0.1.0"),
  ...releaseArtifacts("0.1.1"),
  ...releaseArtifacts("0.1.2"),
  ...releaseArtifacts("0.1.3"),
  ...releaseArtifacts(ACTIVE_RELEASE_VERSION),
]);

export const ACTIVE_RELEASE_FILES = Object.freeze(releaseArtifacts(ACTIVE_RELEASE_VERSION));

export const VERCEL_SOURCE_FILES = Object.freeze([
  ".vercelignore",
  "homepage.json",
  "package-lock.json",
  "package.json",
  "public/0e2a8eae9dfa779ba2f3282c3c6e3d2d.txt",
  "public/404.html",
  "public/demo.js",
  "public/docs.html",
  ...RELEASE_ARCHIVE_FILES,
  "public/examples/route-request.json",
  "public/examples/route-request-v2.json",
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
  "src/scoring.ts",
  "src/validation.ts",
  "src/worker.ts",
  "tsconfig.json",
  "vercel.json",
].sort());

export const PUBLIC_ROUTE_MATRIX = Object.freeze([
  { method: "GET", path: "/healthz" },
  { method: "GET", path: "/readyz" },
  { method: "GET", path: "/v1" },
  { method: "GET", path: "/v1/openapi.json" },
  { method: "POST", path: "/v1/route" },
  { method: "OPTIONS", path: "/v1/route" },
  { method: "GET", path: "/v2" },
  { method: "GET", path: "/v2/openapi.json" },
  { method: "POST", path: "/v2/route" },
  { method: "OPTIONS", path: "/v2/route" },
]);

export const PUBLIC_STATIC_MATRIX = Object.freeze([
  "/",
  "/docs",
  "/demo.js",
  "/sitemap.xml",
  "/openapi.json",
  "/llms.txt",
  "/robots.txt",
  "/examples/route-request.json",
  "/examples/route-request-v2.json",
  "/og-image.png",
  "/og-image.svg",
  "/0e2a8eae9dfa779ba2f3282c3c6e3d2d.txt",
]);
