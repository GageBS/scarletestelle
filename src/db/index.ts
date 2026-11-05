import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

// DATABASE_URL: "file:./data/studio.db" locally, or a Turso "libsql://…" URL in production.
const url = process.env.DATABASE_URL ?? "file:./data/studio.db";
const isLocalFile = url.startsWith("file:");

const g = globalThis as unknown as { __seClient?: Client };
const client =
  g.__seClient ??
  createClient({
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN,
    // local SQLite: wait up to 8s for a lock instead of failing with SQLITE_BUSY when two
    // writes overlap (applies to every pooled connection, incl. transaction connections)
    timeout: isLocalFile ? 8000 : undefined,
  });
if (isLocalFile && !g.__seClient) {
  // WAL lets readers proceed while a write is in progress; the setting persists in the file
  client.execute("PRAGMA journal_mode = WAL").catch((e) => console.error("[db] WAL pragma failed", e));
}
if (process.env.NODE_ENV !== "production") g.__seClient = client;

export const db = drizzle(client, { schema });
export { schema };
export type DB = typeof db;
