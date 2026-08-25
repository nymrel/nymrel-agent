# Phase-0 contract

Status: internal candidate; independent review required.

## Objective

Prove that a Nymrel-owned runtime boundary can route and execute a read-only request without binding the contract to a particular model vendor or importing any private studio implementation.

## Stable boundary under evaluation

1. `RouteRequest` carries phase, risk, capability requirements, data boundary, cost/latency ceilings, and an optional incumbent. It carries no prompt.
2. `RoutePlan` records eligible scores, every exclusion reason, a stable tie-break, and a human-readable explanation.
3. `ProviderAdapter` supplies a model profile, health probe, and event stream. Phase 0 ships only a fake adapter.
4. `AgentRuntime` blocks non-read work before provider execution, then emits body-free events and a receipt.
5. `RunReceipt` stores hashes and bounded metadata—not task or output bodies.

## Explicit non-goals

- No real model integration, credential, network client, MCP server, agent-to-agent transport, shell tool, workspace mutation, persistence layer, sandbox, deployment, or publication.
- No claim that synthetic routing scores predict real model performance.
- No commitment that these schemas become the public canonical API.

## Promotion evidence required

- Independent source and threat-boundary review.
- Provider conformance tests using approved fake/recorded fixtures before live canaries.
- A separately accepted operating-system isolation design before any write-capable tool.
- A decision to absorb, promote, or archive this candidate by the date in the phase-0 receipt.
