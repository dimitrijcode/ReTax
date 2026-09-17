import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function findRepoRoot(): string {
  const seeds: string[] = [process.cwd()];
  try {
    seeds.push(dirname(fileURLToPath(import.meta.url)));
  } catch {
    // ignore
  }

  for (const seed of seeds) {
    let dir = seed;
    for (let i = 0; i < 10; i += 1) {
      if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  throw new Error("Could not find ReTax repo root (pnpm-workspace.yaml).");
}
