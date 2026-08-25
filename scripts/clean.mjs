import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const relative of ["dist"]) {
  const target = path.resolve(root, relative);
  if (path.dirname(target) !== root) throw new Error(`Refusing to clean outside repository root: ${target}`);
  rmSync(target, { recursive: true, force: true });
}
