import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relative: string) => readFileSync(relative, "utf8");

test("the public activation path runs only the metadata example and exposes attributable feedback", () => {
  const homepage = read("public/index.html");
  const script = read("public/demo.js");

  assert.match(homepage, /data-live-demo/);
  assert.match(homepage, /data-run-demo/);
  assert.equal((homepage.match(/data-run-demo/g) ?? []).length, 3);
  assert.match(homepage, /src="\/demo\.js"/);
  assert.match(homepage, /utm_campaign=nymrel-agent-first-user/);
  assert.match(homepage, /For teams using multiple model providers and strict data boundaries/);
  assert.match(homepage, /See which model wins/);
  assert.match(homepage, /Keep prompts and keys out of the hosted router/);
  assert.match(homepage, /Use the customer-local harness when you want to call a configured provider/);
  assert.match(homepage, /CALLER-SUPPLIED CATALOG EVIDENCE/);
  assert.match(homepage, /caller-supplied catalog facts—not Nymrel benchmarks/);
  assert.match(homepage, /No prompt, provider key, or output body is sent to Nymrel’s hosted router/);
  assert.doesNotMatch(homepage, /provider execution stays local|Execute locally|execute locally/);
  assert.match(homepage, /context_too_small · data_boundary_unsupported/);
  assert.match(homepage, /Need this fitted to your model stack/);
  const heroStart = homepage.indexOf('<section class="hero shell"');
  const heroEnd = homepage.indexOf("</section>", heroStart);
  const liveDemo = homepage.indexOf('id="live-demo"');
  assert.ok(heroStart >= 0 && liveDemo > heroStart && liveDemo < heroEnd, "the live route example must stay inside the hero");
  assert.ok(homepage.indexOf("Run the live route") < homepage.indexOf("Need this fitted to your model stack"));
  assert.match(script, /fetch\("\/examples\/route-request\.json"/);
  assert.match(script, /fetch\("\/v1\/route"/);
  assert.match(script, /querySelectorAll\("\[data-run-demo\]"\)/);
  assert.match(script, /tradeoffAgainstRunnerUp/);
  assert.match(script, /callerSuppliedCatalogEvidence/);
  assert.match(script, /routeDecision/);
  assert.match(script, /computedRouteScore: winnerEntry\.score/);
  const catalogHelper = script.slice(script.indexOf("const catalogFor"), script.indexOf("const winnerEntry"));
  assert.doesNotMatch(catalogHelper, /\bscore\b/);
  assert.match(script, /estimatedCostMicroUsdDelta/);
  assert.doesNotMatch(script, /localStorage|sessionStorage|document\.cookie|sendBeacon/);
  assert.doesNotMatch(script, /api[_-]?key|provider credential/i);
});

test("the standalone product publishes a same-origin sitemap and explicit crawler path", () => {
  const homepage = read("public/index.html");
  const docs = read("public/docs.html");
  const sitemap = read("public/sitemap.xml");
  const robots = read("public/robots.txt");
  const key = "0e2a8eae9dfa779ba2f3282c3c6e3d2d";

  for (const document of [homepage, docs]) {
    assert.match(document, /<meta property="og:image" content="https:\/\/nymrel-agent\.vercel\.app\/og-image\.png">/);
    assert.match(document, /<meta property="og:image:width" content="1200">/);
    assert.match(document, /<meta property="og:image:height" content="630">/);
    assert.match(document, /<meta name="twitter:card" content="summary_large_image">/);
    assert.match(document, /<meta name="twitter:image" content="https:\/\/nymrel-agent\.vercel\.app\/og-image\.png">/);
  }
  assert.match(sitemap, /<loc>https:\/\/nymrel-agent\.vercel\.app\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/nymrel-agent\.vercel\.app\/docs<\/loc>/);
  assert.doesNotMatch(sitemap, /<loc>https:\/\/(?!nymrel-agent\.vercel\.app)/);
  for (const crawler of ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot", "PerplexityBot", "Perplexity-User"]) {
    assert.match(robots, new RegExp(`User-agent: ${crawler}\\s+Allow: /`));
  }
  assert.match(robots, /Sitemap: https:\/\/nymrel-agent\.vercel\.app\/sitemap\.xml/);
  assert.equal(read(`public/${key}.txt`).trim(), key);
  const png = readFileSync("public/og-image.png");
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
});
