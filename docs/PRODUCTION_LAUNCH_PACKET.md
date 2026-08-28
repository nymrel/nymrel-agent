# Nymrel Agent production launch packet

Status: v0.2.0 remains current in production at `https://nymrel-agent.vercel.app`; v0.3.0 Job Mode is published on GitHub but its staged deployment was not promoted after the mobile browser gate found documentation overflow; v0.3.1 has independently accepted patch source and reproducible local artifacts but no accepted carrier, public release, deployment, or promotion yet

Owner: Codex Job Mode patch release-integration lane under claim `codex-nymrel-agent-job-mode-v031-source-20260828`

Target release: `0.3.1`

Public contracts: `nymrel.agent.route/v1` and opt-in `nymrel.agent.route/v2`

Source branch: `codex/nymrel-agent-job-mode-v031-20260828`

## v0.3.1 local carrier-preparation receipt — 2026-08-28

- Independently accepted patch source: `efcc9482ed0a7add39e2f7946564d5aa1f9d57f0`. Separate runtime and security/custody reviews confirmed the direct-child patch changes only mobile documentation CSS, version surfaces, the changelog, and regression assertions. Job Mode, receipts, routing, MCP, provider adapters, authorization, and custody boundaries remain unchanged.
- Mobile fix: the single-column documentation grid now uses `minmax(0, 1fr)`, `.prose` may shrink, and long inline code tokens wrap without clipping or changing the existing scrollable `<pre>` behavior. An independent local Playwright check at 390x844 measured document and body scroll widths of exactly 390 pixels.
- Reproducible artifacts: package `nymrel-agent-0.3.1.tgz` is 54,227 bytes with SHA-256 `974b6b27036c09d680405100fdd1d2a8e4a93b507f4627e8108e2de2f2be4332`; source archive `nymrel-agent-v0.3.1-source.tar.gz` is 182,934 bytes with SHA-256 `fad20538ef62ab42196bd78ced700e6752573a7e5b987e97f5e71a4f27274fc7`; manifest `v0.3.1.json` is 571 bytes with SHA-256 `b2b18236dc87bfeb10e7484c6ab2837b960a0c38a0696d5505367f2917b87003`.
- Release hold: these local artifacts are not publication or deployment proof. The exact carrier must pass canonical verification, artifact reproduction, independent carrier acceptance, GitHub exact-byte publication, and a new staged browser/source/runtime gate before production promotion.

## v0.3.0 public release and held staging receipt — 2026-08-28

- Independently accepted release source: `4357722ae581203e9a560a777979d07ad8257de6`. The source review passed type checking, all 83 tests, candidate packed-install CLI/MCP/Job Mode probes, a Cloudflare deployment dry-run, npm audit with zero reported vulnerabilities, and committed-tree checks.
- Product change: additive local plan-only Job Mode accepts a bounded body-free ordered manifest, reuses the v2 router for each step, emits a body-free correlation receipt, and labels non-read steps as external handoffs. It does not schedule, persist, resume, call a provider, execute a tool, or widen the hosted API or MCP surface.
- Reproducible artifacts: package `nymrel-agent-0.3.0.tgz` is 54,070 bytes with SHA-256 `b86d8ba19fa753585be344b1f5b7bf10b6d9fb17dbe2308c8eb7feb67c3b1785`; source archive `nymrel-agent-v0.3.0-source.tar.gz` is 181,502 bytes with SHA-256 `84a1e6275c9a98ad323f0bf4eff3debba75c9c0308d3cf0a5b44c08304c7a3b8`; manifest `v0.3.0.json` is 571 bytes with SHA-256 `59afa6910d2ca5dc284bd97818facdd861cdd9454a67748d41cd0953c4e6ebe6`. A second local build reproduced both binary artifacts byte-for-byte.
- Public release: canonical GitHub `main` reached carrier `4e0eef5b67dde8ed3785327e96eb86a63666ea9d`; annotated tag `v0.3.0` peels to the accepted source; `https://github.com/nymrel/nymrel-agent/releases/tag/v0.3.0` serves all three reviewed assets with GitHub-reported sizes and SHA-256 digests matching the local manifest.
- Held stage: verified CLI deployment `dpl_CH2tSuzKM4guMnUVLQgpoGDtsc1H` at `https://nymrel-agent-3pp78x1rq-jalens-projects-0ade4450.vercel.app` bound carrier `4e0eef5b67dde8ed3785327e96eb86a63666ea9d`, passed the authenticated 49-file inventory, health, readiness, both route contracts, prompt non-echo, and 32 contracted exact public-file checks. The homepage passed 1440x1000 and 390x844 browser checks, but `/docs` measured a 605-pixel scroll width at a 390-pixel viewport. The stage was never promoted; `nymrel-agent.vercel.app` remained on ready v0.2.0 throughout.

