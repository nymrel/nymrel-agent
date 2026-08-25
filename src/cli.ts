import { pathToFileURL } from "node:url";
import { createDefaultRouteRequest, createDefaultRuntime } from "./defaults.js";

function flagValue(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

export async function main(args: readonly string[] = process.argv.slice(2)): Promise<number> {
  const runtime = createDefaultRuntime();
  const localOnly = args.includes("--local-only");
  const routeRequest = createDefaultRouteRequest(localOnly ? "local_only" : "approved_provider");
  const command = args[0];

  if (command === "models" && args[1] === "doctor") {
    process.stdout.write(`${JSON.stringify(await runtime.doctor(), null, 2)}\n`);
    return 0;
  }

  if (command === "route") {
    process.stdout.write(`${JSON.stringify(await runtime.plan(routeRequest), null, 2)}\n`);
    return 0;
  }

  if (command === "run") {
    const task = flagValue(args, "--task") ?? "Inspect the phase-zero candidate.";
    const result = await runtime.run({ task, profile: "read-only", route: routeRequest });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result.receipt.status === "completed" ? 0 : 2;
  }

  process.stderr.write(
    "Usage: node dist/src/cli.js <models doctor|route|run --task TEXT> [--local-only]\n",
  );
  return 64;
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href) {
  process.exitCode = await main();
}
