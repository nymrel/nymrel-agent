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

One Fetch-compatible handler owns the ten dynamic public route classes. `POST /v1/route` and the separate opt-in `POST /v2/route` check media type and incrementally read at most 256 KiB before parsing, validate exact fields, apply their routing core, and return JSON with a request ID. There is no application database, queue, provider adapter, task field, or credential binding.

The production Vercel adapter serves named reviewed assets from the platform CDN and handles `/` plus dynamic API paths through Hono. The homepage is a compile-time JSON import; release verification enforces that its HTML is byte-identical to the canonical `public/index.html`, with no runtime filesystem or network read. Routing calls use the project-level Vercel WAF rate-limit rule `nymrel-agent-route-v1`: 120 requests per 60 seconds against the network identity derived by Vercel from the request, shared across function instances. The adapter never supplies a caller-influenceable custom key, calls `@vercel/firewall`, and fails closed when the rule is missing or cannot be checked. The ready probe checks the rule and reports `deployment` scope.

The Cloudflare adapter supplies the same handler with a native rate-limit binding explicitly reported as `edge_location`; only this adapter derives its binding key from Cloudflare's platform header. Cloudflare documents those counters as local to a Cloudflare location and eventually consistent. Vercel production accepts `deploymentSourceCommit` only from the provider-supplied `VERCEL_GIT_COMMIT_SHA`. In preferred `provider_git` mode, the connected repository, exposed system variable, deployment `gitSource`, runtime probes, and accepted hosting commit must all agree. When an existing account OAuth gate blocks provider Git, `verified_cli_bundle` mode requires authenticated remote `main`, clean local `HEAD`, provider commit metadata, runtime probes, and the accepted hosting commit to agree, then verifies the provider inventory against an exact file allowlist and raw-byte SHA-1 digests; `gitSource` is expected to be null in that contingency and is not represented as Git-backed. The versioned package/source manifest separately records `releaseSourceCommit`. Cloudflare remains dry-run-only until it has an equivalent provider-bound source receipt. Application code does not log request bodies.

## Routing core

Eligibility rules run before ranking:

- profile validity and unique model ID;
- health and probe state;
- data boundary and risk class;
- tool use and structured output;
- context size and modalities;
- cost and latency ceilings.

Eligible candidates receive integer components. Quality and reliability use caller-supplied normalized inputs. When the caller supplies a cost or latency ceiling, that component is normalized against the matching ceiling: zero usage receives full utility and a candidate exactly at the ceiling receives zero utility. This keeps the candidate's component stable when unrelated models are added to or removed from the catalog. Without a matching ceiling, cost or latency falls back to normalization relative to the eligible set. The closed v1 route shape is preserved: `decisionCodes` records the modes and `explanation` records the exact numeric bounds. Degraded health receives reduced utility; an incumbent receives a small visible stickiness bonus. The final tie-break uses code-unit order of model ID and provider ID.

`nymrel.agent.route/v2` is a separate request and response contract. It requires explicit positive request-budget cost and latency anchors, uses integer-safe request-anchor utilities, and computes the Pareto frontier after the same hard eligibility filters. Quality, reliability, and health are maximized; cost and latency are minimized. The selected model must be on the sorted frontier. v2 weighted scoring ranks only that frontier, and an incumbent can break only an exact weighted-score tie there without receiving a bonus. v1 remains unchanged, including its ceiling behavior, decision codes, explanation, and response shape.

## Local execution

`AgentRuntime` accepts explicit adapters, probes them, routes only among adapters present, and executes read-only tasks. Task size, requested output tokens, provider events, and output bytes are bounded. Receipts contain body digests and event facts but not bodies.

The OpenAI Responses adapter:

- reads a key value supplied by the CLI from an environment-variable name in local config;
- validates an HTTPS base URL, with HTTP allowed only for loopback hosts, and rejects any remote adapter profile that claims `local_only` custody;
- sends `store: false` and a bounded output request;
- incrementally bounds the provider response, requires `status: completed`, and reports an allowlisted status-class error without provider response bodies;
- never appears in the public Worker dependency graph.

## MCP

The stdio MCP server uses the stable v2 TypeScript SDK and a per-connection server factory. It exposes `route_models` for v1, `route_models_v2` for v2, `explain_contract` for the stable v1 boundary, and `explain_contract_v2` for the explicit v2 boundary; all are read-only, non-destructive, and idempotent. Stdout is reserved for protocol messages.

## OMP and Pi boundary

OMP is a pattern source, not the Nymrel runtime or public dependency. Its useful lessons are operational: explicit roles, bounded handoffs, provider-neutral dispatch, and durable receipts.

Pi may later be added as a customer-local, isolated execution adapter. Such an adapter must translate through `nymrel.agent.route/v1`, remain subordinate to Nymrel policy and receipts, start without write-capable tools, and pass a separate containment and authorization review. v0.1 does not shell out to Pi or depend on it.

## Versioning

The package version describes product delivery. `CONTRACT_VERSION` describes the public routing shape. Backward-compatible implementation changes increment the package; a breaking contract change requires a new contract identifier, migration documentation, fixtures for both versions during the support window, and an explicit release decision.