## v0.2.0 production receipt — 2026-08-28

- Accepted release source: `c5850361b19f72315b22bbe2794530d9415897ff`; the public annotated tag `v0.2.0` peels to that exact commit. Accepted deployment carrier: `7a0ccf87953d1ea7c8d95789dacba35c872b4970`. Canonical GitHub `main` was fast-forwarded to the carrier before deployment.
- Public release: `https://github.com/Nymrel/nymrel-agent/releases/tag/v0.2.0`. GitHub reports the package at 48,373 bytes with SHA-256 `d0a31ea20fccc62496408ee9b52266749f1be81689fa0d8b782c13d8147327aa`, the source archive at 168,956 bytes with SHA-256 `06a4a89f36bbe6b4ae4858a48a7c770c1b3780d235e0cd9036cdbfc1fab5244b`, and the 571-byte manifest with SHA-256 `29fc8b59a828fd7ef168dc388cb821a27b6afc2a3bcb221e94d1d23a63377727`.
- Independent acceptance: exact source and carrier review reproduced the source archive and package byte-for-byte, preserved every v0.1.3 artifact, passed 75 tests, packed-install probes, a production dependency audit with zero vulnerabilities, and the Cloudflare dry-run. Two carrier candidates were held until the Vercel v2-example inventory and active 0.2.0 launch matrix were complete.
- Fail-closed stage: deployment `dpl_Ecf9z1QtHW1oigLKjDiM8rZDPZff` returned 0.2.0 content but an empty runtime source commit. `/readyz` returned 503 and the deployment was never promoted.
- Accepted offline fallback: deployment `dpl_34K7geZVVaBJ2DoREoNZ2eUBSNnL` at `https://nymrel-agent-rha0wz181-jalens-projects-0ade4450.vercel.app` binds the exact carrier, passes the authenticated 45-file source inventory, keeps routing disabled, and returns the stable `service_disabled` response. During fallback inspection, `nymrel-agent.vercel.app` remained on ready v0.1.3.
- Accepted enabled stage and production deployment: `dpl_87a26L8xqx5KeGBS1JDsB8Nup8ia` at `https://nymrel-agent-pb9mm63u7-jalens-projects-0ade4450.vercel.app`, deployed through `verified_cli_bundle`, inspected while staged, then promoted without a rebuild to `https://nymrel-agent.vercel.app`. Provider metadata, clean authenticated remote `main`, uploaded bytes, `/healthz`, and `/readyz` all bind carrier `7a0ccf87953d1ea7c8d95789dacba35c872b4970`.
- Production API proof: all 12 registered health/readiness/v1/v2 discovery, OpenAPI, CORS, method, and route checks passed. The unchanged v1 and opt-in v2 fixtures both select `provider-b/fast`; the v2 winner is a member of `paretoFrontierModelIds`. Invalid JSON, an unknown prompt field with a non-echoed sentinel, wrong media type, and oversized input fail with the expected body-safe errors.
- Exact-byte proof: 14 public docs, discovery, example, image, key, package, source, and manifest paths matched the reviewed local bytes on both the staged URL and production alias. The authenticated Vercel upload inventory contains exactly 45 reviewed files.
- Platform protection: Vercel Firewall rule `rule_nymrel_agent_route_sdk_wUzADh` remains active at 120 requests per 60 seconds keyed by IP. Both v1 and v2 use the same registered SDK rate-limit ID; staged and production readiness report `platform_ready` with deployment scope. No firewall draft or pricing gate was created.
- Browser proof: 1440x1000 desktop and 390x844 mobile runs completed the live example on staging and production, showed feedback only after success, selected `provider-b/fast`, produced zero console errors or warnings, stored no cookies/local storage/session storage, and had no horizontal overflow. All Playwright CLI sessions were closed after acceptance.
- Private-boundary proof: this release changes only the public metadata router. It does not enable the separate private handoff, accept prompts or client content on public routes, custody provider credentials, or confer execution authority.
- Rollback targets: use offline 0.2.0 deployment `dpl_34K7geZVVaBJ2DoREoNZ2eUBSNnL` for a current-version routing kill switch, or prior ready v0.1.3 deployment `dpl_3WM4Byq4QKmVbyhZiqWjU1LKi7iC` for a version rollback. Alias reassignment remains the reversible rollback action.

