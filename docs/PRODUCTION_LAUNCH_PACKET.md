# Nymrel Agent production launch packet

Status: replacement release candidate under final acceptance

Owner: Codex production lane under claim `codex-nymrel-agent-production-20260825`

Target release: `0.1.0`

Public contract: `nymrel.agent.route/v1`

Source branch: `codex/nymrel-agent-production-20260825`

## Decision

Launch Nymrel Agent as a public stateless multi-model routing product with customer-local provider execution and a separately scoped managed implementation service.

Decision card:

- Door type: Type 1 public launch; explicitly authorized by the operator on 2026-08-25.
- Reversibility: 4/5. Deployments and aliases can roll back and releases can be superseded, while public source disclosure cannot be made private again.
- Customer impact: developers can route against their own model evidence without giving Nymrel prompts or provider credentials.
- Simplicity check: one validated deterministic core powers API, CLI, and MCP; hosted execution, accounts, billing, and customer-data custody are excluded.
- Revenue direction: a product-led entry point plus an on-request implementation and optimization service, with no invented price.
- Risks: API abuse, malformed evidence, accidental prompt or credential custody, compatibility overclaim, remote transport mislabeled `local_only`, stale deployment bytes, and public-source disclosure.
- Mitigations: streamed bounds, exact-shape validation, public-route register, provider-native rate limiting, source-commit readiness, customer-local read-only execution, loopback enforcement for `local_only`, immutable review, offline fallback, and post-deploy proof.

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

- Production code, documentation, tests, package artifact, public GitHub repository and release, an isolated existing-account Vercel project on its default domain, and a reversible project-level WAF rule.

Still separately protected:

- npm login or trusted-publisher configuration.
- Custom-domain or DNS mutation for `agent.nymrel.com`.
- Provider keys, live customer prompts, live customer data, hosted provider execution, billing, account creation, or legal agreement acceptance.

The Vercel service and GitHub release can launch without crossing those gates. The Cloudflare adapter passes a deployment dry-run but remains undeployed until its existing token is repaired and a provider-bound source identity is designed and verified. Public documents use the Vercel project URL until the custom-domain gate is completed.

## Acceptance contract

Local gate:

```powershell
npm ci --ignore-scripts
npm run verify
npm audit --omit=dev --audit-level=high
npm pack --dry-run --json
git diff --check 4b825dc642cb6eb9a060e54bf8d69288fbee4904 HEAD
git show --check --oneline HEAD
```

`npm run verify` includes type checking, compiled tests, public-release verification, installed-tarball CLI and MCP probes, and a Cloudflare dry-run.

Independent gate:

- Review one immutable candidate commit with no concurrent writes.
- Cover public contract, streamed bounds, hosted custody, local transport custody, provider response status, rate-limit scope, source binding, bins after packed installation, authorization register, package contents, claims, and rollback.
- Fix every accepted correctness, security, compatibility, or launch-truth finding and rerun review against the replacement commit.

## Pre-promotion gate

This sequence uses Vercel's documented [staged production deployment](https://vercel.com/docs/deployments/promoting-a-deployment#staging-and-promoting-a-production-deployment) flow so the enabled build cannot take the production alias before inspection.

1. Create the public GitHub repository without an initial commit, connect the existing Vercel project to that exact repository, and enable Vercel system environment variables. Provider Git is the preferred source mode. If the existing Vercel account cannot connect GitHub without a new OAuth/login gate, record that gate and use only the `verified_cli_bundle` contingency below.
2. Configure `ROUTING_API_ENABLED=false` for production, then push the accepted commit to public `main`. An ordinary local-directory deployment is not an eligible release source. The contingency is eligible only from a clean checkout of that exact public commit when every uploaded source file and byte passes `scripts/verify-vercel-source.mjs` against Vercel's deployment inventory.
3. Inspect the resulting fallback deployment. In `provider_git` mode, require provider `gitSource`, runtime `VERCEL_GIT_COMMIT_SHA`, `/healthz`, and the accepted commit to agree. In `verified_cli_bundle` mode, require remote `main`, local `HEAD`, provider `meta.githubCommitSha`, runtime `VERCEL_GIT_COMMIT_SHA`, and `/healthz` to agree; require `meta.gitDirty` to be absent or false; and pipe the authenticated deployment inventory through the exact-byte verifier:

```powershell
npx vercel api '/v6/deployments/<deployment-id>/files?teamId=<team-id>' |
  node scripts/verify-vercel-source.mjs
```

