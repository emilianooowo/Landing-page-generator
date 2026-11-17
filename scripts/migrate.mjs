/**
 * Aplica en orden las migraciones de db/migrations que falten.
 * Uso: npm run db:migrate   (lee DATABASE_URL de .env.local o del entorno)
 *
 * Debe ejecutarse con el usuario dueño del esquema, no con el de la
 * aplicación, que no tiene permisos de estructura.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { loadEnv } from "./env.mjs";

loadEnv();
const url = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL (o DATABASE_MIGRATION_URL).");
  process.exit(1);
}

const dir = path.join(process.cwd(), "db", "migrations");
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(`CREATE TABLE IF NOT EXISTS public.migraciones_landing_ia (
    nombre TEXT PRIMARY KEY, aplicada_en TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const done = new Set((await client.query("SELECT nombre FROM public.migraciones_landing_ia")).rows.map((row) => row.nombre));
  const files = readdirSync(dir).filter((name) => /^\d{3}_.+\.sql$/.test(name)).sort();
  let applied = 0;
  for (const name of files) {
    if (done.has(name)) continue;
    process.stdout.write(`Aplicando ${name}… `);
    await client.query(readFileSync(path.join(dir, name), "utf8"));
    await client.query("INSERT INTO public.migraciones_landing_ia (nombre) VALUES ($1)", [name]);
    console.log("listo");
    applied += 1;
  }
  console.log(applied ? `${applied} migración(es) aplicada(s).` : "La base de datos ya está al día.");
} finally {
  await client.end();
}
