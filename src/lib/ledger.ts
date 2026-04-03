import { v4 as uuid } from "uuid";
import { getDb, schema } from "./db";
import { eq, sql } from "drizzle-orm";

type LedgerType = "revenue" | "expense" | "payout";

export async function recordLedgerEntry(entry: {
  type: LedgerType;
  amountCents: number;
  description: string;
  fromAddress?: string;
  toAddress?: string;
  txHash?: string;
  editionId?: string;
}) {
  const db = await getDb();
  await db.insert(schema.ledger)
    .values({
      id: uuid(),
      type: entry.type,
      amountCents: entry.amountCents,
      description: entry.description,
      fromAddress: entry.fromAddress ?? null,
      toAddress: entry.toAddress ?? null,
      txHash: entry.txHash ?? null,
      editionId: entry.editionId ?? null,
      createdAt: new Date().toISOString(),
    })
    .run();
}

export async function getFinancials() {
  const db = await getDb();

  const totals = await db
    .select({
      type: schema.ledger.type,
      total: sql<number>`SUM(${schema.ledger.amountCents})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(schema.ledger)
    .groupBy(schema.ledger.type)
    .all();

  const recentEntries = await db
    .select()
    .from(schema.ledger)
    .orderBy(sql`${schema.ledger.createdAt} DESC`)
    .limit(50)
    .all();

  const revenue = totals.find((t) => t.type === "revenue")?.total ?? 0;
  const expenses = totals.find((t) => t.type === "expense")?.total ?? 0;
  const payouts = totals.find((t) => t.type === "payout")?.total ?? 0;

  return {
    revenueCents: revenue,
    expenseCents: expenses,
    payoutCents: payouts,
    profitCents: revenue - expenses - payouts,
    entries: recentEntries,
  };
}

export async function getEditionFinancials(editionId: string) {
  const db = await getDb();
  return await db
    .select()
    .from(schema.ledger)
    .where(eq(schema.ledger.editionId, editionId))
    .all();
}
