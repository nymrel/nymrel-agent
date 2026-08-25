# Contributing

Issues and focused pull requests are welcome. Before proposing a change, preserve the boundaries in `AGENTS.md`: the public API remains metadata-only, local execution remains read-only in v0.1, and model-profile facts remain caller-supplied evidence.

Run the complete local gate:

```powershell
npm ci
npm run verify
npm pack --dry-run
git diff --check
```

Changes to the public contract require a versioning decision, updated OpenAPI and examples, compatibility tests, and a changelog entry. New provider adapters must use customer-local credentials, sanitize provider errors, avoid body-bearing receipts, and include recorded-fixture or mock conformance tests before any live canary.

Security reports belong in the private channel described in `SECURITY.md`, not a public issue.
