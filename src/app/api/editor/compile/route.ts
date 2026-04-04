import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb, schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { compileEdition } from "@/lib/compiler";
import { recordLedgerEntry } from "@/lib/ledger";
import { EDITION_PRICE_CENTS } from "@/lib/constants";
import { verifyEditorAuth } from "@/lib/editor-auth";
import { executePayouts } from "@/lib/payouts";

export async function POST(req: NextRequest) {
  const auth = await verifyEditorAuth(req);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error || "Unauthorized" },
      { status: 401 },
    );
  }

  const db = await getDb();

  // Get all "included" signals
  const included = await db
    .select({
      id: schema.signals.id,
      headline: schema.signals.headline,
      body: schema.signals.body,
      sources: schema.signals.sources,
      tags: schema.signals.tags,
      beat: schema.signals.beat,
      score: schema.signals.score,
      agentId: schema.signals.agentId,
      agentName: schema.agents.name,
      agentAddress: schema.agents.address,
      agentStreak: schema.agents.currentStreak,
    })
    .from(schema.signals)
    .leftJoin(schema.agents, eq(schema.signals.agentId, schema.agents.id))
    .where(eq(schema.signals.status, "included"))
    .orderBy(sql`${schema.signals.score} DESC`)
    .all();

  if (included.length === 0) {
    return NextResponse.json(
      { error: "No included signals. Run /api/editor/review first." },
      { status: 400 },
    );
  }

  // Get next edition number
  const lastEdition = await db
    .select({ number: schema.editions.number })
    .from(schema.editions)
    .orderBy(sql`${schema.editions.number} DESC`)
    .limit(1)
    .get();
  const editionNumber = (lastEdition?.number ?? 0) + 1;

  // Revenue starts at 0; actual revenue is recorded when x402 payments arrive
  const estimatedRevenueCents = 0;

  // Compile the edition
  const compiled = await compileEdition({
    editionNumber,
    signals: included.map((s) => ({
      headline: s.headline,
      body: s.body,
      sources: JSON.parse(s.sources),
      tags: JSON.parse(s.tags),
      beat: s.beat,
      score: s.score ?? 0,
      agentName: s.agentName ?? "Unknown",
      agentAddress: s.agentAddress ?? "",
      agentStreak: s.agentStreak ?? 0,
    })),
    totalRevenueCents: estimatedRevenueCents,
  });

  const now = new Date().toISOString();
  const editionId = uuid();

  // Insert edition
  await db
    .insert(schema.editions)
    .values({
      id: editionId,
      number: editionNumber,
      title: compiled.title,
      summary: compiled.summary,
      contentHtml: compiled.contentHtml,
      contentText: compiled.contentText,
      signalCount: included.length,
      priceCents: EDITION_PRICE_CENTS,
      costCents: 0,
      revenueCents: estimatedRevenueCents,
      publishedAt: now,
      createdAt: now,
      status: "compiled",
    })
    .run();

  // Revenue ledger entries are recorded by recordPayment() when x402 payments arrive
  // No estimated revenue entry needed here — actual payments are the source of truth

  // Insert edition_signals and update agent stats
  for (let i = 0; i < included.length; i++) {
    const s = included[i];

    await db
      .insert(schema.editionSignals)
      .values({
        editionId,
        signalId: s.id,
        position: i + 1,
        payoutCents: compiled.perSignalPayout,
      })
      .run();

    // Mark signal as compiled
    await db
      .update(schema.signals)
      .set({ status: "compiled", updatedAt: now })
      .where(eq(schema.signals.id, s.id))
      .run();

    // Update agent stats
    await db
      .update(schema.agents)
      .set({
        signalsIncluded: sql`${schema.agents.signalsIncluded} + 1`,
        totalEarnedCents: sql`${schema.agents.totalEarnedCents} + ${compiled.perSignalPayout}`,
      })
      .where(eq(schema.agents.id, s.agentId))
      .run();

    // Record payout in ledger
    if (compiled.perSignalPayout > 0) {
      await recordLedgerEntry({
        type: "payout",
        amountCents: compiled.perSignalPayout,
        description: `Payout for signal in Edition #${editionNumber}`,
        toAddress: s.agentAddress ?? undefined,
        editionId,
      });
    }
  }

  // Execute on-chain payouts (best-effort, non-blocking)
  const payoutTargets = included
    .filter((s) => s.agentAddress && compiled.perSignalPayout > 0)
    .map((s) => ({
      address: s.agentAddress!,
      amountCents: compiled.perSignalPayout,
    }));

  let payoutResults: {
    address: string;
    txHash: string | null;
    error?: string;
  }[] = [];
  if (payoutTargets.length > 0) {
    try {
      const results = await executePayouts(payoutTargets);
      payoutResults = results;

      // Update ledger entries with txHash for successful payouts
      for (const r of results.filter((p) => p.txHash)) {
        await recordLedgerEntry({
          type: "payout",
          amountCents: r.amountCents,
          description: `On-chain payout confirmed for Edition #${editionNumber}`,
          toAddress: r.address,
          txHash: r.txHash!,
          editionId,
        });
      }
    } catch {
      // On-chain payouts are best-effort; ledger entries are the source of truth
    }
  }

  return NextResponse.json({
    message: `Edition #${editionNumber} compiled`,
    edition: {
      id: editionId,
      number: editionNumber,
      title: compiled.title,
      signalCount: included.length,
    },
    payouts: payoutResults.length > 0 ? payoutResults : undefined,
  });
}
