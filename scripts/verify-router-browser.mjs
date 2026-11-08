/** Real browser module-worker acceptance for a separately installed router subpath. */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export async function verifyRouterWorkerConsumer(consumerRoot, { browser: useBrowser = false } = {}) {
  assert.equal(typeof useBrowser, "boolean");
  consumerRoot = path.resolve(consumerRoot);
  const relativeConsumer = path.relative(root, consumerRoot);
  assert.ok(relativeConsumer === ".." || relativeConsumer.startsWith(`..${path.sep}`) || path.isAbsolute(relativeConsumer),
    "consumer root must be outside the source checkout");
  const packageRoot = path.join(consumerRoot, "node_modules", "@nymrel", "agent");
  const metadata = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
  assert.equal(metadata.name, "@nymrel/agent");
  const fixture = JSON.parse(await readFile(path.join(packageRoot, "examples", "route-request-v2.json"), "utf8"));
  const { build } = createRequire(import.meta.url)("esbuild");
  const source = `
  import { routeV2 } from "@nymrel/agent/router";
  const fixture = ${JSON.stringify(fixture)};
  const require = (condition, message) => { if (!condition) throw new Error(message); };
  try {
    const plan = routeV2(fixture.request, fixture.models);
    require(plan.selectedModelId === "provider-b/fast", "unexpected selected model");
    const reversed = routeV2(fixture.request, [...fixture.models].reverse());
    require(JSON.stringify(plan) === JSON.stringify(reversed), "catalog order changed the plan");
    const blocked = routeV2(fixture.request, fixture.models.map(model => ({...model, health: "unavailable"})));
    require(blocked.selectedModelId === null && blocked.eligible.length === 0, "blocked route selected a model");
    postMessage({ok: true, checks: 3, selectedModelId: plan.selectedModelId,
      contractVersion: plan.contractVersion, executionStatus: "not_started"});
  } catch (error) { postMessage({ok: false, error: error.message}); }
  `;
  const bundled = await build({
    absWorkingDir: consumerRoot,
    stdin: { contents: source, sourcefile: "router-browser-consumer.mjs", resolveDir: consumerRoot },
    bundle: true, platform: "browser", format: "esm", target: "es2022",
    write: false, metafile: true, outfile: "worker.mjs", logLevel: "silent",
  });
  const pureFiles = new Set(["router-entry.js", "router.js", "contracts.js", "scoring.js", "ordering.js", "validation.js", "errors.js"]);
  const moduleDigests = {};
  for (const [name, input] of Object.entries(bundled.metafile.inputs)) {
    if (name === "router-browser-consumer.mjs") continue;
    const resolved = path.resolve(consumerRoot, name);
    const relative = path.relative(path.join(packageRoot, "dist", "src"), resolved);
    assert.ok(pureFiles.has(relative), `unexpected module in browser router graph: ${name}`);
    assert.ok(input.imports.every(imported => !imported.external), "external browser dependency");
    moduleDigests[relative] = createHash("sha256").update(await readFile(resolved)).digest("hex");
  }
  assert.equal(Object.keys(moduleDigests).length, pureFiles.size, "browser graph must contain only the entry and existing pure modules");
  assert.ok(Object.values(bundled.metafile.outputs).every(output => output.imports.length === 0), "unbundled browser import");
  const worker = bundled.outputFiles[0].contents;
  let workerResult;
  runInNewContext(new TextDecoder().decode(worker), { postMessage: value => { workerResult = structuredClone(value); } },
    { timeout: 2000, contextCodeGeneration: { strings: false, wasm: false } });
  assert.equal(workerResult?.ok, true, workerResult?.error ?? "worker-like context did not return a result");
  assert.equal(workerResult.checks, 3);
  const report = { status: "PASS", kind: "synthetic-installed-browser-bundle-worker-context-acceptance",
    packageVersion: metadata.version, node: process.version, checks: workerResult.checks,
    bundleSha256: createHash("sha256").update(worker).digest("hex"), bundledModules: moduleDigests,
    nativeBrowser: "not exercised", providerCalls: 0, externalAdoption: "not measured" };
  if (!useBrowser) return report;
  const candidates = process.env.NYMREL_ROUTER_BROWSER_BIN ? [process.env.NYMREL_ROUTER_BROWSER_BIN] :
    process.platform === "win32" ? ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"] :
      process.platform === "darwin" ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"] :
        ["/usr/bin/chromium", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/opt/google/chrome/chrome"];
  const executable = candidates.find(existsSync);
  assert.ok(executable, "Chromium is required; set NYMREL_ROUTER_BROWSER_BIN to an installed executable");
  const browserVersion = spawnSync(executable, ["--version"], { encoding: "utf8", timeout: 10_000 });
  assert.equal(browserVersion.status, 0, "browser version probe failed");
  const assets = new Map([
    ["/", ["text/html; charset=utf-8", "<!doctype html><title>Installed router worker</title><script type=module src=/page.mjs></script>"]],
    ["/page.mjs", ["text/javascript; charset=utf-8", `
      globalThis.__routerProof = null;
      const worker = new Worker('/worker.mjs', {type: 'module'});
      worker.onmessage = event => { globalThis.__routerProof = event.data; worker.terminate(); };
      worker.onerror = () => { globalThis.__routerProof = {ok: false, error: 'module worker failed'}; };
    `]],
    ["/worker.mjs", ["text/javascript; charset=utf-8", worker]],
  ]);
  const server = createServer((request, response) => {
    const asset = request.method === "GET" && assets.get(request.url);
    if (!asset) { response.writeHead(404); response.end(); return; }
    response.setHeader("Content-Type", asset[0]);
    response.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; worker-src 'self'; connect-src 'none'");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.end(asset[1]);
  });
  const temporary = await mkdtemp(path.join(tmpdir(), "nymrel-router-browser-"));
  const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
  let browser, socket, session, sequence = 0, launchError, diagnostic = "";
  const pending = new Map();
  const externalRequests = [];
  async function until(callback) {
    for (let attempt = 0; attempt < 150; attempt++) {
      const result = await callback();
      if (result) return result;
      await delay(100);
    }
    throw new Error("browser acceptance timed out");
  }
  function call(method, params = {}, attached = true) {
    return new Promise((resolve, reject) => {
      assert.equal(socket.readyState, WebSocket.OPEN, "browser socket is closed");
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`browser command timed out: ${method}`)); }, 5000);
      pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
      socket.send(JSON.stringify({ id, method, params, ...(attached ? { sessionId: session } : {}) }));
    });
  }
  try {
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = spawn(executable, ["--headless=new", "--remote-debugging-port=0", "--remote-debugging-address=127.0.0.1",
      `--user-data-dir=${temporary}`, "--no-first-run", "--no-default-browser-check", "--disable-background-networking",
      "--disable-sync", "--disable-extensions", "--disable-component-update", "about:blank"],
    { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    browser.once("error", error => { launchError = error; });
    browser.stderr.on("data", bytes => { diagnostic = (diagnostic + bytes.toString()).slice(-4096); });
    const portFile = await until(async () => {
      if (launchError) throw launchError;
      assert.ok(browser.exitCode === null && browser.signalCode === null, `browser exited: ${diagnostic}`);
      try { return await readFile(path.join(temporary, "DevToolsActivePort"), "utf8"); } catch { return null; }
    });
    const [port, endpoint] = portFile.trim().split(/\r?\n/u);
    socket = new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("browser socket open timed out")), 5000);
      socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("browser socket open failed")); }, { once: true });
    });
    socket.addEventListener("close", () => { for (const waiter of pending.values()) waiter.reject(new Error("browser disconnected")); pending.clear(); });
    socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(data);
      if (pending.has(message.id)) {
        const waiter = pending.get(message.id); pending.delete(message.id);
        message.error ? waiter.reject(new Error(message.error.message)) : waiter.resolve(message.result);
      }
      if (message.method === "Network.requestWillBeSent" && /^https?:/u.test(message.params.request.url) &&
          new URL(message.params.request.url).origin !== origin) externalRequests.push(message.params.request.url);
    });
    const target = await call("Target.createTarget", { url: "about:blank" }, false);
    ({ sessionId: session } = await call("Target.attachToTarget", { targetId: target.targetId, flatten: true }, false));
    await call("Runtime.enable"); await call("Page.enable"); await call("Network.enable");
    await call("Page.navigate", { url: origin });
    const result = await until(async () => {
      const evaluated = await call("Runtime.evaluate", { expression: "globalThis.__routerProof", returnByValue: true });
      assert.equal(evaluated.exceptionDetails, undefined, "browser evaluation failed");
      return evaluated.result.value;
    });
    assert.equal(result.ok, true, result.error);
    assert.equal(result.checks, 3);
    assert.deepEqual(externalRequests, [], "page made a non-loopback request");
    return { ...report, kind: "synthetic-installed-browser-module-worker-acceptance",
      nativeBrowser: browserVersion.stdout.trim(), browserSandbox: "default; no sandbox-disabling override" };
  } finally {
    socket?.close();
    if (browser && browser.exitCode === null && browser.signalCode === null) {
      browser.kill("SIGTERM");
      await Promise.race([new Promise(resolve => browser.once("exit", resolve)), delay(2000)]);
      if (browser.exitCode === null && browser.signalCode === null) browser.kill("SIGKILL");
    }
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assert.ok(process.argv.length === 4 || process.argv.length === 5,
      "usage: node scripts/verify-router-browser.mjs --consumer-root DIR [--bundle-only]");
    assert.equal(process.argv[2], "--consumer-root");
    assert.ok(process.argv[4] === undefined || process.argv[4] === "--bundle-only", "unsupported browser proof option");
    console.log(JSON.stringify(await verifyRouterWorkerConsumer(process.argv[3], { browser: process.argv[4] !== "--bundle-only" })));
  } catch (error) {
    console.error(`router-worker-verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