Absence, disagreement, an unexpected file, or a byte-digest mismatch fails closed. The verifier's explicit allowlist excludes browser evidence, output, coverage, CI files, provider-local state, tests, package-only execution code, and release-only scripts.
4. Verify the fallback homepage and docs return 200, `/healthz` returns 200 with the accepted SHA, `/readyz` returns 503, and `POST /v1/route` returns the stable JSON `service_disabled` error.
5. Record the fallback deployment ID and confirm the alias reassignment command before enabling routing.
6. Stage, inspect, and publish the Vercel WAF rule `nymrel-agent-route-v1` at 120 requests per 60 seconds. Stop if Vercel presents a new pricing, billing, or legal-acceptance gate.
7. Disable **Production > Branch Tracking > Auto-assign Custom Production Domains** and verify that the offline fallback remains `Current` at `nymrel-agent.vercel.app`. Do not change the routing flag until that hold is proven.
8. Change the production routing flag to `true` and redeploy the exact accepted source through the same verified source mode as a production deployment. Require the new enabled deployment to remain `Staged`, require the stable alias to continue serving the fallback, and inspect the staged deployment directly.
9. Before promotion, repeat the applicable source-mode proof from step 3 against the staged deployment. Require `/readyz` and the canonical route fixture to pass against the staged URL, and inspect its error logs.
10. Promote only that verified staged deployment with an explicit confirmation:

```powershell
npx vercel promote <enabled-deployment-url>
```

Do not use `--yes`, `Force Promote`, or any path that bypasses the staged checks. Confirm the promoted deployment is `Current` before running the production-alias matrix.

## Post-deploy route matrix

Every registered dynamic route is checked against the production alias:

| Method | Path | Expected proof |
| --- | --- | --- |
| GET | `/healthz` | 200 JSON; version `0.1.0`; `sourceCommit` equals accepted SHA |
| GET | `/readyz` | 200 JSON; routing enabled; source SHA bound; WAF `platform_ready`; scope `deployment` |
| GET | `/v1` | 200 JSON; contract `nymrel.agent.route/v1`; route and OpenAPI links |
| GET | `/v1/openapi.json` | 200 JSON; OpenAPI `3.1.0` |
| OPTIONS | `/v1/route` | 204; origin `*`; methods `GET, POST, OPTIONS`; header `content-type` |
| POST | `/v1/route` | 200 for canonical fixture; same selected model as local CLI |
| GET | `/v1/route` | 405 JSON; `Allow: POST, OPTIONS` |

Static checks cover `/`, `/docs`, `/openapi.json`, `/llms.txt`, `/robots.txt`, and `/examples/route-request.json`, including security and content headers.

Negative checks cover malformed `Content-Length`, invalid JSON, unknown prompt fields, wrong media type, streamed payload overflow, platform rate denial, missing WAF configuration in a preview harness, and disabled fallback behavior. Errors must be JSON, include a request ID, and never echo bodies or unknown field names.

Source and install checks:

- The versioned GitHub tag and release target the accepted SHA; no source-immutability badge is claimed without a separate GitHub immutable-release receipt.
- The deployed `/healthz` and `/readyz` expose that SHA.
- Vercel inspection identifies the exact organization, project, deployment, source mode, and source SHA. `provider_git` requires the connected repository and provider `gitSource`; `verified_cli_bundle` requires the public remote commit plus an exact allowlist and SHA-1 proof for every uploaded source file.
- An unauthenticated clean checkout passes the public quickstart.
- The release tarball SHA-256 is recorded and its installed CLI and MCP bins pass on Windows and Linux CI.

## Rollback

Before promotion, record:

- enabled deployment ID and URL;
- offline-fallback deployment ID and URL;
- stable alias `nymrel-agent.vercel.app`;
- accepted source SHA;
- WAF configuration version.

On a functional or security regression:

```powershell
npx vercel alias set <offline-fallback-deployment-url> nymrel-agent.vercel.app
```

Then verify the fallback matrix above, mark the affected GitHub release superseded if the source artifact is affected, and publish a patch without rewriting released history. Restore routing only after local, independent, source-binding, and post-deploy gates pass again.

Cloudflare rollback, if that adapter is later deployed, must record the prior immutable Worker version and use Wrangler version rollback before any custom-domain route is attached. No Cloudflare production claim is made in v0.1.

## Launch evidence

The final production receipt records:

- exact source commit and tree;
- package tarball name and SHA-256;
- test, typecheck, audit, dry-run, packed-install, and committed-tree hygiene results;
- independent-review findings and replacement acceptance;
- GitHub repository, tag, and release URL;
- Vercel organization, project, enabled deployment, fallback deployment, stable alias, and WAF rule;
- full post-deploy route matrix;
- npm, custom-domain, and Cloudflare gate state;
- cleanup proof for local servers, browser automation, and reviewer processes.
