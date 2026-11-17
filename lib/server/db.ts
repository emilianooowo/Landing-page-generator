import pg from "pg";
import { config } from "@/lib/server/config";

/**
 * One pool per process (kept on globalThis so dev reloads don't leak pools).
 * Every query runs with search_path = landing_ia and only with parameters:
 * values never get concatenated into SQL.
 */
const store = globalThis as typeof globalThis & { __landingIaPool?: pg.Pool };

export function pool(): pg.Pool {
  store.__landingIaPool ??= new pg.Pool({
    connectionString: config.databaseUrl(),
    max: 10,
    idleTimeoutMillis: 30_000,
    options: "-c search_path=landing_ia",
  });
  return store.__landingIaPool;
}

export type Db = Pick<pg.PoolClient, "query">;

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values: unknown[] = []): Promise<T[]> {
  return (await pool().query<T>(text, values)).rows;
}

export async function one<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values: unknown[] = []): Promise<T | null> {
  return (await query<T>(text, values))[0] ?? null;
}

export async function transaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Test hook. */
export async function closePool(): Promise<void> {
  await store.__landingIaPool?.end();
  delete store.__landingIaPool;
}
