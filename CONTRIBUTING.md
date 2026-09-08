# Contributing

Issues and focused pull requests are welcome. Before proposing a change, preserve the boundaries in `AGENTS.md`: the public API remains metadata-only, the current local execution boundary remains read-only, and model-profile facts remain caller-supplied evidence.

Use Node.js `>=22 <25`; `.node-version` records the preferred Node 24 patch. Enable the repository-aware Corepack shim so `packageManager` selects the reviewed npm version before running any package command:

```powershell
corepack enable npm
npm --version
```

The version check must print `11.19.1`. Dependency install scripts fail closed unless an exact locked version appears in `allowScripts`; a dependency update that changes `esbuild` or `workerd` must receive a new pinned approval after review.

Run the complete local gate:

```powershell
npm ci
npm run verify
npm run audit
npm pack --dry-run
git diff --check 4b825dc642cb6eb9a060e54bf8d69288fbee4904 HEAD
git show --check --oneline HEAD
```

Changes to the public contract require a versioning decision, updated OpenAPI and examples, compatibility tests, and a changelog entry. New provider adapters must use customer-local credentials, sanitize provider errors, avoid body-bearing receipts, and include recorded-fixture or mock conformance tests before any live canary.

Security reports belong in the private channel described in `SECURITY.md`, not a public issue.
