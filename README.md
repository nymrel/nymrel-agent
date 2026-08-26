# Nymrel Agent

Nymrel Agent is an explainable multi-model router with one deterministic contract across a public API, local CLI, MCP server, and low-custody execution harness.

You supply a model catalog and explicit requirements. Nymrel Agent rejects candidates that violate health, risk, capability, data-boundary, context, modality, cost, or latency constraints; ranks the eligible set under a balanced, quality, cost, or latency objective; and returns the full explanation.

The hosted router accepts model metadata only. It does not accept prompts, provider credentials, files, or customer identifiers, and it does not execute model calls.

## Quickstart

The public routing endpoint requires no account or key:

```bash
curl -sS https://nymrel-agent.vercel.app/v1/route \
  -H "content-type: application/json" \
  --data-binary @examples/route-request.json
```

Route the same payload locally:

```bash
npm ci
npm run compile
node dist/src/bin/nymrel-agent.js route --file examples/route-request.json
```

Full documentation: <https://nymrel-agent.vercel.app/docs>

OpenAPI 3.1: <https://nymrel-agent.vercel.app/openapi.json>

Machine-readable product context: <https://nymrel-agent.vercel.app/llms.txt>

## What the result means

Routing has two stages:

1. Fail-closed eligibility filters reject incompatible profiles with stable reason codes.
2. Eligible profiles receive visible, integer score components and a deterministic tie-break.

The selected objective changes explicit weights. Explicit cost and latency ceilings also anchor their matching score components, so changing unrelated catalog membership cannot change an anchored component merely by moving the normalization range. When a ceiling is omitted, that component falls back to eligible-set normalization. Without changing the closed v1 response shape, each route receipt reports the chosen modes in `decisionCodes` and the numeric bounds in `explanation`. Model quality, reliability, cost, latency, boundary, and capability facts are caller-supplied evidence; Nymrel Agent explains how it used them but does not certify them.

## CLI

```text
nymrel-agent route --file PAYLOAD.json [--endpoint https://host]
nymrel-agent models doctor [--config CONFIG.json]
nymrel-agent run --config CONFIG.json (--task TEXT | --task-file FILE|-)
nymrel-agent contract
nymrel-agent demo
```

Local routing is the default. `--endpoint` sends the metadata-only payload to a hosted router.

## MCP

The stdio MCP server exposes two read-only tools:

- `route_models` — validate and route a `nymrel.agent.route/v1` JSON payload.
- `explain_contract` — return the stable routing and custody boundary.

Example client configuration after building from source:

```json
{
  "mcpServers": {
    "nymrel-agent": {
      "command": "node",
      "args": ["/absolute/path/to/nymrel-agent/dist/src/bin/nymrel-agent-mcp.js"]
    }
  }
}
```

## Customer-local execution

v0.1 includes an OpenAI Responses adapter for read-only local runs. The local config stores an environment-variable name, never the key value:

```powershell
$env:OPENAI_API_KEY = "set-this-in-your-secret-aware-shell"
node dist/src/bin/nymrel-agent.js run --config examples/openai-local-config.example.json --task-file -
```

The adapter calls `POST /v1/responses` from the customer's machine, requires a completed response, sets `store: false`, bounds time and response size, sanitizes provider errors, and keeps task/output bodies out of receipts. A profile that claims `local_only` custody is accepted only with a loopback base URL. The public Worker is never in this path.

The example contains `YOUR_MODEL_ID`; replace it and its caller-supplied profile facts with a model your account can use. Nymrel does not ship benchmark claims in the example.

## Security boundary

- Public API: routing metadata only, no prompt or provider execution, streamed 256 KiB and 100-model caps, strict unknown-field rejection, Vercel deployment-wide WAF rate limiting (or a Cloudflare edge-location binding), exact-source readiness, and deterministic JSON errors.
- Local runtime: read-only execution only, explicit adapters, bounded provider events/output, body-free receipts.
- Not included: hosted keys, accounts, billing, customer-data persistence, shell or filesystem-write tools, outreach, purchases, deployment tools, or autonomous side effects.
- Receipt SHA-256 values are correlation digests, not encryption or confidentiality controls.

See [SECURITY.md](SECURITY.md) for reporting and supported-version policy.

## Nymrel implementation service

Nymrel can configure evidence-backed catalogs, routing policy, evals, customer-local adapters, and operational receipts around a real workflow. Hosted execution, data retention, credentials, and write-capable tools require a separate scope and security review. Pricing is provided on request at <https://nymrel.com/brief>.

## Development and release proof

Requires Node.js 22, 23, or 24.

```powershell
npm ci
npm run verify
npm pack --dry-run
git show --check --oneline HEAD
```

`npm run verify` runs type checking, the offline/integration test suite, the release manifest and secret scan, and a Cloudflare deployment dry-run. The production Vercel adapter is exercised by the same compiled integration suite and by preview verification before promotion. Phase 0 evidence remains under `docs/PHASE0_CONTRACT.md` and `evidence/phase0-receipt.json` as historical provenance, not current product status.

## License

MIT. See [LICENSE](LICENSE).
