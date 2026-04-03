import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb, schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { compileEdition } from "@/lib/compiler";
import { recordLedgerEntry } from "@/lib/ledger";
import { EDITION_PRICE_CENTS } from "@/lib/constants";

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-editor-key");
  if (apiKey !== process.env.EDITOR_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      { status: 400 }
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

  // Get subscriber count for revenue estimate
  const subCount =
    (await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.subscribers)
      .where(eq(schema.subscribers.active, 1))
      .get())?.count ?? 0;

  const estimatedRevenueCents = subCount * EDITION_PRICE_CENTS;

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
  await db.insert(schema.editions)
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

  if (estimatedRevenueCents > 0) {
    await recordLedgerEntry({
      type: "revenue",
      amountCents: estimatedRevenueCents,
      description: `Estimated subscriber revenue for Edition #${editionNumber}`,
      editionId,
    });
  }

  // Insert edition_signals and update agent stats
  for (let i = 0; i < included.length; i++) {
    const s = included[i];

    await db.insert(schema.editionSignals)
      .values({
        editionId,
        signalId: s.id,
        position: i + 1,
        payoutCents: compiled.perSignalPayout,
      })
      .run();

    // Mark signal as compiled
    await db.update(schema.signals)
      .set({ status: "compiled", updatedAt: now })
      .where(eq(schema.signals.id, s.id))
      .run();

    // Update agent stats
    await db.update(schema.agents)
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

  return NextResponse.json({
    message: `Edition #${editionNumber} compiled`,
    edition: {
      id: editionId,
      number: editionNumber,
      title: compiled.title,
      signalCount: included.length,
    },
  });
}
