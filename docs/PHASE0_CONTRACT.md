# Phase-0 contract (historical)

Status: independently accepted and promoted into the production v0.1 line on 2026-08-25.

This file records the narrower proof boundary that preceded promotion; it is not the current product contract. The current contract is `nymrel.agent.route/v1`, documented in `README.md` and `docs/ARCHITECTURE.md`.

## Objective

Prove that a Nymrel-owned runtime boundary can route and execute a read-only request without binding the contract to a particular model vendor or importing any private studio implementation.

## Stable boundary under evaluation

1. `RouteRequest` carries phase, risk, capability requirements, data boundary, cost/latency ceilings, and an optional incumbent. It carries no prompt.
2. `RoutePlan` records eligible scores, every exclusion reason, a stable tie-break, and a human-readable explanation.
3. `ProviderAdapter` defines a future-facing profile, health-probe, and event-stream seam. Phase 0 ships only `FakeProvider`.
4. `AgentRuntime` accepts only exact `FakeProvider` instances, blocks non-read work before provider execution, then emits body-free events and a receipt.
5. `RunReceipt` stores hashes and bounded metadata—not task or output bodies.

The whole-body hashes are unkeyed local correlation digests. They do not conceal a low-entropy body from an actor who can guess it, and phase zero does not authorize receipt export. A future export boundary must replace them with a separately reviewed keyed construction.

## Explicit non-goals

- No real model integration, credential, network client, MCP server, agent-to-agent transport, shell tool, workspace mutation, persistence layer, sandbox, deployment, or publication.
- No claim that synthetic routing scores predict real model performance.
- No commitment that these schemas become the public canonical API.

## Promotion evidence required

- Independent source and threat-boundary review.
- Provider conformance tests using approved fake/recorded fixtures before live canaries.
- A separately accepted operating-system isolation design before any write-capable tool.
- A decision to absorb, promote, or archive this candidate by the date in the phase-0 receipt.
