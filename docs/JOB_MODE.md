# Job Mode (local plan only)

Job Mode converts a body-free, multi-step manifest into deterministic routing decisions. It is designed for workflows such as a 48-hour game-building loop, where model selection needs to make sense across research, planning, implementation, review, and handoff.

```powershell
node dist/src/bin/nymrel-agent.js job plan --file examples/job-48h-game-builder.json
node dist/src/bin/nymrel-agent.js job plan --file examples/job-48h-game-builder.json --format summary
```

The manifest contains exactly `contractVersion`, `jobId`, `models`, and `steps`. A step contains only `stepId`, ordered `dependsOn`, and the existing `nymrel.agent.route/v2` request. It cannot contain a prompt, task body, provider credential, file path, output, customer identifier, or arbitrary metadata. Unknown fields fail closed. A manifest contains 1–32 ordered steps, 1–100 caller-supplied model profiles, and at most 256 KiB of JSON.

Each step is routed with the existing v2 eligibility filters, request-budget normalization, Pareto frontier, and deterministic selection. Job Mode makes no network or provider call. Read steps are labeled `local_read_only_eligible`; `workspace_write` and `external_side_effect` steps are labeled `external_handoff_required`. Those labels are planning boundaries, not authorization to execute. A plan with any unroutable step is `blocked`; the CLI still prints the full deterministic plan and returns exit code `2`.

The command also emits a body-free plan receipt containing only digests, counts, ordinal route-plan digests, selected provider/model identifiers, reason codes, and a creation time. Digests are local integrity and correlation handles, not encryption. The full manifest and plan remain local.

## Lifecycle envelopes

Lifecycle starts only after Job Mode has produced a routable plan. There is no hosted endpoint, scheduler, provider adapter, background process, or file writer. Each command reads bounded JSON and prints the next envelope; the caller retains it.

```powershell
node dist/src/bin/nymrel-agent.js job lifecycle init --file examples/job-48h-game-builder.json --at 2026-08-28T20:00:00.000Z
node dist/src/bin/nymrel-agent.js job lifecycle checkpoint --state-file state.json --file examples/lifecycle-checkpoint.example.json
node dist/src/bin/nymrel-agent.js job lifecycle complete --state-file state.json --file examples/lifecycle-terminal.example.json
```

The lifecycle state contains job, manifest, and plan SHA-256 digests; step counts and completed ordinals; bounded metrics; timestamps; and an idempotency history. It deliberately excludes job and step identifiers, provider/model facts, prompts, tasks, outputs, context, paths, URLs, customer data, identities, and studio authority state. Exact duplicate idempotency keys replay their original receipt; a reused key with different canonical input fails closed. Terminal completion requires at least one checkpoint, every planned ordinal, passed validation, and evidence digest.

State and receipt hashes provide local integrity and correlation, not confidentiality, freshness, or authorization. Keep the latest state private and do not infer that a `completed` receipt executed any provider or side effect.

The `plan_job` MCP tool is stdio-only and read-only. It uses the same 256 KiB body-free manifest parser and returns a plan without a timestamped receipt. Nymrel does not send arguments over its network, but an MCP host may retain the arguments it receives.

The hosted API does not accept Job Mode manifests. The local stdio-only MCP `plan_job` tool does accept the same bounded body-free manifest, but it creates no hosted state. Job Mode adds no hosted storage, account, queue, credential custody, tool execution, resume mechanism, or autonomous side effect. Exactly one terminal transition applies to a caller's retained latest state lineage; stale copies can fork because v0.4 has no authority or persistence service.
