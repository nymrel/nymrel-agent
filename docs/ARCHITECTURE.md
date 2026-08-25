# Nymrel Agent architecture

## Composition root

This repository owns the public contract, validation, deterministic router, CLI, MCP server, local runtime, receipts, provider adapters, Worker surface, and release proof. Third-party harnesses can be subordinate adapters; they do not own route authority or release truth.

```text
caller model metadata
        |
        v
strict contract validation --> explicit rejection codes
        |
        v
deterministic objective scoring --> route plan
        |                    |
        |                    +--> public API response (no prompt path)
        +--> CLI / MCP
                 |
                 +--> optional customer-local read-only runtime
                            |
                            +--> customer-selected provider adapter
```

## Hosted surface

One Fetch-compatible handler owns the six dynamic public route classes. `POST /v1/route` checks media type and incrementally reads at most 256 KiB before parsing, validates exact fields, applies the routing core, and returns JSON with a request ID. There is no application database, queue, provider adapter, task field, or credential binding.

The production Vercel adapter serves named reviewed assets from the platform CDN and handles `/` plus dynamic API paths through Hono. The homepage is a compile-time JSON import; release verification enforces that its HTML is byte-identical to the canonical `public/index.html`, with no runtime filesystem or network read. Routing calls use the project-level Vercel WAF rate-limit rule `nymrel-agent-route-v1`: 120 requests per 60 seconds against the network identity derived by Vercel from the request, shared across function instances. The adapter never supplies a caller-influenceable custom key, calls `@vercel/firewall`, and fails closed when the rule is missing or cannot be checked. The ready probe checks the rule and reports `deployment` scope.

The Cloudflare adapter supplies the same handler with a native rate-limit binding explicitly reported as `edge_location`; only this adapter derives its binding key from Cloudflare's platform header. Cloudflare documents those counters as local to a Cloudflare location and eventually consistent. Vercel production accepts its source commit only from the provider-supplied `VERCEL_GIT_COMMIT_SHA`; the Git integration, exposed system variables, and deployment `gitSource` metadata must all agree with the accepted commit. Cloudflare remains dry-run-only until it has an equivalent provider-bound source receipt. Application code does not log request bodies.

## Routing core

Eligibility rules run before ranking:

- profile validity and unique model ID;
- health and probe state;
- data boundary and risk class;
- tool use and structured output;
- context size and modalities;
- cost and latency ceilings.

Eligible candidates receive integer components. Quality and reliability use caller-supplied normalized inputs; cost and latency are normalized relative to the eligible set; degraded health receives reduced utility; an incumbent receives a small visible stickiness bonus. The final tie-break uses code-unit order of model ID and provider ID.

## Local execution

`AgentRuntime` accepts explicit adapters, probes them, routes only among adapters present, and executes read-only tasks. Task size, requested output tokens, provider events, and output bytes are bounded. Receipts contain body digests and event facts but not bodies.

The OpenAI Responses adapter:

- reads a key value supplied by the CLI from an environment-variable name in local config;
- validates an HTTPS base URL, with HTTP allowed only for loopback hosts, and rejects any remote adapter profile that claims `local_only` custody;
- sends `store: false` and a bounded output request;
- incrementally bounds the provider response, requires `status: completed`, and reports an allowlisted status-class error without provider response bodies;
- never appears in the public Worker dependency graph.

## MCP

The stdio MCP server uses the stable v2 TypeScript SDK and a per-connection server factory. It exposes two read-only, non-destructive, idempotent tools. Stdout is reserved for protocol messages.

## OMP and Pi boundary

OMP is a pattern source, not the Nymrel runtime or public dependency. Its useful lessons are operational: explicit roles, bounded handoffs, provider-neutral dispatch, and durable receipts.

Pi may later be added as a customer-local, isolated execution adapter. Such an adapter must translate through `nymrel.agent.route/v1`, remain subordinate to Nymrel policy and receipts, start without write-capable tools, and pass a separate containment and authorization review. v0.1 does not shell out to Pi or depend on it.

## Versioning

The package version describes product delivery. `CONTRACT_VERSION` describes the public routing shape. Backward-compatible implementation changes increment the package; a breaking contract change requires a new contract identifier, migration documentation, fixtures for both versions during the support window, and an explicit release decision.
