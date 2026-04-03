import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

let _db: ReturnType<typeof createDb> | null = null;
let _migrationsRun = false;

function createDb() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL || "file:agentpress.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const db = drizzle(client, { schema });

  return { db, client };
}

async function runMigrations(client: ReturnType<typeof createClient>) {
  if (_migrationsRun) return;

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
      created_at TEXT NOT NULL
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

  _migrationsRun = true;
}

export function getDb() {
  if (!_db) {
    _db = createDb();
    // Fire-and-forget migrations on first access
    runMigrations(_db.client).catch((err) => {
      throw new Error(`Migration failed: ${err}`);
    });
  }
  return _db.db;
}

export { schema };
