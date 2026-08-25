# Nymrel Agent product and service contract

## Product promise

Nymrel Agent turns caller-supplied model evidence and task requirements into a deterministic, explainable route. It makes constraints and tradeoffs inspectable; it does not claim to know a universally best model.

## Public product

The public v0.1 endpoint:

- is usable without an account or API key;
- accepts exactly a route request and 1–100 model profiles;
- accepts no prompt, provider credential, file, or customer identifier field;
- filters before scoring and explains every rejected model;
- ranks under balanced, quality, cost, or latency objectives;
- requires a configured platform limiter before production readiness: a deployment-wide Vercel WAF rule on the primary endpoint or an edge-location Cloudflare binding on that adapter;
- writes no request body through application code and uses no application database;
- executes no model call.

The CLI and MCP server apply the same routing contract locally. Local execution is optional and read-only in v0.1.

## Managed implementation service

For teams that need more than the public router, Nymrel can deliver a scoped implementation covering:

1. Workflow and risk inventory.
2. Model catalog schema and evidence sources.
3. Routing objectives, constraints, and fallback policy.
4. Evaluation fixtures and decision-quality baselines.
5. Customer-local provider adapters and secret-handling runbook.
6. Receipt, observability, and review workflow.
7. Adoption verification and operator documentation.

The exact deliverables, schedule, support, and price are defined in a project brief. There is no public service price or default service-level agreement in v0.1.

## Customer responsibilities

- Supply lawful provider access and accurate model-profile evidence.
- Decide which providers and data boundaries are approved; `local_only` profiles must use a loopback adapter endpoint.
- Keep credentials in a customer-controlled secret channel.
- Review model output and retain authority over side effects.
- Replace the conservative placeholder facts in the example local config.

## Nymrel responsibilities in a scoped engagement

- Preserve the agreed custody and authorization boundary.
- Label estimates and evidence sources honestly.
- Test routing and adapters against approved fixtures before live use.
- Avoid placing credentials or body content in source, receipts, or ordinary logs.
- Document acceptance evidence and known limitations.

## Exclusions from v0.1

Hosted provider-key custody, user accounts, billing, customer-data storage, write-capable tools, shell access, filesystem mutation, outreach, purchases, deployments, and autonomous external side effects. None is implied by the words "agent" or "managed service."

## Support and security

General and security contact: `contact@jalenbuilds.com`. Security reports follow `SECURITY.md`. The open-source code is provided under the MIT license; a managed engagement uses its own agreed commercial terms.
