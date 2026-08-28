import { CONTRACT_VERSION, CONTRACT_VERSION_V2, PRODUCT_VERSION, type PublicErrorResponse, type PublicRouteResponse, type PublicRouteResponseV2 } from "./contracts.js";
import { NymrelError, publicError } from "./errors.js";
import { route, routeV2 } from "./router.js";
import { parsePublicRoutePayload, parsePublicRoutePayloadV2 } from "./validation.js";

const MAX_BODY_BYTES = 256 * 1024;

export const PUBLIC_ROUTES = Object.freeze([
  { method: "GET", path: "/healthz", reason: "Public liveness probe; returns version and status only." },
  { method: "GET", path: "/readyz", reason: "Public readiness probe; returns deterministic router readiness only." },
  { method: "GET", path: "/v1", reason: "Public API discovery document; contains no customer data." },
  { method: "GET", path: "/v1/openapi.json", reason: "Public machine-readable API documentation." },
  { method: "POST", path: "/v1/route", reason: "Free stateless router; accepts model metadata only and stores nothing." },
  { method: "OPTIONS", path: "/v1/route", reason: "CORS preflight for the public stateless router." },
  { method: "GET", path: "/v2", reason: "Public v2 API discovery document; contains no customer data." },
  { method: "GET", path: "/v2/openapi.json", reason: "Public machine-readable API documentation for v2." },
  { method: "POST", path: "/v2/route", reason: "Free stateless v2 router with explicit request-budget normalization." },
  { method: "OPTIONS", path: "/v2/route", reason: "CORS preflight for the public stateless v2 router." },
]);

export const STATIC_ASSET_POLICY = Object.freeze([
  { method: "GET", path: "/{static-asset}", reason: "Public immutable product, documentation, discoverability, and example files from the reviewed public directory." },
  { method: "HEAD", path: "/{static-asset}", reason: "Public metadata probe for the same reviewed static assets; returns no application or customer data." },
]);

interface AssetsBinding { fetch(request: Request): Promise<Response> }
interface RateLimitBinding { limit(options: { key: string }): Promise<{ success: boolean }> }
export interface PlatformRateLimiter {
  limit(options: { request: Request }): Promise<{
    status: "allowed" | "limited" | "misconfigured";
  }>;
  probe(request: Request): Promise<{ status: "ready" | "misconfigured" }>;
}
export interface WorkerEnv {
  readonly ASSETS?: AssetsBinding;
  readonly ROUTE_RATE_LIMITER?: RateLimitBinding;
  readonly PLATFORM_RATE_LIMITER?: PlatformRateLimiter;
  readonly APP_ENV?: string;
  readonly RATE_LIMIT_SCOPE?: string;
  readonly PLATFORM_ABUSE_PROTECTION?: string;
  readonly ROUTING_API_ENABLED?: string;
  readonly SOURCE_COMMIT?: string;
}

function securityHeaders(api = false): Headers {
  const headers = new Headers({
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": api ? "cross-origin" : "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  });
  if (!api) {
    headers.set("Content-Security-Policy", "default-src 'self'; base-uri 'none'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self' 'sha256-7w4lV3bipSTOcYkKqovex61nVexBbZj6nYqmQ2Twk10='; style-src 'self'");
  }
  return headers;
}

function withHeaders(response: Response, api = false): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of securityHeaders(api)) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function apiHeaders(requestId: string): Headers {
  const headers = securityHeaders(true);
  headers.set("Access-Control-Allow-Headers", "content-type");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Nymrel-Request-Id", requestId);
  return headers;
}

function json(value: unknown, status: number, requestId: string): Response {
  return new Response(`${JSON.stringify(value)}\n`, { status, headers: apiHeaders(requestId) });
}

