# Nymrel Agent: five-minute production orientation

This is the release-safe starting point for this repository. It does not authorize a deployment, a release, customer data, or a private handoff.

## 1. Fail before work if identity is wrong

Run this from a clean checkout before release, deployment, or public-claim work:

```powershell
$expected = 'https://github.com/Nymrel/nymrel-agent.git'
$actual = git remote get-url origin
if ($actual -ne $expected) { throw "STOP: origin must be $expected; found $actual" }
git remote get-url legacy-jalenbuildshub 2>$null
git status --short --branch
```

`origin` is the sole canonical release authority. The optional `legacy-jalenbuildshub` remote is a non-authoritative historical mirror only: never push, tag, deploy, or compare release truth against it. A missing legacy remote is acceptable; a mismatched `origin` is a hard stop.

## 2. Keep the public boundary intact

The hosted API accepts **model-routing metadata only**. It does not accept prompts, task/output bodies, files, customer information, provider credentials, or execution authority, and it returns body-free routing receipts. Provider execution remains customer-local and read-only. Private handoff is a separately protected, disabled-by-default capability; do not treat this public release as a handoff connector.

## 3. Understand the two commits

| Term | Meaning | Required proof |
| --- | --- | --- |
| `releaseSourceCommit` | Exact commit packaged into the versioned source archive and package. | Independent source verdict naming the exact SHA, artifact digests, and contract result. |
| `deploymentSourceCommit` | Later hosting carrier commit containing the reviewed deployable bytes. | Independent carrier verdict naming the exact SHA, Vercel inventory verdict, runtime `VERCEL_GIT_COMMIT_SHA`, and route/static matrix result. |

Never substitute one SHA for the other. A production claim needs both independent verdicts, each recorded with its exact SHA, before promotion or public status changes.

## 4. Validate locally

```powershell
corepack enable npm
npm --version
npm ci
npm run verify
npm run audit
git diff --check
git show --check --oneline HEAD
```

The version check must print `11.19.1`. `.npmrc` makes engine, peer-dependency, and install-script policy fail closed; only the exact locked `esbuild` and `workerd` postinstall versions are approved. `npm run verify` checks the active version, both v1/v2 contracts and fixtures, release artifacts, public route/static matrices, the single Vercel upload registry, packed CLI/MCP behavior, workflow policy, and the Cloudflare dry run. `npm run audit` covers both runtime and development dependencies. These checks are necessary but are not a deployment receipt.

## 5. Inspect Vercel without mutating it

This read-only context probe is safe when authenticated; it must not be replaced with `link`, `pull`, `deploy`, `promote`, `alias`, or firewall commands:

```powershell
npx vercel project inspect nymrel-agent
npx vercel list nymrel-agent --limit 1 --format json
```

The project is `nymrel-agent`. Do **not** pass the personal account as `--scope`; that scope form has errored. `--project nymrel-agent` selects the known project.

## Verified CLI-bundle vocabulary and hold

`verified_cli_bundle` is a contingency source mode, not permission to deploy an arbitrary local directory. It requires a clean checkout of authenticated canonical `main`, exact uploaded-file hashes, provider metadata, the runtime source SHA, health/readiness, and a separately reviewed carrier verdict.

For a future staged CLI bundle, pass the carrier SHA to the deployment runtime explicitly and preserve the same value in Vercel metadata. The local shell assignment alone does **not** bind the deployed runtime. In `provider_git` mode, Vercel supplies `VERCEL_GIT_COMMIT_SHA` from the connected Git source; in `verified_cli_bundle` mode, `--env` is the explicit runtime input and `--meta githubCommitSha` is separately checked deployment metadata.

```powershell
$carrier = git rev-parse HEAD
npx vercel deploy --prod --skip-domain --project nymrel-agent --env "VERCEL_GIT_COMMIT_SHA=$carrier" --meta "githubCommitSha=$carrier"
```

`--skip-domain` prevents automatic stable-domain assignment during staging. It does **not** prove, change, or promote the stable alias. The stable alias is `nymrel-agent.vercel.app` and changes only through the recorded staged-promotion/rollback gate. Before any promotion, require the runtime `/healthz` source value and provider metadata to both equal `$carrier`; if either is absent or different, stop rather than treating the CLI environment input as proof.

## First safe task

Run the identity check and local validation above, then compare the active `docs/PRODUCTION_LAUNCH_PACKET.md` source/carrier verdicts against the public release and staged/production runtime evidence. Record only a read-only discrepancy; do not change account state, DNS, firewall, releases, tags, aliases, or customer data.

## Protected gates that remain protected

Provider keys, live prompts/files/customer data, private-handoff activation, npm publication, billing, legal acceptance, custom domains/DNS, Vercel project/firewall changes, release tags/assets, deployment/promotion, and stable-alias changes require their recorded authority and proof gates.
