/**
 * Runs Vitest from a path with an uppercase drive letter.
 *
 * On Windows, terminals such as VS Code's can report the working directory as
 * "c:\..." while Node resolves modules as "C:\...". Vitest then loads two copies
 * of its runner and every `describe` fails with
 * "Cannot read properties of undefined (reading 'config')".
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const upper = (p) => p.replace(/^[a-z]:/, (drive) => drive.toUpperCase());
const cwd = upper(process.cwd());
const require = createRequire(path.join(cwd, "package.json"));
const bin = upper(path.join(path.dirname(require.resolve("vitest/package.json")), "vitest.mjs"));

const result = spawnSync(process.execPath, [bin, "run", ...process.argv.slice(2)], {
  cwd,
  stdio: "inherit",
});
process.exit(result.status ?? 1);
