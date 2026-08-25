# Reuse and duplication analysis

This candidate was approved only if it does not become a silent third router or receipt system.

## `local-agent-forge`

Useful public concepts already present:

- `TaskClassification`, `RoutingDecision`, and truthful `completed | blocked` execution outcomes.
- Stable blocker codes and an `ExecutionReceipt` joining the route with execution facts.
- Local adapter discovery and token/cost accounting.

Why its types are not imported in phase 0:

- Its route is intentionally `LOCAL | CLOUD`, includes concrete endpoints, estimates prompt/completion tokens, and centers a fixed complexity escalation threshold.
- Its execution receipt contains response text and assumes local GPU economics. The phase-0 boundary instead tests body-free receipts, explicit risk/data/capability constraints, and provider-neutral scoring.
- The current local checkout contains unrelated in-progress changes and must remain untouched.

Planned relationship if this candidate survives review: Forge becomes a local-model adapter and economics source. Its public contracts are mapped through an explicit compatibility adapter; they are not copied or replaced invisibly.

## `agent-sandstorm`

Useful public concepts already present:

- File snapshots, diffs, rollback summaries, tree hashes, spend/step budgets, and a hash-chained audit logger.
- `SandboxResult` joins rollback, audit, spend, duration, and final tree state.

Why phase 0 has a separate minimal run receipt:

- Sandstorm's receipt describes filesystem execution and rollback. Phase 0 performs no filesystem execution and needs a route/provider receipt that hashes task/output bodies without retaining them.
- Sandstorm currently launches ordinary child processes in a working directory. It is useful containment and audit middleware, but it is not the operating-system isolation required for write-capable autonomy.
- Reusing its audit hash-chain here would imply stronger tamper-evidence and execution containment than this tiny candidate proves.

Planned relationship if this candidate survives review: Sandstorm supplies an execution-evidence adapter only after its security boundary is accurately named and independently hardened. The phase-0 digest is not presented as a replacement for its audit chain.

## Canonicalization rule

Before promotion, independent review must choose one of:

1. Absorb this contract into an existing public root.
2. Promote this root as canonical and demote overlapping Forge/Sandstorm surfaces to adapters.
3. Archive this root.

Maintaining multiple canonical route or receipt schemas is not an allowed fourth outcome.
