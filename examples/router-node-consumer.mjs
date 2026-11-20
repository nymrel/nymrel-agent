// An orchestration program can use the router without adopting AgentRuntime,
// an MCP server, hosted routing, or a provider SDK. Input contains metadata only.
import { readFile } from 'node:fs/promises';
import { routeV2 } from '@nymrel/agent/router';

const payload = JSON.parse(await readFile(process.argv[2], 'utf8'));
const plan = routeV2(payload.request, payload.models);
const selected = plan.selectedModelId !== null;

// The application retains execution, credentials, and authorization decisions.
console.log(JSON.stringify({ status: selected ? 'selected' : 'blocked', plan }));
if (!selected) process.exitCode = 2;
