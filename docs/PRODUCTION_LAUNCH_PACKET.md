# Nymrel Agent production launch packet

Status: v0.1.3 is current in production at `https://nymrel-agent.vercel.app`; verified external use exists; first-user independence classification remains pending

Owner: Codex launch lane under claim `codex-app-nymrel-agent-v013-carrier-20260826`

Target release: `0.1.3`

Public contract: `nymrel.agent.route/v1`

Source branch: `codex/nymrel-agent-budget-normalization-20260826`

## v0.1.3 production receipt — 2026-08-26

- Accepted release source: `02963d50f0a5bb9f080bfec783aa8436e17a400d`; the public annotated tag `v0.1.3` peels to that exact commit. Accepted deployment carrier: `54eed0f8858aa6a0f3a4e2db4f7ada8371223d86`, tree `7c8f9041180f0aba16f847957da7e34f4952ea3b`, with the release source as its direct parent.
- Public release: `https://github.com/Nymrel/nymrel-agent/releases/tag/v0.1.3`. GitHub `main`, tag, release metadata, and all three downloaded release assets were verified through unauthenticated public paths; the package, source archive, and manifest matched the accepted local bytes exactly.
- Package artifact: 44,032 bytes with SHA-256 `66145b09576323f667c7f76e36bb91bd09f8d251a089355c5e458a867d676385`; source archive: 159,368 bytes with SHA-256 `55760fe1be6eeffac73de4bd734ea0dd434ec88b5a48a44669bb74a36471eb2c`; manifest: 571 bytes with SHA-256 `12539566efc3597e71934314a3bd69de090267790d9a9149e14b10029da45744`. The package and source archive each reproduced byte-for-byte in a second build.
- Product change: explicit cost and latency ceilings now anchor their matching score components; requests without a ceiling retain eligible-set normalization. The closed v1 response shape remains exact, while existing `decisionCodes` and `explanation` fields disclose the selected modes and numeric bounds.
- Independent acceptance: separate security and package/runtime reviewers accepted both the exact release-source SHA and the exact carrier SHA after the first source candidate was rejected and replaced for closed-v1 compatibility and homepage-score parity.
- Local carrier gate: both TypeScript configurations, 62 tests, historical artifact pins, source-archive safety, packed-install CLI and MCP probes, production dependency audit with zero vulnerabilities, Vercel source allowlist tests, and Cloudflare dry-run passed.
- Fail-closed stage: deployment `dpl_5XGBqF1Fq7iCcdXfS9kSGhHXqQdM` returned a blank runtime source commit and `/readyz` 503. It was never promoted, and the stable alias remained on v0.1.2.
- Accepted stage and production deployment: `dpl_3WM4Byq4QKmVbyhZiqWjU1LKi7iC` at `https://nymrel-agent-jhjrx2hfg-jalens-projects-0ade4450.vercel.app`, deployed through the `verified_cli_bundle` contingency and promoted without a rebuild. Authenticated remote `main`, clean local `HEAD`, provider metadata, runtime health, readiness, and the authenticated 40-file upload inventory all bind the deployment carrier exactly.
- Abuse protection: Vercel reports one enabled custom rule, `rule_nymrel_agent_route_sdk_wUzADh`, matching rate-limit API ID `nymrel-agent-route-v1`, fixed-window 120 requests per 60 seconds keyed by IP. No unpublished firewall changes remain.
- Staged and production acceptance: all 26 Vercel-served public files matched reviewed bytes; the seven-route dynamic matrix and four negative request classes passed; the canonical route selected `provider-b/fast` with scores `8810` and `7373` and disclosed request-ceiling normalization. The production alias resolves to the accepted deployment and reports v0.1.3 with the exact carrier SHA.
- Browser acceptance: desktop and 390x844 mobile runs completed the visible route, exposed the exact UTM feedback link only after success, produced zero console errors or warnings, stored no cookies/local storage/session storage, and showed no horizontal overflow.
- External-use evidence: an identifiable external tester confirmed using the product with a real model list and independently reported the catalog-relative scoring defect that this patch closes. The private receipt is retained outside the public repository. First-user closeout remains pending confirmation that the tester has no ownership, employment, contract, or personal-favor relationship to Nymrel; the direct-message receipt does not prove the experiment's exact UTM attribution.
- Experiment hold: this maintenance patch does not restart or extend the original September 8 stop-loss and does not convert solicited or studio use into independent first-user proof.

## Launch receipt — 2026-08-26

