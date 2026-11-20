/** Local source/dev runner. Serves only fixed assets, never user metadata. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "../..");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const args = process.argv.slice(2);
function usage(message) { process.stderr.write(`${message}\nUse --check or --port 0..65535. This source runner binds only 127.0.0.1.\n`); process.exit(64); }
if (args.length === 1 && args[0] === "--help") { process.stdout.write("Local source workbench: node examples/router-workbench/serve.mjs [--port 0..65535 | --check]\nRequires the compiled source and its reviewed development dependencies.\n"); process.exit(0); }
if (args.length && args[0] !== "--check" && !(args.length === 2 && args[0] === "--port" && /^\d+$/.test(args[1]))) usage("Unknown workbench option.");
if (args[0] === "--check" && args.length !== 1) usage("--check accepts no other options.");
const port = args[0] === "--port" ? Number(args[1]) : 4320;
if (!Number.isInteger(port) || port < 0 || port > 65535) usage("Port must be from 0 to 65535.");
const { build } = createRequire(import.meta.url)("esbuild");
const bundled = await build({ absWorkingDir: root, entryPoints: [path.join(directory, "workbench.mjs")], bundle: true,
  platform: "browser", format: "esm", target: "es2022", write: false, metafile: true, outfile: "workbench.js", logLevel: "silent" });
const allowed = new Set(["examples/router-workbench/workbench.mjs", "examples/router-workbench/inputs.mjs", "examples/route-request-v2.json",
  ...["router-entry", "router", "contracts", "ordering", "scoring", "validation", "errors"].map((name) => `dist/src/${name}.js`)]);
const inputs = {};
for (const [name, input] of Object.entries(bundled.metafile.inputs)) {
  const relative = path.relative(root, path.resolve(root, name)).split(path.sep).join("/");
  assert.ok(allowed.has(relative), `Unexpected browser dependency: ${relative}`);
  assert.ok(input.imports.every((item) => !item.external), "External browser dependency");
  inputs[relative] = digest(await readFile(path.join(root, relative)));
}
assert.equal(Object.keys(inputs).length, allowed.size, "Browser graph must contain the UI/input helpers, fixture and seven canonical pure modules.");
assert.ok(Object.values(bundled.metafile.outputs).every((output) => output.imports.length === 0), "Unbundled browser import");
const assets = new Map([
  ["/", ["text/html; charset=utf-8", await readFile(path.join(directory, "index.html"))]],
  ["/styles.css", ["text/css; charset=utf-8", await readFile(path.join(directory, "styles.css"))]],
  ["/workbench.js", ["text/javascript; charset=utf-8", bundled.outputFiles[0].contents]],
  ["/favicon.svg", ["image/svg+xml", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#faf8f2"/><path d="M8 24V8h4l8 11V8h4v16h-4L12 13v11z" fill="#a8541f"/></svg>')]],
]);
const manifest = { kind: "local source-only routing workbench", browserInputs: inputs,
  assets: Object.fromEntries([...assets].map(([route, [contentType, bytes]]) => [route, { contentType, bytes: bytes.length, sha256: digest(bytes) }])) };
if (args[0] === "--check") { process.stdout.write(JSON.stringify(manifest) + "\n"); }
else {
  const server = createServer((request, response) => {
    response.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "no-store");
    if (request.method !== "GET" && request.method !== "HEAD") { response.writeHead(405, { Allow: "GET, HEAD" }); response.end(); request.resume(); return; }
    const asset = assets.get(request.url);
    if (!asset) { response.writeHead(404); response.end(); return; }
    response.setHeader("Content-Type", asset[0]);
    response.setHeader("Content-Length", asset[1].length);
    response.end(request.method === "HEAD" ? undefined : asset[1]);
  });
  server.on("error", () => { process.stderr.write("Local workbench could not bind its loopback port. Try --port 0.\n"); process.exitCode = 1; });
  server.listen(port, "127.0.0.1", () => {
    const address = server.address();
    process.stdout.write(`Nymrel Agent local workbench (source example)\nhttp://127.0.0.1:${address.port}/\nEdits stay in browser memory. Press Ctrl+C to stop.\n`);
  });
}
