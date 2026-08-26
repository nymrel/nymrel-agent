# Nymrel Agent first-user activation

## Decision and ownership

- Council decision: `council-20260826-61ff97ca` — cross-family `APPROVE` with conditions.
- Principal owner: Jalen, under the direct 2026-08-25 operator instruction to continue through the first verified user.
- Execution owner: Codex App, claim `codex-app-nymrel-agent-v013-carrier-20260826`.
- Product boundary: the public router remains stateless and metadata-only. This campaign adds no accounts, customer-data store, request telemetry, hosted model execution, credentials, billing, or autonomous side effects.

## Qualifying first-user proof

A qualifying first user is one person or organization with no ownership, employment, contract, or personal-favor relationship to Nymrel that:

1. obtains Nymrel Agent from a public product, source, or package surface;
2. successfully uses the hosted router or the versioned package for a real routing decision; and
3. confirms that use in their own words through an attributable, timestamped artifact such as a project brief, email, issue, pull request, review, direct message, or public post.

Internal agents, operator or studio accounts, CI runners, crawlers, mirrors, synthetic probes, uptime checks, load tests, and favor-installs do not count. Downloads, visits, clones, and unattributed route calls are diagnostic signals only. One qualifying receipt proves a first user, not product-market fit.

The private receipt retains the minimum identity and contact evidence needed to verify independence. Public closeout material must redact personal data and link only to a public artifact when the user published it themselves or gave permission.

## Finite activation experiment

- Channel: owned product surface plus search and AI discovery.
- Hypothesis: a zero-account live browser route, versioned downloads, and an explicit feedback path will produce one independently confirmed real use without collecting request telemetry.
- Budget: no paid spend; one bounded product and documentation release.
- Success criterion: one qualifying first-user receipt.
- Measurement: successful live/product probes plus an attributable confirmation through the Nymrel brief or another user-authored artifact. Request IPs, user agents, bodies, prompts, and keys are not campaign measurement.
- Start: the production adoption timestamp for this activation slice.
- Stop-loss: 14 calendar days after production adoption. If no qualifying receipt exists, close this experiment as `LOSS`, preserve the result, and choose a different single channel. Do not leave it open or silently extend it.
- Maintenance state: v0.1.3 superseded v0.1.2 on 2026-08-26 after external use exposed catalog-relative cost normalization. Explicit request cost and latency ceilings now anchor their matching score components; ceiling-free requests retain eligible-set normalization. This patch does not restart or extend the original experiment or its September 8 stop-loss.

## External-use evidence — 2026-08-26

- An identifiable external tester confirmed using Nymrel Agent against a real model list and receiving different selections for different tasks.
- The tester independently identified that v0.1.2 normalized cost within the eligible catalog, so the most expensive eligible model received zero cost utility and removing a model could re-rank the rest. That report directly produced the v0.1.3 correction.
- The private, user-authored receipt satisfies real-use and attributable-confirmation evidence. It is not copied into the public repository and contains no prompt, project, provider credential, or customer-content payload.
- First-user closeout remains pending one relationship fact: whether the tester has any ownership, employment, contract, or personal-favor relationship to Nymrel. Until that is confirmed absent, the receipt is classified as verified external use rather than qualifying independent first-user proof.
- The direct-message receipt does not demonstrate the exact product-feedback UTM tuple, so the owned-surface activation experiment remains open under its original September 8 stop-loss.

## Buyer and offer map

- Initial buyer: an engineering or AI-platform lead operating multiple models who needs an inspectable cost, quality, latency, capability, or custody decision.
- Free proof: the metadata-only router, versioned MIT source, package, CLI, MCP server, OpenAPI contract, and live browser example.
- Current paid path: a custom Nymrel implementation brief covering catalog design, policy, evaluation, customer-local adapters, and operational receipts. Scope and pricing remain on request.
- Fixed-scope audit gate: do not advertise a fixed-price or fixed-scope audit until Jalen locks its price, deliverable, exclusions, schedule, and engagement ceiling.
- Future managed cloud: held. Any hosted keys, prompts, execution, accounts, or data retention require a fresh custody and security decision.

## Distribution gates

- Available now: canonical product, live API, docs, OpenAPI, `llms.txt`, source archive, package archive, Nymrel catalog entry, and Nymrel brief.
- Available now: the public `Nymrel/nymrel-agent` repository, issue tracker, contribution path, and v0.1.3 release. The GitHub and Vercel package, source, and manifest assets match the canonical local bytes and SHA-256 exactly; historical v0.1.0 through v0.1.2 artifacts remain available and byte-stable.
- Held: npm publication and provenance until an authenticated Nymrel npm account or organization path exists and the trusted-publisher CI path can run; MCP Registry publication remains held until its package prerequisite is satisfied.
- Operator-held: pricing publication, paid promotion, and any relationship-based outreach that needs Jalen's identity or account. The one @Nymrel launch canary authorized on 2026-08-26 remains separately identity-gated and does not authorize another post, reply, direct message, follow, ad, or profile change.

## Rollback truth

Within 30 minutes of owner acknowledgment, Nymrel can revert studio-controlled commits, remove campaign claims from owned surfaces, disable the live activation, and mark the experiment dormant. MIT grants on copies already obtained, external mirrors, and search or CDN caches cannot be recalled. That residual exposure is accepted because the released artifact contains no prompts, provider credentials, customer data, hosted model calls, or write-capable tools.
