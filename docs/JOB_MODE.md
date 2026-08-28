# Job Mode (local plan only)

Job Mode converts a body-free, multi-step manifest into deterministic routing decisions. It is designed for workflows such as a 48-hour game-building loop, where model selection needs to make sense across research, planning, implementation, review, and handoff.

```powershell
node dist/src/bin/nymrel-agent.js job plan --file examples/job-48h-game-builder.json
```

The manifest contains exactly `contractVersion`, `jobId`, `models`, and `steps`. A step contains only `stepId`, ordered `dependsOn`, and the existing `nymrel.agent.route/v2` request. It cannot contain a prompt, task body, provider credential, file path, output, customer identifier, or arbitrary metadata. Unknown fields fail closed. A manifest contains 1–32 ordered steps, 1–100 caller-supplied model profiles, and at most 256 KiB of JSON.

Each step is routed with the existing v2 eligibility filters, request-budget normalization, Pareto frontier, and deterministic selection. Job Mode makes no network or provider call. Read steps are labeled `local_read_only_eligible`; `workspace_write` and `external_side_effect` steps are labeled `external_handoff_required`. Those labels are planning boundaries, not authorization to execute. A plan with any unroutable step is `blocked`; the CLI still prints the full deterministic plan and returns exit code `2`.

The command also emits a body-free plan receipt containing only digests, counts, ordinal route-plan digests, selected provider/model identifiers, reason codes, and a creation time. Digests are local integrity and correlation handles, not encryption. The full manifest and plan remain local.

The hosted API and MCP surface do not accept Job Mode manifests. They remain metadata-only routing interfaces. Job Mode adds no hosted storage, account, queue, credential custody, tool execution, resume mechanism, or autonomous side effect.