- Public source: `https://github.com/Nymrel/nymrel-agent`; unauthenticated repository, issue, release, API, artifact, and Git reads returned successfully.
- Public release: `https://github.com/Nymrel/nymrel-agent/releases/tag/v0.1.2`; annotated tag `v0.1.2` peels to release source `c960dc34523790a34497df3f2ac222d6f7a74894`.
- Package artifact: 42,893 bytes with SHA-256 `9516c4815e0ca4daaa09cc34da7bb703e4caccf80d9e3101f065bf17a3cf513b`; source archive: 154,534 bytes with SHA-256 `bf48100858819a53df17626f12a3c3d4ae666daec6c43186155ba3b24bffe175`. GitHub, Vercel, manifest, and local bytes agree exactly.
- Served carrier: commit `0983be694e3c147baf88a4d35acc7656876e5a44`, deployment `dpl_9zeX6bkHHTknqYmEq56JMS6ZfGB3`, staged with `--prod --skip-domain` and promoted without a rebuild to `https://nymrel-agent.vercel.app`.
- Production acceptance: Vercel reports `READY`; `/healthz`, `/readyz`, and the canonical `POST /v1/route` returned 200 with the served carrier commit and deterministic selection `provider-b/fast`.
- Independent acceptance: separate security and package/runtime council lanes accepted the exact release source and carrier after reproducing the endpoint guards, deterministic source archive, historical artifact pins, package contents, CLI, and MCP contracts.
- Browser acceptance: both the staged deployment and production alias completed the visible example at desktop and mobile sizes, showed the feedback path only after success, emitted no page errors or warnings, and stored no cookies, local storage, or session storage. The Source link resolves to the public Nymrel repository.
- Exact-byte acceptance: all 23 Vercel-served public assets matched the reviewed local bytes on staging and production. The Cloudflare-only `public/_headers` control file is explicitly excluded from the Vercel bundle and returns 404 there. All retained v0.1.0 and v0.1.1 artifacts plus the new v0.1.2 package, source, and manifest remain byte-bound to their recorded digests.
- Public-byte dogfood: a fresh project installed the package downloaded from production, produced one plan across 20 repeated routes, matched local and hosted plans, rejected five unsafe endpoint classes with exit 64 before transport, emitted a body-free demo receipt, and completed MCP 2026-07-28 discovery, tool listing, and `route_models` invocation.
- Discovery status: the prior v0.1.1 IndexNow acknowledgment remains a historical submission receipt only. No v0.1.2 crawl, index, rank, citation, traffic, or recommendation claim is made.
- CI status: the pinned public workflow remains present, but GitHub returned `Actions has been disabled for this user` when manual dispatch was attempted. No GitHub Actions pass is claimed until both configured Node jobs pass for an exact public commit.
- Adoption status: no independent external user is claimed until an identifiable non-studio person or organization intentionally uses the product or workflow and that use is human-verifiable.

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

- Production code, documentation, tests, versioned source and package artifacts, a public Nymrel GitHub mirror, an isolated existing-account Vercel project on its default domain, and a reversible project-level WAF rule.

Still separately protected:

- npm login or trusted-publisher configuration.
- Custom-domain or DNS mutation for `agent.nymrel.com`.
- Provider keys, live customer prompts, live customer data, hosted provider execution, billing, account creation, or legal agreement acceptance.

The Vercel service can launch without crossing those gates and hosts the canonical versioned package, source archive, and digest manifest. The public `Nymrel/nymrel-agent` repository provides the source, issue, contribution, and release mirror; its unauthenticated Git, API, repository, issue, release, and artifact paths were verified independently on 2026-08-26. The Vercel manifest remains the canonical exact-byte artifact record. The Cloudflare adapter passes a deployment dry-run but remains undeployed until its existing token is repaired and a provider-bound source identity is designed and verified. Public documents use the Vercel project URL until the custom-domain gate is completed.

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

1. Verify the public GitHub mirror and its exact refs. Provider Git is preferred only after the existing Vercel project is explicitly connected to that repository. Until that connection is proven, use only the `verified_cli_bundle` contingency below.
2. Configure `ROUTING_API_ENABLED=false` for production, push the accepted commit to authenticated remote `main`, and publish the exact versioned source and package artifacts plus their digest manifest on the Vercel service. An ordinary local-directory deployment is not an eligible release source. The contingency is eligible only from a clean checkout of that exact remote commit when every uploaded source file and byte passes `scripts/verify-vercel-source.mjs` against Vercel's deployment inventory.
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
| GET | `/healthz` | 200 JSON; version `0.1.3`; `sourceCommit` equals accepted SHA |
| GET | `/readyz` | 200 JSON; routing enabled; source SHA bound; WAF `platform_ready`; scope `deployment` |
| GET | `/v1` | 200 JSON; contract `nymrel.agent.route/v1`; route and OpenAPI links |
| GET | `/v1/openapi.json` | 200 JSON; OpenAPI `3.1.0` |
| OPTIONS | `/v1/route` | 204; origin `*`; methods `GET, POST, OPTIONS`; header `content-type` |
| POST | `/v1/route` | 200 for canonical fixture; same selected model as local CLI |
| GET | `/v1/route` | 405 JSON; `Allow: POST, OPTIONS` |

