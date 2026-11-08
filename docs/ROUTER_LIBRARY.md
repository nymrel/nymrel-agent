# Routing inside another application

`@nymrel/agent/router` is an unreleased source addition. The immutable v0.4.1
package/source downloads do not contain it, and a version string alone is not
proof that it was released. This guide applies to a tarball built from the exact
reviewed candidate source; a future versioned release retains its normal gates.

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

## Build and install an exact source candidate

From a clean canonical checkout, follow [the development guide](../CONTRIBUTING.md)
and preserve its origin/toolchain checks. Run:

```text
corepack npm@11.19.1 ci
corepack npm@11.19.1 run verify
corepack npm@11.19.1 pack --ignore-scripts --pack-destination /path/to/new-artifacts
```

Keep the tarball's SHA-256 and full source revision. In a separate application
directory, install that exact tarball rather than a registry version:

```text
npm install --ignore-scripts /path/to/new-artifacts/nymrel-agent-0.4.1.tgz
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

Bundle this module with your existing browser toolchain. Neither Node shims nor
the Nymrel runtime are needed for the routing graph. This is a metadata-only
worker; task bodies and model calls stay with your application.

## Reproducible acceptance

The existing `npm run verify` packed-consumer gate installs the exact built
tarball outside the checkout, runs the Node consumer, checks its public types
with no Node ambient types, bundles a worker with no external/Node dependencies,
and executes the bundled worker contract in a worker-like test context. It retains
the existing CLI/MCP checks. Synthetic installed consumers demonstrate integration
readiness; they do not establish independent real-world adoption.

For the additional native Chromium module-worker check:

```text
corepack npm@11.19.1 run verify:router-browser
```

Set `NYMREL_ROUTER_BROWSER_BIN` to a supported Chromium executable when it cannot
be discovered. Missing or failed browser execution is an error, never a passing
skip. The native check serves only local synthetic fixtures and does not contact
a model provider. Its result names the browser/runtime and the exact bundle.
