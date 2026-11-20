# Routing inside another application

`@nymrel/agent/router` first appears in package source version 0.5.0. Earlier
immutable 0.4.x package/source downloads do not contain it. Check the
[versioned GitHub release](https://github.com/nymrel/nymrel-agent/releases/tag/v0.5.0)
for publication status and assets; a source checkout or version string alone is
not proof of publication. npm registry publication is a separate gate.

## Boundary

The subpath exports the existing `route` and `routeV2` functions, the v1/v2
contract identifiers, and their input/output TypeScript types. Eligibility,
request-budget normalization, Pareto selection, reason codes and tie-breaking
remain the canonical router implementation. There is no additional routing or
receipt schema.

An application supplies model metadata and constraints. Nymrel returns a
selected identifier or a blocked plan. The caller owns the model SDK, task
content, provider credentials, retries, execution and authorization. A plan is
neither evidence that a provider was called nor permission to perform an action.
Quality, cost, health and custody labels remain supplied evidence rather than
Nymrel-certified facts. Do not put prompts or provider credentials in metadata.

Only the routing module graph is platform-independent: it imports no Node-only
module, provider SDK, CLI, MCP server or execution runtime. Installing the full
package still installs its declared dependencies. This subpath does not promise
a separate zero-dependency package.

## Install a verified versioned artifact

Once the 0.5.0 release assets are published, download `v0.5.0.json` and
`nymrel-agent-0.5.0.tgz` from the versioned GitHub release above. Compare the
package's SHA-256 and byte count with the manifest before installing the local
file. These commands assume the verified package is in the current directory:

```text
npm install --ignore-scripts ./nymrel-agent-0.5.0.tgz
```

A GitHub release artifact is installable without an npm account. Do not use
`npm install @nymrel/agent@0.5.0` unless that exact version is also published to
the public registry. Release publication does not establish a hosted-service
upgrade; `/healthz` reports that service's own version and source identity.

## Build and install an exact source candidate

From a clean canonical checkout, follow [the development guide](../CONTRIBUTING.md)
and preserve its origin/toolchain checks. Run:

```text
corepack npm@11.19.1 ci
corepack npm@11.19.1 run typecheck
corepack npm@11.19.1 test
corepack npm@11.19.1 run verify:candidate
corepack npm@11.19.1 run verify:candidate-packed-install
corepack npm@11.19.1 pack --ignore-scripts --pack-destination /path/to/new-artifacts
```

The complete `npm run verify` release gate runs from the later canonical carrier
checkout with Git history and its reviewed versioned downloads. Release-source
commits precede that artifact carrier, and source archives exclude downloads;
the source-only commands above are not a release-verification receipt.

Keep the tarball's SHA-256 and full source revision. In a separate application
directory, install that exact tarball rather than a registry version:

```text
npm install --ignore-scripts /path/to/new-artifacts/nymrel-agent-0.5.0.tgz
```

The directory names are examples; use absolute paths appropriate to your host.
Do not replace or regenerate the committed immutable downloads for this check.

## Node orchestration consumer

Copy the packaged `examples/router-node-consumer.mjs` into the application
directory and run it with a metadata-only fixture:

```text
node router-node-consumer.mjs node_modules/@nymrel/agent/examples/route-request-v2.json
```

It imports only `@nymrel/agent/router`, emits the selected identifiers and
explanation, and exits `2` for a blocked plan. It invokes no provider. Replace
the sample catalog with evidence you control before applying the result to a
real workflow.

## Inspect a local plan

The following CLI view is an **unreleased source addition** after the committed
0.5.0 candidate tarball. Use a tarball built from the current reviewed source;
the earlier versioned download does not contain `--format summary`.

From the separate application directory after installing that local tarball:

```text
node node_modules/@nymrel/agent/dist/src/bin/nymrel-agent.js route --contract-version v2 --file node_modules/@nymrel/agent/examples/route-request-v2.json --format summary
```

The first lines identify the decision without requiring a JSON viewer:

```text
Nymrel Agent routing · SELECTED
Metadata only. No provider call or execution authorization.
Contract: nymrel.agent.route/v2 · objective: balanced
Selected: provider-b/fast (provider: provider-b)
Caller catalog estimate: 12000 microUSD (USD 0.012000) · latency 900 ms
Requested ceilings: cost 50000 microUSD (USD 0.050000) · latency 10000 ms
Models: 3 · eligible: 2 · rejected: 1
Pareto frontier: 2 model(s); selection uses only that frontier.
```

The remaining lines show canonical eligible scores and rejected reason codes.
At most eight entries from each group are displayed; omission counts point you
to `--format json` for every candidate and score component. The summary never
copies caller health descriptions or input paths into its output. Model facts
are still caller-supplied, and scores are neither benchmarks nor directly
comparable across different requests. Cost amounts are caller catalog estimates
and requested ceilings: 1 USD equals 1,000,000 microUSD. Latency is in milliseconds.
Zero cost differs from an unset ceiling; an unset ceiling is shown as `not set`.
Validate the catalog evidence before execution; these are not measured charges
or latency guarantees. Changing objectives need not change the selected model.

If every model is rejected, the summary reports `BLOCKED`, includes rejection
codes and exits `2`. Inspect those codes and the catalog evidence against your
required constraints; do not treat missing eligibility as permission to execute.
Malformed metadata stays an error (`65`), distinct from a valid blocked plan.
JSON is still the default; `--format json` preserves its existing output and
exit behavior, including exit `0` for a valid blocked plan. Scripts that need a
process-level blocked signal can select summary mode or inspect JSON
`plan.selectedModelId` explicitly. Summary mode rejects `--endpoint` before
reading input or calling a network endpoint; use JSON for remote routing.

## Browser and worker consumer

An ESM bundler can import the same entry point in a module Worker:

```javascript
import { routeV2 } from '@nymrel/agent/router';

self.onmessage = ({ data }) => {
  self.postMessage(routeV2(data.request, data.models));
};
```

Save the module as `router-worker.mjs` in the application directory. Bundle it
with your existing ESM browser toolchain to `router-worker.bundle.mjs`; resolve
`@nymrel/agent/router` from the locally installed package. Neither Node shims nor
the Nymrel runtime are needed for the routing graph. Load it from your
application's page:

```javascript
const worker = new Worker('./router-worker.bundle.mjs', { type: 'module' });
worker.onmessage = ({ data: plan }) => {
  if (plan.selectedModelId === null) {
    // No catalog entry satisfied the supplied constraints.
  } else {
    // Keep provider calls and execution authorization in your application.
    console.log(plan.selectedModelId);
  }
};
worker.onerror = () => { /* Handle malformed metadata or a worker load error. */ };
worker.postMessage({ request: requestMetadata, models: modelCatalog });
```

Serve the page and worker over your application's HTTP development server;
loading a module worker from `file://` is not supported by browsers. The request
and catalog have the same shape as the packaged `examples/route-request-v2.json`.
This is a metadata-only worker; task bodies and model calls stay with your
application.

## Local graphical workbench

The local workbench is an **unreleased source/dev example**, absent from the
existing 0.5.0 candidate archives. It adds an original Nymrel interface around
the existing router, not a second selection algorithm or hosted gateway. Run it
from the current reviewed source checkout after its origin/toolchain checks:

```text
corepack npm@11.19.1 ci
corepack npm@11.19.1 run workbench -- --port 0
```

The runner prints its loopback-only URL and serves four fixed in-memory assets.
It starts no provider adapter, accepts no routing POST, and reads no user-selected
file on the server. Close it with Ctrl+C. To choose a fixed port, replace `0`
with an available local port; restart the runner after editing source. This
command needs development dependencies and compiled source, so do not assume a
production-only installed package can run it.

### Try one policy change

1. The packaged synthetic v2 catalog selects `provider-b/fast` with a caller
   estimate of USD `0.012000` and `900 ms` under USD `0.050000` / `10000 ms`
   ceilings. These are fixture facts, not current provider pricing or benchmarks.
2. Set the cost ceiling to USD `0.010000`. The valid result becomes **Blocked**;
   inspect the rejection codes, then use **Reset example** to recover.
3. Try another objective. The same example can keep the same winner; an objective
   changes weights, not a promise that selection changes.
4. Clear either ceiling to remove that optional constraint. An explicit `0`
   stays zero; it is never treated as unset. USD inputs keep up to six decimal
   places exactly, and latency uses whole milliseconds from `0` to `600000`.
   A seventh decimal or invalid field produces **Invalid input**, distinct from
   a valid blocked plan.
5. On a narrow screen, use **View decision** to move directly from the controls
   to the result. Keyboard controls, focus outlines and text state labels are
   available without relying on color.

The request's positive normalization anchors stay unchanged when ceilings are
edited; open **How this choice is made** to inspect them. Candidate costs and
latencies remain caller estimates. Pareto explanations reflect the canonical
quality, reliability, health, cost and latency dimensions; no model is called.

### Import and export

Import a complete v2 `{ "request": ..., "models": ... }` envelope as a UTF-8
JSON file of at most 1 MiB. The entire object passes the existing closed payload
validator before it is stored or exported. Unknown fields, malformed UTF-8,
invalid JSON, empty/oversized catalogs and unsupported metadata are rejected.
Do not include prompts, provider credentials, task bodies or customer data.
The canonical metadata contract allows at most 100 models.

**Export metadata** downloads the current validated request/catalog; **Export
plan** downloads the matching canonical v2 plan, including a valid blocked plan.
Both are explicit local JSON downloads. Loading or invalid state clears the
active export data and disables those controls, so a previous plan cannot appear
current. Reset supersedes a pending file read. The app uses no cookies, browser
storage, URL-based imports, accounts or outbound data connection. A reload starts
again with the synthetic fixture. Imported metadata may still be sensitive;
review downloads before sharing them. A plan supplies no execution authority.

The build checks that the browser graph includes only original UI/input helpers,
the packaged synthetic fixture and the seven existing pure routing modules.
`connect-src 'none'` prevents runtime transport; the development server serves
only fixed HTML, CSS, JavaScript and a favicon. The source test suite checks graph,
numeric boundaries and loopback routes; real browser acceptance is separate from
those Node checks and from genuinely independent user adoption.

For a non-serving build/graph check:

```text
corepack npm@11.19.1 run verify:workbench
```

## Reproducible acceptance

The `npm run verify` packed-consumer gate installs the exact built
tarball outside the checkout, runs the Node consumer, checks its public types
with no Node ambient types, bundles a worker with no external/Node dependencies,
and executes the bundled worker contract in a worker-like test context. It retains
the existing CLI/MCP checks. Synthetic installed consumers demonstrate integration
readiness; they do not establish independent real-world adoption.

For the additional native Chromium module-worker check against the canonical
versioned artifact:

```text
corepack npm@11.19.1 run verify:router-browser
```

For an unarchived source candidate, run `npm run verify:router-browser -- --candidate`
instead; that result is labeled as a source candidate rather than a canonical
versioned artifact.

Set `NYMREL_ROUTER_BROWSER_BIN` to a supported Chromium executable when it cannot
be discovered. Missing or failed browser execution is an error, never a passing
skip. The native check serves only local synthetic fixtures and does not contact
a model provider. Its result names the browser/runtime and the exact bundle.