## v0.2.0 local release-preparation receipt — 2026-08-28

- Exact release source: `c5850361b19f72315b22bbe2794530d9415897ff`. Package artifact: 48,373 bytes with SHA-256 `d0a31ea20fccc62496408ee9b52266749f1be81689fa0d8b782c13d8147327aa`; source archive: 168,956 bytes with SHA-256 `06a4a89f36bbe6b4ae4858a48a7c770c1b3780d235e0cd9036cdbfc1fab5244b`.
- Contract change: v1 remains byte/shape-compatible with v0.1.3. The opt-in v2 route requires request-budget anchors, computes a deterministic Pareto frontier after hard eligibility, selects only from that frontier, and exposes separate HTTP, CLI, and MCP entry points.
- This repository-local carrier is not a publication or deployment receipt. Tagging, GitHub release assets, remote push, staging, provider inventory, runtime probes, promotion, and production-alias proof remain protected gates.

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
- First-independent-user evidence: an identifiable external tester confirmed using the product with a real model list and independently reported the catalog-relative scoring defect that this patch closes. The operator confirmed the tester has no connection to Nymrel and that their only prior context was interaction with Jalen on X. The private identity and user-authored receipt remain outside the public repository. This closes the global first-independent-user milestone, but the direct-message receipt does not prove Growth Experiment #3's exact product UTM attribution.
- Experiment hold: the product-attributed experiment remains open with zero qualifying receipts through its original September 8 stop-loss. The independent-user proof is not claimed as organic acquisition, a campaign conversion, a testimonial, product-market fit, or a repeatable distribution channel.

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
- Adoption status: one identifiable independent external user is verified as of 2026-08-26 through intentional use against a real model list and a human-verifiable user-authored receipt. The identity and private message remain unpublished, and no broader adoption claim is made.

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
6. Customer-local, plan-only Job Mode CLI for deterministic multi-step routing plans and body-free receipts.

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
- Record two independent verdicts before production status changes: one names the exact `releaseSourceCommit` SHA and verifies the release artifacts; the other names the exact `deploymentSourceCommit` SHA and verifies provider metadata, runtime `VERCEL_GIT_COMMIT_SHA`, uploaded inventory, and the route/static matrix. A single combined review or one SHA is insufficient.
- Fix every accepted correctness, security, compatibility, or launch-truth finding and rerun review against the replacement commit.

## Pre-promotion gate

This sequence uses Vercel's documented [staged production deployment](https://vercel.com/docs/deployments/promoting-a-deployment#staging-and-promoting-a-production-deployment) flow so the enabled build cannot take the production alias before inspection.

1. Verify the public GitHub mirror and its exact refs. Provider Git is preferred only after the existing Vercel project is explicitly connected to that repository. Until that connection is proven, use only the `verified_cli_bundle` contingency below.
2. Configure `ROUTING_API_ENABLED=false` for production, push the accepted commit to authenticated remote `main`, and publish the exact versioned source and package artifacts plus their digest manifest on the Vercel service. An ordinary local-directory deployment is not an eligible release source. The contingency is eligible only from a clean checkout of that exact remote commit when every uploaded source file and byte passes `scripts/verify-vercel-source.mjs` against Vercel's deployment inventory.

For a `verified_cli_bundle` stage, explicitly pass the hosting carrier to the deployment runtime and preserve it in metadata. A local shell assignment alone does not bind the deployed runtime. Use the project selector, not the personal-account `--scope` form (which errors in this account context):

```powershell
$carrier = git rev-parse HEAD
npx vercel deploy --prod --skip-domain --project nymrel-agent --env "VERCEL_GIT_COMMIT_SHA=$carrier" --meta "githubCommitSha=$carrier"
```

