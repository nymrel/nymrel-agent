# Nymrel Agent — phase 0

Nymrel Agent phase 0 is an internal candidate for a provider-neutral agent runtime and explainable multi-model router. It proves a small, read-only vertical slice with synthetic model profiles and a fake provider.

It is deliberately not a package release, public product commitment, provider broker, coding-agent replacement, or security sandbox.

## What this candidate proves

- A stable task-to-route contract that does not contain prompts.
- Deterministic eligibility filtering, scoring, tie-breaking, and route explanations.
- A model doctor that reports adapter health without contacting a real provider.
- A fail-closed read-only runtime.
- Receipts that hash inputs, outputs, and events without storing task or output bodies.
- An offline test and CLI path using only fake adapters.

## Commands

```powershell
npm install
npm test
npm run typecheck
npm run verify:phase0

node dist/src/cli.js models doctor
node dist/src/cli.js route --local-only
node dist/src/cli.js run --task "Explain the candidate boundary"
```

The CLI file is not exposed through a package `bin` entry. `package.json` is private and contains no publication configuration or runtime dependencies.

## Safety boundary

Phase 0 can execute only requests whose profile and risk are both read-only. Workspace writes and external effects are rejected before an adapter can run. `AgentRuntime` accepts only exact instances of the deterministic `FakeProvider`; live adapters, structural lookalikes, and subclasses are rejected. No network-capable module is imported by `src/`.

This is not process, filesystem, or network isolation. A future write-capable runtime would require a separately reviewed operating-system sandbox and policy boundary.

The receipt's whole-body SHA-256 values are local correlation digests, not confidentiality controls. They can confirm a guessed low-entropy task or output, so phase-zero receipts must remain inside the trusted local boundary. Any exportable receipt design requires a separately reviewed keyed digest.

## Decision gate

The candidate remains unadopted until independent review. Its dated absorb/promote/archive deadline and default outcome are recorded in [`evidence/phase0-receipt.json`](evidence/phase0-receipt.json).
