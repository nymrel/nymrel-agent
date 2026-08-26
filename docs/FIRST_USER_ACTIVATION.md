# Nymrel Agent first-user activation

## Decision and ownership

- Council decision: `council-20260826-61ff97ca` — cross-family `APPROVE` with conditions.
- Principal owner: Jalen, under the direct 2026-08-25 operator instruction to continue through the first verified user.
- Execution owner: Codex App, claim `codex-app-nymrel-agent-patch-release-20260826`.
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

## Buyer and offer map

- Initial buyer: an engineering or AI-platform lead operating multiple models who needs an inspectable cost, quality, latency, capability, or custody decision.
- Free proof: the metadata-only router, versioned MIT source, package, CLI, MCP server, OpenAPI contract, and live browser example.
- Current paid path: a custom Nymrel implementation brief covering catalog design, policy, evaluation, customer-local adapters, and operational receipts. Scope and pricing remain on request.
- Fixed-scope audit gate: do not advertise a fixed-price or fixed-scope audit until Jalen locks its price, deliverable, exclusions, schedule, and engagement ceiling.
- Future managed cloud: held. Any hosted keys, prompts, execution, accounts, or data retention require a fresh custody and security decision.

## Distribution gates

- Available now: canonical product, live API, docs, OpenAPI, `llms.txt`, source archive, package archive, Nymrel catalog entry, and Nymrel brief.
- Available now: the public `Nymrel/nymrel-agent` repository, issue tracker, contribution path, and v0.1.1 release. The GitHub and Vercel package and source assets match the canonical manifest bytes and SHA-256 exactly; historical v0.1.0 artifacts remain available and byte-stable.
- Held: npm publication and provenance until an authenticated Nymrel npm account or organization path exists and the trusted-publisher CI path can run; MCP Registry publication remains held until its package prerequisite is satisfied.
- Operator-held: pricing publication, paid promotion, and any relationship-based outreach that needs Jalen's identity or account. The one @Nymrel launch canary authorized on 2026-08-26 remains separately identity-gated and does not authorize another post, reply, direct message, follow, ad, or profile change.

## Rollback truth

Within 30 minutes of owner acknowledgment, Nymrel can revert studio-controlled commits, remove campaign claims from owned surfaces, disable the live activation, and mark the experiment dormant. MIT grants on copies already obtained, external mirrors, and search or CDN caches cannot be recalled. That residual exposure is accepted because the released artifact contains no prompts, provider credentials, customer data, hosted model calls, or write-capable tools.
