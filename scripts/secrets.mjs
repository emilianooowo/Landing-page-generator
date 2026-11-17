/**
 * Escanea el repositorio y su historial en busca de secretos con gitleaks,
 * usando Docker para no tener que instalarlo. Uso: npm run secrets
 */
import { spawnSync } from "node:child_process";

const result = spawnSync("docker", [
  "run", "--rm", "-v", `${process.cwd()}:/repo`, "zricethezav/gitleaks:v8.24.3",
  "detect", "--source", "/repo", "--config", "/repo/.gitleaks.toml", "--redact", "--verbose",
], { stdio: "inherit" });
if (result.error) console.error("No se pudo ejecutar Docker:", result.error.message);
process.exit(result.status ?? 1);
