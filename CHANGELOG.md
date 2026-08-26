# Changelog

All notable product changes are documented here.

## 0.1.2 — 2026-08-26

- Preserved local endpoint-policy validation errors instead of misclassifying them as remote transport outages.
- Added regression coverage for insecure, query-bearing, and credential-bearing hosted endpoint URLs.

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
