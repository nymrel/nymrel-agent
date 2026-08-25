# Nymrel Agent phase-0 operating boundary

This repository is an internal, reversible candidate. It is not a released package or an adopted product.

## Allowed work

- Synthetic provider-neutral contracts and fixtures.
- Deterministic routing, model diagnostics, fake-provider execution, receipts, tests, and documentation.
- Dependency-install network access only.

## Prohibited work

- Do not add a git remote, package publication metadata, runtime dependency, real provider adapter, credential, environment file, deployment path, or external side effect.
- Do not copy private studio routing, coordination, handoff, council, customer, or authority artifacts into this repository.
- Do not claim this is an operating-system sandbox or a production agent.
- Do not modify `local-agent-forge` or `agent-sandstorm` from this lane.

If the work needs anything outside this repository, stop and obtain a fresh decision. One writer owns the repository until independent review is complete.

## Required validation

```powershell
npm test
npm run typecheck
npm run build
npm run verify:phase0
npm run smoke
git diff --check
git remote -v
```

Any adoption, integration, distribution, or publication requires an independent review and a new explicit decision.
