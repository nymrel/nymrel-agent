import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relative: string) => readFileSync(relative, "utf8");

test("the public activation path runs only the metadata example and exposes attributable feedback", () => {
  const homepage = read("public/index.html");
  const script = read("public/demo.js");

  assert.match(homepage, /data-live-demo/);
  assert.match(homepage, /data-run-demo/);
  assert.match(homepage, /src="\/demo\.js"/);
  assert.match(homepage, /utm_campaign=nymrel-agent-first-user/);
  assert.match(script, /fetch\("\/examples\/route-request\.json"/);
  assert.match(script, /fetch\("\/v1\/route"/);
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
