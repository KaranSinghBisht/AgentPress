import { v4 as uuid } from "uuid";
import { getDb, schema } from "./db";
import { and, eq, sql } from "drizzle-orm";
import { recordLedgerEntry } from "./ledger";

export async function recordPayment(opts: {
  editionId: string;
  payerAddress: string;
  amountCents: number;
  txHash?: string;
  network: string;
}) {
  const db = await getDb();
  const now = new Date().toISOString();
  const paymentId = uuid();

  await db
    .insert(schema.payments)
    .values({
      id: paymentId,
      editionId: opts.editionId,
      payerAddress: opts.payerAddress,
      amountCents: opts.amountCents,
      txHash: opts.txHash ?? null,
      network: opts.network,
      paidAt: now,
    })
    .run();

  // Create entitlement
  await db
    .insert(schema.entitlements)
    .values({
      id: uuid(),
      paymentId,
      editionId: opts.editionId,
      accountId: opts.payerAddress,
      grantedAt: now,
    })
    .run();

  // Record in ledger as actual revenue
  await recordLedgerEntry({
    type: "revenue",
    amountCents: opts.amountCents,
    description: `x402 payment for edition`,
    fromAddress: opts.payerAddress,
    txHash: opts.txHash,
    editionId: opts.editionId,
  });

  // Update edition-level revenue with actual cumulative payments
  const { totalCents } = await getPaymentRevenue(opts.editionId);
  await db
    .update(schema.editions)
    .set({ revenueCents: totalCents })
    .where(eq(schema.editions.id, opts.editionId))
    .run();

  return paymentId;
}

export async function getPaymentRevenue(editionId?: string) {
  const db = await getDb();

  if (editionId) {
    const result = await db
      .select({
        total: sql<number>`COALESCE(SUM(${schema.payments.amountCents}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(schema.payments)
      .where(eq(schema.payments.editionId, editionId))
      .get();
    return { totalCents: result?.total ?? 0, count: result?.count ?? 0 };
  }

  const result = await db
    .select({
      total: sql<number>`COALESCE(SUM(${schema.payments.amountCents}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(schema.payments)
    .get();
  return { totalCents: result?.total ?? 0, count: result?.count ?? 0 };
}

export async function hasEntitlement(
  accountId: string,
  editionId: string,
): Promise<boolean> {
  const db = await getDb();
  const row = await db
    .select({ id: schema.entitlements.id })
    .from(schema.entitlements)
    .where(
      and(
        eq(schema.entitlements.accountId, accountId),
        eq(schema.entitlements.editionId, editionId),
      ),
    )
    .get();
  return !!row;
}
