import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

type DbClient = Awaited<ReturnType<typeof drizzle<typeof schema>>>;

let _dbPromise: Promise<DbClient> | null = null;

async function initDb(): Promise<DbClient> {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL || "file:agentpress.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  await runMigrations(client);

  // drizzle-orm 0.45+ returns a Promise
  return await drizzle(client, { schema });
}

// Each migration is a function that receives the raw libsql client.
// Migrations are idempotent — safe to re-run on existing DBs.
const MIGRATIONS: Array<(client: Client) => Promise<void>> = [
  // v1: Bootstrap schema
  async (client) => {
    await client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        account_id TEXT UNIQUE NOT NULL,
        chain_id TEXT NOT NULL,
        address TEXT NOT NULL,
        name TEXT NOT NULL,
        bio TEXT,
        registered_at TEXT NOT NULL,
        total_signals INTEGER DEFAULT 0 NOT NULL,
        signals_included INTEGER DEFAULT 0 NOT NULL,
        total_earned_cents INTEGER DEFAULT 0 NOT NULL,
        current_streak INTEGER DEFAULT 0 NOT NULL,
        longest_streak INTEGER DEFAULT 0 NOT NULL
      );

      CREATE TABLE IF NOT EXISTS signals (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL REFERENCES agents(id),
        headline TEXT NOT NULL,
        body TEXT NOT NULL,
        sources TEXT NOT NULL,
        tags TEXT NOT NULL,
        beat TEXT NOT NULL,
        status TEXT DEFAULT 'submitted' NOT NULL,
        score REAL,
        editor_feedback TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS editions (
        id TEXT PRIMARY KEY,
        number INTEGER UNIQUE NOT NULL,
        title TEXT NOT NULL,
        summary TEXT,
        content_html TEXT NOT NULL,
        content_text TEXT NOT NULL,
        signal_count INTEGER NOT NULL,
        price_cents INTEGER DEFAULT 5 NOT NULL,
        cost_cents INTEGER DEFAULT 0 NOT NULL,
        revenue_cents INTEGER DEFAULT 0 NOT NULL,
        published_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        emailed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS edition_signals (
        edition_id TEXT NOT NULL REFERENCES editions(id),
        signal_id TEXT NOT NULL REFERENCES signals(id),
        position INTEGER NOT NULL,
        payout_cents INTEGER DEFAULT 0 NOT NULL,
        PRIMARY KEY (edition_id, signal_id)
      );

      CREATE TABLE IF NOT EXISTS subscribers (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        account_id TEXT,
        subscribed_at TEXT NOT NULL,
        active INTEGER DEFAULT 1 NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ledger (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        description TEXT NOT NULL,
        from_address TEXT,
        to_address TEXT,
        tx_hash TEXT,
        edition_id TEXT REFERENCES editions(id),
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_signals_status ON signals(status);
      CREATE INDEX IF NOT EXISTS idx_signals_beat ON signals(beat);
      CREATE INDEX IF NOT EXISTS idx_signals_agent ON signals(agent_id);
      CREATE INDEX IF NOT EXISTS idx_ledger_type ON ledger(type);
      CREATE INDEX IF NOT EXISTS idx_ledger_edition ON ledger(edition_id);
    `);
  },

  // v2: Edition status, payments, entitlements, persistent nonces
  async (client) => {
    // SQLite: check if column exists before adding
    const cols = await client.execute("PRAGMA table_info(editions)");
    const hasStatus = cols.rows.some((r) => r.name === "status");
    if (!hasStatus) {
      await client.execute(
        "ALTER TABLE editions ADD COLUMN status TEXT DEFAULT 'compiled' NOT NULL"
      );
    }

    await client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        edition_id TEXT NOT NULL REFERENCES editions(id),
        payer_address TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        tx_hash TEXT,
        network TEXT NOT NULL,
        paid_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS entitlements (
        id TEXT PRIMARY KEY,
        payment_id TEXT NOT NULL REFERENCES payments(id),
        edition_id TEXT NOT NULL REFERENCES editions(id),
        account_id TEXT NOT NULL,
        granted_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS nonces (
        nonce TEXT PRIMARY KEY,
        used_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_payments_edition ON payments(edition_id);
      CREATE INDEX IF NOT EXISTS idx_payments_payer ON payments(payer_address);
      CREATE INDEX IF NOT EXISTS idx_entitlements_account ON entitlements(account_id);
      CREATE INDEX IF NOT EXISTS idx_entitlements_edition ON entitlements(edition_id);
      CREATE INDEX IF NOT EXISTS idx_nonces_used_at ON nonces(used_at);
    `);

    // Back-fill: mark existing editions that have emailed_at as 'published'
    // Guard against DBs that predate the emailed_at column
    const edCols = await client.execute("PRAGMA table_info(editions)");
    const hasEmailedAt = edCols.rows.some((r) => r.name === "emailed_at");
    if (hasEmailedAt) {
      await client.execute(
        "UPDATE editions SET status = 'published' WHERE emailed_at IS NOT NULL AND status = 'compiled'"
      );
    }
  },
];

async function runMigrations(client: Client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS _schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const result = await client.execute(
    "SELECT COALESCE(MAX(version), 0) AS v FROM _schema_migrations"
  );
  const currentVersion = Number(result.rows[0]?.v ?? 0);

  for (let i = currentVersion; i < MIGRATIONS.length; i++) {
    await MIGRATIONS[i](client);
    await client.execute({
      sql: "INSERT INTO _schema_migrations (version, applied_at) VALUES (?, ?)",
      args: [i + 1, new Date().toISOString()],
    });
  }
}

export async function getDb(): Promise<DbClient> {
  if (!_dbPromise) {
    _dbPromise = initDb();
  }
  return _dbPromise;
}

export { schema };