async function bindingRateLimitKey(request: Request): Promise<string> {
  const source = (request.headers.get("cf-connecting-ip") ?? "unknown").slice(0, 160);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

async function enforceRateLimit(request: Request, env: WorkerEnv): Promise<void> {
  if (env.PLATFORM_RATE_LIMITER) {
    let decision: "allowed" | "limited" | "misconfigured";
    try {
      ({ status: decision } = await env.PLATFORM_RATE_LIMITER.limit({ request }));
    } catch {
      decision = "misconfigured";
    }
    if (decision === "misconfigured") {
      throw new NymrelError("service_misconfigured", "The routing service is not ready.", 503);
    }
    if (decision === "limited") {
      throw new NymrelError("rate_limited", "The free routing limit has been reached. Retry shortly.", 429);
    }
  }
  if (env.ROUTE_RATE_LIMITER) {
    const key = await bindingRateLimitKey(request);
    let success = false;
    try {
      ({ success } = await env.ROUTE_RATE_LIMITER.limit({ key }));
    } catch {
      throw new NymrelError("service_misconfigured", "The routing service is not ready.", 503);
    }
    if (!success) throw new NymrelError("rate_limited", "The free routing limit has been reached. Retry shortly.", 429);
  }
  if (!env.PLATFORM_RATE_LIMITER && !env.ROUTE_RATE_LIMITER && env.APP_ENV === "production") {
    throw new NymrelError("service_misconfigured", "The routing service is not ready.", 503);
  }
}

async function readBoundedBody(request: Request): Promise<Uint8Array> {
  if (request.body === null) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        try {
          await reader.cancel();
        } catch {
          // The 413 remains authoritative even if the source rejects cancellation.
        }
        throw new NymrelError("payload_too_large", "The routing payload exceeds 256 KiB.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function parseJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new NymrelError("unsupported_media_type", "Content-Type must be application/json.", 415);
  }
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength) || !Number.isSafeInteger(Number(declaredLength))) {
      throw new NymrelError("invalid_content_length", "Content-Length must be a non-negative decimal integer.", 400);
    }
    if (Number(declaredLength) > MAX_BODY_BYTES) {
      throw new NymrelError("payload_too_large", "The routing payload exceeds 256 KiB.", 413);
    }
  }
  const bytes = await readBoundedBody(request);
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new NymrelError("invalid_json", "The request body is not valid JSON.", 400);
  }
}

function requestId(): string {
  return crypto.randomUUID();
}

async function asset(request: Request, env: WorkerEnv, path?: string): Promise<Response> {
  if (!env.ASSETS) return withHeaders(new Response("Not found\n", { status: 404 }));
  const target = path === undefined ? request : new Request(new URL(path, request.url), request);
  return withHeaders(await env.ASSETS.fetch(target));
}

