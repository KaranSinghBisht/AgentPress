import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { withEditionPaywall } from "@/lib/x402";
import { EDITION_PRICE_CENTS } from "@/lib/constants";
import { NETWORK } from "@/lib/x402";
import { recordPayment } from "@/lib/payments";

async function handler(req: NextRequest): Promise<NextResponse> {
  const db = await getDb();

  const edition = await db
    .select()
    .from(schema.editions)
    .orderBy(sql`${schema.editions.number} DESC`)
    .limit(1)
    .get();

  if (!edition) {
    return NextResponse.json({ error: "No editions yet" }, { status: 404 });
  }

  const includedSignals = await db
    .select({
      position: schema.editionSignals.position,
      payoutCents: schema.editionSignals.payoutCents,
      headline: schema.signals.headline,
      body: schema.signals.body,
      beat: schema.signals.beat,
      score: schema.signals.score,
      sources: schema.signals.sources,
      tags: schema.signals.tags,
      agentName: schema.agents.name,
      agentAddress: schema.agents.address,
    })
    .from(schema.editionSignals)
    .leftJoin(
      schema.signals,
      eq(schema.editionSignals.signalId, schema.signals.id),
    )
    .leftJoin(schema.agents, eq(schema.signals.agentId, schema.agents.id))
    .where(eq(schema.editionSignals.editionId, edition.id))
    .orderBy(schema.editionSignals.position)
    .all();

  // If this request passed through the x402 paywall, record the payment.
  // The payment-signature header is present when x402 verified a payment.
  const paymentHeader =
    req.headers.get("payment-signature") || req.headers.get("x-payment");

  if (paymentHeader) {
    // Use payment header hash as txHash for deduplication
    const { createHash } = await import("crypto");
    const txHash = createHash("sha256").update(paymentHeader).digest("hex");

    // Check for existing payment with this txHash to prevent double-counting
    const existingPayment = await db
      .select({ id: schema.payments.id })
      .from(schema.payments)
      .where(eq(schema.payments.txHash, txHash))
      .get();

    if (!existingPayment) {
      // Extract payer from the payment payload (best-effort)
      let payerAddress = "unknown";
      try {
        const decoded = JSON.parse(
          Buffer.from(paymentHeader, "base64").toString(),
        );
        payerAddress = decoded?.payload?.authorization?.from ?? "unknown";
      } catch {
        // If we can't decode, still record with unknown payer
      }

      await recordPayment({
        editionId: edition.id,
        payerAddress,
        amountCents: EDITION_PRICE_CENTS,
        txHash,
        network: NETWORK,
      }).catch(() => {
        // Don't fail the response if payment recording fails
      });
    }
  }

  return NextResponse.json({ edition, signals: includedSignals });
}

export const GET = withEditionPaywall(
  handler,
  "Access to full AgentPress edition content",
);
