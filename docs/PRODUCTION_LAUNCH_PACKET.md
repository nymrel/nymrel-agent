# Nymrel Agent production launch packet

Status: release candidate in active production verification  
Owner: Codex production lane under claim `codex-nymrel-agent-production-20260825`  
Target release: `0.1.0`  
Public contract: `nymrel.agent.route/v1`  
Source branch: `codex/nymrel-agent-production-20260825`

## Decision

Launch Nymrel Agent as a public stateless multi-model routing product with customer-local provider execution and a separately scoped managed implementation service.

Decision card:

- Door type: Type 1 public launch; explicitly authorized by the operator on 2026-08-25.
- Reversibility: 4/5. Worker versions can roll back and source releases can be superseded, while public source disclosure cannot be made private again.
- Customer impact: developers can route against their own model evidence without giving Nymrel prompts or provider credentials.
- Simplicity check: one deterministic core powers API, CLI, and MCP; hosted execution, accounts, billing, and customer-data custody are excluded.
- Revenue direction: a credible product-led entry point plus an on-request implementation and optimization service, with no invented price.
- Risks: API abuse, misconfigured model evidence, accidental prompt/credential custody, compatibility overclaim, and public-source disclosure.
- Mitigations: metadata-only contract, strict validation and bounds, public-route register, deployment-scoped rate limiting plus platform abuse protection, redacted application behavior, customer-local read-only execution, exact-commit review, canary deploy, and rollback receipt.
- Confidence: the Phase 0 core was independently accepted; the production surface preserves deterministic routing and body-free receipts while narrowing hosted custody.

Machine-readable card: `evidence/production-decision-card.json`.

## Product and service

Product surfaces:

1. Public, account-free `POST /v1/route` endpoint.
2. Local `nymrel-agent` CLI.
3. Stdio MCP server with `route_models` and `explain_contract`.
4. Customer-local, read-only OpenAI Responses adapter.
5. Public product page, documentation, OpenAPI 3.1, `llms.txt`, source, examples, security policy, and changelog.

Managed service:

- Evidence-backed model catalog design.
- Routing objectives, constraints, evals, and review policy.
- Customer-local provider adapter setup.
- Operational receipts and adoption verification.
- Hosted execution, credentials, retention, accounts, billing, and write-capable tools only under a separate approved scope.
- Pricing is on request; no retail price is asserted in this release.

## Authority and protected gates

Authorized in this lane:

- Production code, documentation, tests, package artifact, public GitHub repository/release, and an isolated existing-account Vercel project on its default public domain.

Still separately protected:

- npm login or trusted-publisher configuration.
- Custom-domain/DNS mutation for `agent.nymrel.com`.
- Provider keys, live customer prompts, live customer data, hosted provider execution, billing, account creation, or legal agreement acceptance.

The Vercel service and GitHub release can launch without crossing those gates. The Cloudflare adapter remains release-ready but cannot deploy until its existing token is repaired. Public documents use the Vercel project URL until the custom-domain gate is completed.

## Acceptance contract

Local gate:

```powershell
npm ci
npm run typecheck
npm test
npm run verify:release
npm run deploy:dry-run
npm audit --omit=dev --audit-level=high
npm pack --dry-run
git diff --check
```

Independent gate:

- Exact candidate commit reviewed by a separate current-generation model.
- Review must cover public contract, hosted custody, local credential path, authorization register, package contents, test adequacy, documentation claims, and rollback.
- Any high-confidence correctness, security, or launch-truth finding is fixed and the review rerun against the replacement commit.

Post-deploy gate:

- `GET /healthz` is 200 with the released version.
- `GET /readyz` is 200 and reports the rate limiter ready with its exact deployment scope.
- `GET /`, `/docs`, `/openapi.json`, `/llms.txt`, and `/examples/route-request.json` are public and carry the intended security/content headers.
- A valid route request returns the same selection as the local CLI example.
- Unknown prompt fields, wrong media type, oversized payload, wrong method, and a preview rate-limit denial produce the documented non-2xx shape without echoing bodies.
- Public GitHub source and release artifact bind to the deployed commit.
- No stale local dev server, browser automation, or tail process remains.

## Rollback

1. Record the immutable Vercel deployment ID and public alias immediately after promotion.
2. On functional or security regression, reassign the production alias to the last accepted immutable deployment.
3. Mark the affected GitHub release as superseded and publish a patch; do not rewrite released source history.
4. If the issue is in local execution only, leave the metadata-only routing service online when safe and remove the affected package artifact until a patch is accepted.
5. Re-run local, independent, and post-deploy gates before restoring the release claim.

## Launch evidence

The final production receipt will record:

- exact source commit and tree;
- package tarball name and SHA-256;
- test/typecheck/audit/dry-run results;
- independent-review verdict and reviewer identity;
- GitHub repository, tag, and release URL;
- Vercel deployment ID and public URL;
- post-deploy probe results;
- npm and custom-domain gate state.