async function handleApi(request: Request, env: WorkerEnv): Promise<Response> {
  const id = requestId();
  const url = new URL(request.url);
  try {
    if (request.method === "OPTIONS" && (url.pathname === "/v1/route" || url.pathname === "/v2/route")) return new Response(null, { status: 204, headers: apiHeaders(id) });
    if (request.method === "GET" && url.pathname === "/healthz") {
      return json({
        ok: true,
        status: "healthy",
        version: PRODUCT_VERSION,
        sourceCommit: env.SOURCE_COMMIT ?? "unbound",
      }, 200, id);
    }
    if (request.method === "GET" && url.pathname === "/readyz") {
      const routingApiReady = env.ROUTING_API_ENABLED !== "false";
      const sourceCommitReady = env.APP_ENV !== "production" || /^[a-f0-9]{40}$/.test(env.SOURCE_COMMIT ?? "");
      let platformProbeReady = false;
      if (env.PLATFORM_RATE_LIMITER !== undefined && env.RATE_LIMIT_SCOPE === "deployment") {
        try {
          platformProbeReady = (await env.PLATFORM_RATE_LIMITER.probe(request)).status === "ready";
        } catch {
          platformProbeReady = false;
        }
      }
      const platformRateLimitReady = env.PLATFORM_RATE_LIMITER !== undefined && env.RATE_LIMIT_SCOPE === "deployment" && platformProbeReady;
      const bindingRateLimitReady = env.ROUTE_RATE_LIMITER !== undefined;
      const rateLimitReady = env.APP_ENV !== "production" || platformRateLimitReady || bindingRateLimitReady;
      const ready = routingApiReady && sourceCommitReady && rateLimitReady;
      const rateLimitStatus = platformRateLimitReady
        ? "platform_ready"
        : bindingRateLimitReady
          ? "binding_ready"
          : env.PLATFORM_RATE_LIMITER === undefined
            ? (rateLimitReady ? "not_configured" : "missing")
            : "scope_invalid";
      return json({
        ok: ready,
        status: ready ? "ready" : "not_ready",
        checks: {
          router: "ready",
          routingApi: routingApiReady ? "enabled" : "disabled",
          sourceCommit: sourceCommitReady ? (env.SOURCE_COMMIT ?? "development") : "missing_or_invalid",
          rateLimit: rateLimitStatus,
          rateLimitScope: platformRateLimitReady ? "deployment" : bindingRateLimitReady ? (env.RATE_LIMIT_SCOPE ?? "edge_location") : "not_configured",
          platformAbuseProtection: env.PLATFORM_ABUSE_PROTECTION ?? "not_declared",
          storage: "not_used",
          providers: "not_used",
        },
      }, ready ? 200 : 503, id);
    }
    if (request.method === "GET" && url.pathname === "/v1") {
      return json({ ok: true, name: "Nymrel Agent", version: PRODUCT_VERSION, contractVersion: CONTRACT_VERSION, route: "/v1/route", openapi: "/v1/openapi.json" }, 200, id);
    }
    if (request.method === "GET" && url.pathname === "/v2") {
      return json({ ok: true, name: "Nymrel Agent", version: PRODUCT_VERSION, contractVersion: CONTRACT_VERSION_V2, route: "/v2/route", openapi: "/v2/openapi.json" }, 200, id);
    }
    if (request.method === "GET" && url.pathname === "/v1/openapi.json") return asset(request, env, "/openapi.json");
    if (request.method === "GET" && url.pathname === "/v2/openapi.json") return asset(request, env, "/openapi.json");
    if ((url.pathname === "/v1/route" || url.pathname === "/v2/route") && request.method !== "POST") {
      throw new NymrelError("method_not_allowed", "Use POST for this endpoint.", 405);
    }
    if (request.method === "POST" && url.pathname === "/v1/route") {
      if (env.ROUTING_API_ENABLED === "false") {
        throw new NymrelError("service_disabled", "The routing API is temporarily offline.", 503);
      }
      await enforceRateLimit(request, env);
      const payload = parsePublicRoutePayload(await parseJsonBody(request));
      const response: PublicRouteResponse = { ok: true, requestId: id, plan: route(payload.request, payload.models) };
      return json(response, 200, id);
    }
    if (request.method === "POST" && url.pathname === "/v2/route") {
      if (env.ROUTING_API_ENABLED === "false") {
        throw new NymrelError("service_disabled", "The routing API is temporarily offline.", 503);
      }
      await enforceRateLimit(request, env);
      const payload = parsePublicRoutePayloadV2(await parseJsonBody(request));
      const response: PublicRouteResponseV2 = { ok: true, requestId: id, plan: routeV2(payload.request, payload.models) };
      return json(response, 200, id);
    }
    throw new NymrelError("not_found", "The API route does not exist.", 404);
  } catch (caught) {
    const error = publicError(caught);
    const response: PublicErrorResponse = {
      ok: false,
      requestId: id,
      error: { code: error.code, message: error.message, ...(error.details.length === 0 ? {} : { details: error.details }) },
    };
    const result = json(response, error.status, id);
    if (error.status === 429) result.headers.set("Retry-After", "60");
    if (error.status === 405) result.headers.set("Allow", "POST, OPTIONS");
    return result;
  }
}

export async function handleRequest(request: Request, env: WorkerEnv = {}): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path === "/healthz" || path === "/readyz" || path === "/v1" || path.startsWith("/v1/") || path === "/v2" || path.startsWith("/v2/")) return handleApi(request, env);
  if (request.method !== "GET" && request.method !== "HEAD") {
    const response = withHeaders(new Response("Method not allowed\n", { status: 405, headers: { "content-type": "text/plain; charset=utf-8" } }));
    response.headers.set("Allow", "GET, HEAD");
    return response;
  }
  return asset(request, env);
}

export default { fetch: handleRequest };