Static checks cover `/`, `/docs`, `/demo.js`, `/sitemap.xml`, `/openapi.json`, `/llms.txt`, `/robots.txt`, `/examples/route-request.json`, `/og-image.png`, `/og-image.svg`, and `/0e2a8eae9dfa779ba2f3282c3c6e3d2d.txt`, including exact uploaded bytes plus content type, cache, and security headers. The staged deployment and production alias must both return the social image at exactly 1200×630 and the UTF-8 IndexNow key file with an exact body of `0e2a8eae9dfa779ba2f3282c3c6e3d2d`; a successful IndexNow response proves receipt only, not crawl, index, rank, citation, or recommendation.

Browser activation checks load the staged homepage at desktop and mobile viewports, run the published example through the visible control, require the expected `provider-b/fast` result and feedback link, and confirm zero console errors, cookies, local storage, or session storage. The feedback link must remain hidden until a successful route.

Negative checks cover malformed `Content-Length`, invalid JSON, unknown prompt fields, wrong media type, streamed payload overflow, platform rate denial, missing WAF configuration in a preview harness, and disabled fallback behavior. Errors must be JSON, include a request ID, and never echo bodies or unknown field names.

Source and install checks:

- `releaseSourceCommit` identifies the v0.1.3 package and source release. The public Vercel release manifest binds those artifacts to that commit plus exact SHA-256 digests. The public GitHub tag must peel to the same source, and all three downloaded GitHub release assets must match the manifest or their recorded exact bytes. No source-immutability badge is claimed unless the provider reports one.
- `deploymentSourceCommit` identifies the accepted hosting carrier. The cumulative v0.1.3 source archive includes the product, hosted activation source, and release tooling but excludes `public/downloads/` through the committed export boundary, preventing recursive archive inclusion. The later carrier adds the generated v0.1.3 artifacts and switches customer-facing download pointers without changing the accepted route contract. At deployment time, provider metadata, authenticated remote `main`, clean local `HEAD`, the uploaded-source inventory, `/healthz`, and `/readyz` must all bind the exact carrier commit rather than implying that `releaseSourceCommit` reproduces the live hosting surface byte-for-byte.
- Vercel inspection identifies the exact organization, project, deployment, source mode, and `deploymentSourceCommit`. `provider_git` requires the connected repository and provider `gitSource`; `verified_cli_bundle` requires authenticated remote `main`, local `HEAD`, provider metadata, runtime probes, and the accepted hosting commit to agree, plus an exact allowlist and SHA-1 proof for every uploaded source file.
- An unauthenticated download and install from the Vercel-hosted package passes the public quickstart; the Vercel-hosted source archive expands to the recorded release source.
- The release tarball SHA-256 is recorded and its installed CLI and MCP bins pass the Windows packed-install gate. The public repository carries the pinned Linux/Windows GitHub Actions workflow, but no public CI proof is claimed while the provider-level Actions gate remains closed.

## Rollback

Before promotion, record:

- enabled deployment ID and URL;
- offline-fallback deployment ID and URL;
- stable alias `nymrel-agent.vercel.app`;
- `releaseSourceCommit` and `deploymentSourceCommit`;
- WAF configuration version.

On a functional or security regression:

```powershell
npx vercel alias set <offline-fallback-deployment-url> nymrel-agent.vercel.app
```

Then verify the fallback matrix above, mark the affected GitHub release superseded if the source artifact is affected, and publish a patch without rewriting released history. Restore routing only after local, independent, source-binding, and post-deploy gates pass again.

Cloudflare rollback, if that adapter is later deployed, must record the prior immutable Worker version and use Wrangler version rollback before any custom-domain route is attached. No Cloudflare production claim is made in v0.1.

## Launch evidence

The final production receipt records:

- exact release-source commit/tree and deployment-source commit/tree;
- package tarball name and SHA-256;
- test, typecheck, audit, dry-run, packed-install, and committed-tree hygiene results;
- independent-review findings and replacement acceptance;
- Vercel source/package manifest and hashes, plus GitHub repository/tag/release mirror gate state;
- Vercel organization, project, enabled deployment, fallback deployment, stable alias, and WAF rule;
- full post-deploy route matrix;
- npm, custom-domain, and Cloudflare gate state;
- cleanup proof for local servers, browser automation, and reviewer processes.
