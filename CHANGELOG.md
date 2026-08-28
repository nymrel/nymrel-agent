# Changelog

All notable product changes are documented here.

## 0.3.1 — 2026-08-28

- Fixed horizontal overflow in the public documentation at narrow mobile widths by allowing the single-column documentation grid and prose content to shrink, while wrapping long inline code tokens. The v0.3.0 staged deployment was not promoted after the browser gate found this defect.

## 0.3.0 — 2026-08-28

- Added local plan-only Job Mode. It validates a bounded, body-free, ordered 1–32-step manifest, uses the existing v2 router for every step, emits a body-free correlation receipt, and labels non-read steps as external handoffs without calling a provider or performing work.

## 0.2.0 — 2026-08-28

- Added the opt-in `nymrel.agent.route/v2` contract with required request-budget normalization, deterministic integer utilities, hard-eligibility Pareto frontiers, frontier-only selection, and exact-score-only incumbent tie resolution.
- Added v2 API discovery and route surfaces, CLI and MCP opt-in entry points, examples, OpenAPI documentation, and contract-isolation coverage. `nymrel.agent.route/v1` remains unchanged.

## 0.1.3 — 2026-08-26

- Normalize cost and latency components against explicit caller ceilings when present, preventing unrelated catalog additions or removals from changing the remaining candidates' scores. Requests without a matching ceiling retain the documented eligible-set fallback. The unchanged v1 response shape discloses modes through `decisionCodes` and numeric bounds through `explanation`.

## 0.1.2 — 2026-08-26

- Preserved local endpoint-policy validation errors instead of misclassifying them as remote transport outages or internal failures.
- Added regression coverage for malformed, insecure, query-bearing, fragment-bearing, and credential-bearing hosted endpoint URLs.

## 0.1.1 — 2026-08-26

- Moved package repository and issue metadata from the suspended personal mirror to the public Nymrel organization.
- Added a release-archive export boundary so future source archives do not recursively include hosted release artifacts.

## 0.1.0 — 2026-08-25

- Promoted the independently accepted Phase 0 router into the Nymrel-owned product contract `nymrel.agent.route/v1`.
- Added deterministic balanced, quality, cost, and latency objectives with explicit score components.
- Added fail-closed validation, stable public errors, strict input and catalog bounds, and risk-class routing.
- Added the stateless Cloudflare Worker API, public documentation, OpenAPI description, and `llms.txt`.
- Added the local CLI and stable MCP v2 stdio server.
- Added a read-only, customer-local OpenAI Responses adapter with environment-variable credential loading and `store: false`.
- Added body-free local receipts, provider/output bounds, a public-route register, release verifier, deployment dry-run, and integration tests.
