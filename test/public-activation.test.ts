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
  const sitemap = read("public/sitemap.xml");
  const robots = read("public/robots.txt");

  assert.match(sitemap, /<loc>https:\/\/nymrel-agent\.vercel\.app\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/nymrel-agent\.vercel\.app\/docs<\/loc>/);
  assert.doesNotMatch(sitemap, /<loc>https:\/\/(?!nymrel-agent\.vercel\.app)/);
  assert.match(robots, /User-agent: GPTBot\s+Allow: \//);
  assert.match(robots, /Sitemap: https:\/\/nymrel-agent\.vercel\.app\/sitemap\.xml/);
});
