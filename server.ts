import { checkRateLimit } from "@vercel/firewall";
import { Hono, type Context } from "hono";
import homepageDocument from "./homepage.json" with { type: "json" };
import openapiDocument from "./public/openapi.json" with { type: "json" };
import { handleRequest, type PlatformRateLimiter, type WorkerEnv } from "./src/worker.js";

export const VERCEL_RATE_LIMIT_ID = "nymrel-agent-route-v1";

export type VercelRateLimitChecker = (
  rateLimitId: string,
  options: { request: Request },
) => Promise<{ rateLimited: boolean; error?: "not-found" | "blocked" }>;

export interface ServerOptions {
  readonly rateLimitChecker?: VercelRateLimitChecker;
  readonly routingApiEnabled?: boolean;
  readonly sourceCommit?: string;
}

function platformRateLimiter(checker: VercelRateLimitChecker): PlatformRateLimiter {
  return {
    async limit({ request }) {
      try {
        const result = await checker(VERCEL_RATE_LIMIT_ID, { request });
        if (result.error === "not-found") return { status: "misconfigured" };
        if (result.rateLimited) return { status: "limited" };
        return { status: "allowed" };
      } catch {
        return { status: "misconfigured" };
      }
    },
    async probe(request) {
      try {
        const result = await checker(VERCEL_RATE_LIMIT_ID, { request });
        return { status: result.error === undefined ? "ready" : "misconfigured" };
      } catch {
        return { status: "misconfigured" };
      }
    },
  };
}

export function createApp(options: ServerOptions = {}): Hono {
  const checker = options.rateLimitChecker ?? checkRateLimit;
  const sourceCommit = options.sourceCommit
    ?? process.env.VERCEL_GIT_COMMIT_SHA;
  const routingApiEnabled = options.routingApiEnabled
    ?? process.env.ROUTING_API_ENABLED !== "false";
  const openapiBody = `${JSON.stringify(openapiDocument)}\n`;
  const runtimeEnv: WorkerEnv = {
    APP_ENV: "production",
    PLATFORM_ABUSE_PROTECTION: "vercel_waf_rate_limit",
    PLATFORM_RATE_LIMITER: platformRateLimiter(checker),
    RATE_LIMIT_SCOPE: "deployment",
    ROUTING_API_ENABLED: routingApiEnabled ? "true" : "false",
    ...(sourceCommit === undefined ? {} : { SOURCE_COMMIT: sourceCommit }),
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

  return app;
}

export default createApp();
