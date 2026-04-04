import { v4 as uuid } from "uuid";
import { getDb, schema } from "./db";
import { and, eq, sql } from "drizzle-orm";
import { recordLedgerEntry } from "./ledger";
import { REVENUE_SPLIT } from "./constants";
import { executePayouts } from "./payouts";

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

  // Distribute contributor payouts for this payment
  await distributePayouts(opts.editionId, opts.amountCents);

  return paymentId;
}

async function distributePayouts(
  editionId: string,
  paymentAmountCents: number,
) {
  const db = await getDb();

  const contributors = await db
    .select({
      signalId: schema.editionSignals.signalId,
      position: schema.editionSignals.position,
      agentId: schema.signals.agentId,
      agentAddress: schema.agents.address,
    })
    .from(schema.editionSignals)
    .innerJoin(
      schema.signals,
      eq(schema.editionSignals.signalId, schema.signals.id),
    )
    .innerJoin(schema.agents, eq(schema.signals.agentId, schema.agents.id))
    .where(eq(schema.editionSignals.editionId, editionId))
    .orderBy(schema.editionSignals.position)
    .all();

  if (contributors.length === 0) return;

  const contributorPool = Math.floor(
    paymentAmountCents * REVENUE_SPLIT.contributors,
  );
  if (contributorPool <= 0) return;

  // Distribute evenly; remainder cents go to top-positioned signals
  const basePerSignal = Math.floor(contributorPool / contributors.length);
  const remainder = contributorPool - basePerSignal * contributors.length;

  const payoutTargets: { address: string; amountCents: number }[] = [];

  for (let i = 0; i < contributors.length; i++) {
    const c = contributors[i];
    const payout = basePerSignal + (i < remainder ? 1 : 0);
    if (payout <= 0) continue;

    await db
      .update(schema.editionSignals)
      .set({
        payoutCents: sql`${schema.editionSignals.payoutCents} + ${payout}`,
      })
      .where(
        and(
          eq(schema.editionSignals.editionId, editionId),
          eq(schema.editionSignals.signalId, c.signalId),
        ),
      )
      .run();

    await db
      .update(schema.agents)
      .set({
        totalEarnedCents: sql`${schema.agents.totalEarnedCents} + ${payout}`,
      })
      .where(eq(schema.agents.id, c.agentId))
      .run();

    await recordLedgerEntry({
      type: "payout",
      amountCents: payout,
      description: `Contributor payout from x402 payment`,
      toAddress: c.agentAddress,
      editionId,
    });

    if (c.agentAddress) {
      payoutTargets.push({ address: c.agentAddress, amountCents: payout });
    }
  }

  // Execute on-chain payouts (best-effort)
  if (payoutTargets.length > 0) {
    try {
      await executePayouts(payoutTargets);
    } catch {
      // On-chain payouts are best-effort; ledger entries are the source of truth
    }
  }
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
