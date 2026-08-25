import { Hono, type Context } from "hono";
import homepageDocument from "./homepage.json" with { type: "json" };
import openapiDocument from "./public/openapi.json" with { type: "json" };
import { handleRequest, type WorkerEnv } from "./src/worker.js";

const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 60_000;
const MAX_ACTIVE_KEYS = 10_000;

interface RateWindow {
  count: number;
  resetAt: number;
}

const windows = new Map<string, RateWindow>();
let nextSweepAt = Date.now() + RATE_WINDOW_MS;

const instanceRateLimiter = {
  async limit({ key }: { key: string }): Promise<{ success: boolean }> {
    const now = Date.now();
    if (now >= nextSweepAt) {
      for (const [candidate, window] of windows) {
        if (window.resetAt <= now) windows.delete(candidate);
      }
      nextSweepAt = now + RATE_WINDOW_MS;
    }

    const existing = windows.get(key);
    if (existing === undefined || existing.resetAt <= now) {
      if (existing === undefined && windows.size >= MAX_ACTIVE_KEYS) return { success: false };
      windows.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
      return { success: true };
    }
    if (existing.count >= RATE_LIMIT) return { success: false };
    existing.count += 1;
    return { success: true };
  },
};

const openapiBody = `${JSON.stringify(openapiDocument)}\n`;
const runtimeEnv: WorkerEnv = {
  APP_ENV: "production",
  PLATFORM_ABUSE_PROTECTION: "vercel",
  RATE_LIMIT_SCOPE: "function_instance",
  ROUTE_RATE_LIMITER: instanceRateLimiter,
  ASSETS: {
    async fetch(request) {
      if (new URL(request.url).pathname === "/openapi.json") {
        return new Response(openapiBody, { headers: { "content-type": "application/json; charset=utf-8" } });
      }
      return new Response("Not found\n", { status: 404 });
    },
  },
};

const app = new Hono();
const forward = (context: Context): Promise<Response> => handleRequest(context.req.raw, runtimeEnv);

app.get("/", (context) => {
  context.header("Cache-Control", "public, max-age=300");
  context.header("CDN-Cache-Control", "public, max-age=300");
  return context.html(homepageDocument.html);
});
app.all("/healthz", forward);
app.all("/readyz", forward);
app.all("/v1", forward);
app.all("/v1/*", forward);

export default app;
