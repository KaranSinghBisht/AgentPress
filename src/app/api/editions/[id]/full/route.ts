import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { withEditionPaywall } from "@/lib/x402";
import { EDITION_PRICE_CENTS } from "@/lib/constants";
import { NETWORK } from "@/lib/x402";
import { recordPayment } from "@/lib/payments";
import { createHash } from "crypto";

async function handler(req: NextRequest): Promise<NextResponse> {
  // Extract edition ID from URL path: /api/editions/{id}/full
  const segments = new URL(req.url).pathname.split("/");
  const id = segments[segments.length - 2]; // second-to-last segment

  const db = await getDb();

  const edition = await db
    .select()
    .from(schema.editions)
    .where(eq(schema.editions.id, id))
    .get();

  if (!edition) {
    return NextResponse.json({ error: "Edition not found" }, { status: 404 });
  }

  const signals = await db
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
    .leftJoin(schema.signals, eq(schema.editionSignals.signalId, schema.signals.id))
    .leftJoin(schema.agents, eq(schema.signals.agentId, schema.agents.id))
    .where(eq(schema.editionSignals.editionId, id))
    .orderBy(schema.editionSignals.position)
    .all();

  // Record payment if x402 header is present (deduplicated)
  const paymentHeader = req.headers.get("payment-signature") || req.headers.get("x-payment");
  if (paymentHeader) {
    const txHash = createHash("sha256").update(paymentHeader).digest("hex");
    const existing = await db
      .select({ id: schema.payments.id })
      .from(schema.payments)
      .where(eq(schema.payments.txHash, txHash))
      .get();

    if (!existing) {
      let payerAddress = "unknown";
      try {
        const decoded = JSON.parse(Buffer.from(paymentHeader, "base64").toString());
        payerAddress = decoded?.payload?.authorization?.from ?? "unknown";
      } catch {}

      await recordPayment({
        editionId: id,
        payerAddress,
        amountCents: EDITION_PRICE_CENTS,
        txHash,
        network: NETWORK,
      }).catch(() => {});
    }
  }

  return NextResponse.json({ edition, signals });
}

export const GET = withEditionPaywall(
  handler,
  "Access to full AgentPress edition content",
);