In `provider_git` mode, require Vercel's provider-supplied `VERCEL_GIT_COMMIT_SHA` and `gitSource` to agree with the carrier. In `verified_cli_bundle` mode, `--env` is the explicit runtime input and `--meta githubCommitSha` is metadata only; require `/healthz`, provider metadata, authenticated canonical `main`, local `HEAD`, and the uploaded inventory to all equal `$carrier`. `--skip-domain` holds the stable alias away from the staged CLI deployment; it does not promote, prove, or mutate `nymrel-agent.vercel.app`.
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
| GET | `/healthz` | 200 JSON; version `0.3.1`; `sourceCommit` equals the accepted `deploymentSourceCommit` |
| GET | `/readyz` | 200 JSON; routing enabled; source SHA bound; WAF `platform_ready`; scope `deployment` |
| GET | `/v1` | 200 JSON; unchanged contract `nymrel.agent.route/v1`; route and OpenAPI links |
| GET | `/v1/openapi.json` | 200 JSON; OpenAPI `3.1.0` |
| OPTIONS | `/v1/route` | 204; origin `*`; methods `GET, POST, OPTIONS`; header `content-type` |
| POST | `/v1/route` | 200 for unchanged canonical fixture; same selected model and v1 response shape as local CLI |
| GET | `/v1/route` | 405 JSON; `Allow: POST, OPTIONS` |
| GET | `/v2` | 200 JSON; contract `nymrel.agent.route/v2`; route and OpenAPI links |
| GET | `/v2/openapi.json` | 200 JSON; OpenAPI `3.1.0` |
| OPTIONS | `/v2/route` | 204; origin `*`; methods `GET, POST, OPTIONS`; header `content-type` |
| POST | `/v2/route` | 200 for the published v2 fixture; selected model is in `paretoFrontierModelIds` |
| GET | `/v2/route` | 405 JSON; `Allow: POST, OPTIONS` |

Static checks cover `/`, `/docs`, `/demo.js`, `/sitemap.xml`, `/openapi.json`, `/llms.txt`, `/robots.txt`, `/examples/route-request.json`, `/examples/route-request-v2.json`, `/og-image.png`, `/og-image.svg`, and `/0e2a8eae9dfa779ba2f3282c3c6e3d2d.txt`, including exact uploaded bytes plus content type, cache, and security headers. The staged deployment and production alias must both return the social image at exactly 1200×630 and the UTF-8 IndexNow key file with an exact body of `0e2a8eae9dfa779ba2f3282c3c6e3d2d`; a successful IndexNow response proves receipt only, not crawl, index, rank, citation, or recommendation.

Browser activation checks load the staged homepage at desktop and mobile viewports, run the published example through the visible control, require the expected `provider-b/fast` result and feedback link, and confirm zero console errors, cookies, local storage, or session storage. The feedback link must remain hidden until a successful route.

Negative checks cover malformed `Content-Length`, invalid JSON, unknown prompt fields, wrong media type, streamed payload overflow, platform rate denial, missing WAF configuration in a preview harness, and disabled fallback behavior. Errors must be JSON, include a request ID, and never echo bodies or unknown field names.

Source and install checks:

- `releaseSourceCommit` must equal `efcc9482ed0a7add39e2f7946564d5aa1f9d57f0`, the v0.3.1 package and source release. The public Vercel release manifest must bind that commit to the canonical package (54,227 bytes, SHA-256 `974b6b27036c09d680405100fdd1d2a8e4a93b507f4627e8108e2de2f2be4332`), source archive (182,934 bytes, SHA-256 `fad20538ef62ab42196bd78ced700e6752573a7e5b987e97f5e71a4f27274fc7`), and manifest (571 bytes, SHA-256 `b2b18236dc87bfeb10e7484c6ab2837b960a0c38a0696d5505367f2917b87003`). The public GitHub tag must peel to the same source, and all three downloaded GitHub release assets must match the manifest or their recorded exact bytes. No source-immutability badge is claimed unless the provider reports one.
- `deploymentSourceCommit` identifies the accepted hosting carrier. The v0.3.1 source archive contains the product, hosted activation source, and release tooling from `releaseSourceCommit`, while the committed export boundary excludes `public/downloads/` and prevents recursive archive inclusion. The later carrier adds the generated v0.3.1 artifacts and switches customer-facing download pointers without changing the accepted v1 or v2 route contracts. At deployment time, provider metadata, authenticated remote `main`, clean local `HEAD`, the uploaded-source inventory, `/healthz`, and `/readyz` must all bind the exact carrier commit rather than implying that `releaseSourceCommit` reproduces the live hosting surface byte-for-byte.
- Vercel inspection identifies the exact organization, project, deployment, source mode, and `deploymentSourceCommit`. `provider_git` requires the connected repository and provider `gitSource`; `verified_cli_bundle` requires authenticated remote `main`, local `HEAD`, provider metadata, runtime probes, and the accepted hosting commit to agree, plus an exact allowlist and SHA-1 proof for every uploaded source file.
- An unauthenticated download and install from the Vercel-hosted package passes the public quickstart; the Vercel-hosted source archive expands to the recorded release source.
- The release tarball SHA-256 is recorded and its installed CLI and MCP bins pass the Windows packed-install gate. The public repository carries the pinned Linux/Windows GitHub Actions workflow, but no public CI proof is claimed while the provider-level Actions gate remains closed.

