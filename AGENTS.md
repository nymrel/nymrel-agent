# Nymrel Agent production operating boundary

This repository is the Nymrel-owned composition root for the Nymrel Agent product and implementation service. The public product is a stateless multi-model router; optional provider execution is customer-local and read-only in v0.1.

## Allowed work

- Provider-neutral routing contracts, deterministic scoring, validation, receipts, tests, documentation, CLI, MCP, and the public routing Worker.
- Read-only local provider adapters that obtain credentials from environment-variable names in customer-owned configuration.
- Release packaging, public source publication, and deployment through the recorded production launch packet.

## Five-minute release orientation

Before any release, deployment, or public-claim work, read [`docs/ONBOARDING.md`](docs/ONBOARDING.md) and run its fail-before-work origin check. The only authoritative remote is `https://github.com/Nymrel/nymrel-agent.git`; `legacy-jalenbuildshub` is a retained historical reference and is never a release or deployment authority. Do not continue if the check fails.

## Non-negotiable boundaries

- Never commit, print, transmit to the public router, or place in receipts any provider credential, prompt, task body, output body, customer data, or private studio artifact.
- The public API accepts routing metadata only and performs no model execution.
- Local execution remains read-only in v0.1. Do not add shell, filesystem-write, browser-mutation, outreach, purchase, deployment, or other side-effect tools without a separate isolation and authorization decision.
- Do not add hosted credential custody, accounts, billing, customer-data persistence, or model brokering without a separate protected-gate decision.
- Pi, OMP, and other runtimes may be optional subordinate adapters only; they do not replace the Nymrel-owned contract, router, policy, receipts, or release authority.
- Model scores and profile facts are caller-supplied evidence. Do not present them as Nymrel benchmarks or universal truth.

## Required validation

```powershell
npm ci
npm run verify
npm pack --dry-run
git diff --check
```

Production claims require separate exact-SHA independent verdicts for the release source and deployment carrier, a deployed health/readiness/API probe, and a rollback path. Provider, npm, DNS, billing, legal-acceptance, secret, and customer-data steps retain their recorded principal gates.
