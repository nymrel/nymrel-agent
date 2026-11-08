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