## v0.3.1 production receipt — 2026-08-28

Status: **live and current** at `https://nymrel-agent.vercel.app`.

- Release source: `efcc9482ed0a7add39e2f7946564d5aa1f9d57f0`; annotated tag `v0.3.1` peels to that commit.
- Deployment carrier: `b0ad954a8b31570da3a860f5a1ca615c86f70402`; authenticated `origin/main` and the clean deployment checkout equaled that carrier at deployment time.
- GitHub release: `https://github.com/Nymrel/nymrel-agent/releases/tag/v0.3.1`.
- Package: `nymrel-agent-0.3.1.tgz`, 54,227 bytes, SHA-256 `974b6b27036c09d680405100fdd1d2a8e4a93b507f4627e8108e2de2f2be4332`.
- Source archive: `nymrel-agent-v0.3.1-source.tar.gz`, 182,934 bytes, SHA-256 `fad20538ef62ab42196bd78ced700e6752573a7e5b987e97f5e71a4f27274fc7`.
- Manifest: `v0.3.1.json`, 571 bytes, SHA-256 `b2b18236dc87bfeb10e7484c6ab2837b960a0c38a0696d5505367f2917b87003`.
- Production deployment: `dpl_E4SWb4hgeVjJok14wsGptAkX5drJ`, immutable URL `https://nymrel-agent-be84tkaee-jalens-projects-0ade4450.vercel.app`.
- Vercel binding: project `prj_1DFbyuPG9W0ZNOrgZTZ88R79L34F`, owner `team_MkEJAArMiAM6dAEnF96D5GLE`, `verified_cli_bundle`, exact carrier metadata and runtime SHA, `READY`, and 52 uploaded source files accepted by the authenticated exact-byte inventory verifier.
- Rollback target captured before promotion: deployment `dpl_87a26L8xqx5KeGBS1JDsB8Nup8ia`, immutable URL `https://nymrel-agent-pb9mm63u7-jalens-projects-0ade4450.vercel.app`; it served v0.2.0 from source `7a0ccf87953d1ea7c8d95789dacba35c872b4970` before the alias move.
- Independent verdicts: exact source, carrier, carrier security/custody, and staged provider acceptance all returned `APPROVE_PATCH_*` against the named immutable commits and deployment.
- Local gates: typecheck, 83 tests, release verification, installed-tarball CLI/MCP probes, Cloudflare dry run, dependency audit with zero vulnerabilities, archive safety, and clean committed scope passed.
- Staged and production route proof: all 10 registered dynamic route classes passed; the canonical v1/v2 fixtures selected `provider-b/fast`; v2 preserved both accepted Pareto-frontier members; prompt-bearing input failed without echo; wrong media returned 415; unknown route returned 404; method guards and preflight passed.
- Staged and production static proof: 35 contracted public files matched the reviewed local bytes exactly; the active package is immutable-cacheable.
- Browser proof on both staged and stable production URLs: 1440px and 390px homepage layouts had no page overflow; the live control returned `provider-b/fast` and exposed the feedback link; `/docs` stayed 390px wide while its code block retained internal horizontal scrolling; cookies, local storage, session storage, console errors, and console warnings were all empty.
- v0.3.0 remains immutable published history but was never promoted: its staged browser gate found the mobile docs overflow. v0.3.1 superseded it by changing only the docs layout and matching release pointers/artifacts; routing, Job Mode, MCP, provider, receipt, API, and custody behavior stayed unchanged.

This post-promotion documentation receipt is not the deployed source. Production continues to identify carrier `b0ad954a8b31570da3a860f5a1ca615c86f70402` through `/healthz` and `/readyz`. npm publication, custom-domain changes, Cloudflare production, hosted Job Mode execution, provider-key custody, write-capable tools, accounts, billing, and adoption claims remain outside this receipt.

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
