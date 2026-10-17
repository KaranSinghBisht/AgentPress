import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { and, eq, sql } from "drizzle-orm";
import { currentSignal } from "@/lib/era";
import { scoreSignal } from "@/lib/scoring";
import { verifyEditorAuth } from "@/lib/editor-auth";
import { MAX_SIGNALS_PER_EDITION } from "@/lib/constants";
import { liveSources } from "@/lib/source-check";
import {
  factCheckAll,
  withHeraldActOn,
  withHeraldBonus,
} from "@/lib/herald/review";

export async function POST(req: NextRequest) {
  const auth = await verifyEditorAuth(req);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error || "Unauthorized" },
      { status: 401 },
    );
  }

  const db = await getDb();

  // Get all submitted signals
  const submitted = await db
    .select({
      id: schema.signals.id,
      headline: schema.signals.headline,
      body: schema.signals.body,
      sources: schema.signals.sources,
      tags: schema.signals.tags,
      beat: schema.signals.beat,
      agentId: schema.signals.agentId,
      stored: schema.signals.verification,
      agentStreak: schema.agents.currentStreak,
      agentIncluded: schema.agents.signalsIncluded,
    })
    .from(schema.signals)
    .leftJoin(schema.agents, eq(schema.signals.agentId, schema.agents.id))
    .where(and(eq(schema.signals.status, "submitted"), currentSignal))
    .all();

  if (submitted.length === 0) {
    return NextResponse.json({ message: "No signals to review", reviewed: 0 });
  }

  // Count signals per beat for diversity scoring
  const beatCounts: Record<string, number> = {};
  for (const s of submitted) {
    beatCounts[s.beat] = (beatCounts[s.beat] || 0) + 1;
  }

  // Verify sources: only URLs that resolve right now count toward the score,
  // and a signal with no live source is rejected outright.
  const now = new Date().toISOString();
  const checked = await Promise.all(
    submitted.map(async (s) => ({
      ...s,
      live: await liveSources(JSON.parse(s.sources) as string[]),
    })),
  );
  const unverifiable = checked.filter((s) => s.live.length === 0);
  for (const s of unverifiable) {
    await db
      .update(schema.signals)
      .set({
        status: "rejected",
        score: 0,
        editorFeedback:
          "Rejected: none of the cited sources resolved when Herald checked them.",
        updatedAt: now,
      })
      .where(eq(schema.signals.id, s.id))
      .run();
  }
  const verified = checked.filter((s) => s.live.length > 0);
  if (verified.length === 0) {
    return NextResponse.json({
      message: "No verifiable signals",
      reviewed: checked.length,
      rejected: unverifiable.length,
      included: 0,
    });
  }

  // Herald fact-checks each story against its live sources (paid inference).
  // "unsupported" is rejected outright; every other verdict moves on to scoring.
  const factChecked = (await factCheckAll(verified)).map((s) => ({
    ...s,
    tagList: withHeraldActOn(JSON.parse(s.tags) as string[], s.verification),
  }));
  const refuted = factChecked.filter(
    (s) => s.verification.verdict === "unsupported",
  );
  for (const s of refuted) {
    await db
      .update(schema.signals)
      .set({
        status: "rejected",
        score: 0,
        editorFeedback: `Rejected by Herald: ${s.verification.notes}`,
        verification: JSON.stringify(s.verification),
        tags: JSON.stringify(s.tagList),
        updatedAt: now,
      })
      .where(eq(schema.signals.id, s.id))
      .run();
  }
  const accepted = factChecked.filter(
    (s) => s.verification.verdict !== "unsupported",
  );

  // Score each signal, plus Herald's verdict bonus
  const scored = accepted.map((s) => {
    const sources = s.live;
    const tags = s.tagList;
    const { score, breakdown } = scoreSignal(
      {
        headline: s.headline,
        body: s.body,
        sources,
        tags,
        beat: s.beat,
        agentStreak: s.agentStreak ?? 0,
        agentSignalsIncluded: s.agentIncluded ?? 0,
      },
      beatCounts,
    );
    return {
      ...s,
      score: withHeraldBonus(score, s.verification.verdict),
      breakdown,
    };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // The top stories make this edition; the rest stay on the wire for the next one.
  const maxInclude = MAX_SIGNALS_PER_EDITION;

  for (let i = 0; i < scored.length; i++) {
    const s = scored[i];
    const status = i < maxInclude ? "included" : "submitted";
    const feedback =
      i < maxInclude
        ? `Included (rank #${i + 1}, score ${s.score.toFixed(1)})`
        : `Held for the next edition (rank #${i + 1}, score ${s.score.toFixed(1)})`;

    await db
      .update(schema.signals)
      .set({
        status,
        score: s.score,
        editorFeedback: feedback,
        verification: JSON.stringify(s.verification),
        tags: JSON.stringify(s.tagList),
        updatedAt: now,
      })
      .where(eq(schema.signals.id, s.id))
      .run();
  }

  // Streaks: every reporter with a story in this edition extends their streak.
  const includedAgentIds = new Set(scored.slice(0, maxInclude).map((s) => s.agentId));
  for (const agentId of includedAgentIds) {
    await db
      .update(schema.agents)
      .set({
        currentStreak: sql`${schema.agents.currentStreak} + 1`,
        longestStreak: sql`MAX(${schema.agents.longestStreak}, ${schema.agents.currentStreak} + 1)`,
      })
      .where(eq(schema.agents.id, agentId))
      .run();
  }

  return NextResponse.json({
    message: `Reviewed ${checked.length} signals`,
    reviewed: checked.length,
    rejected: unverifiable.length + refuted.length,
    included: Math.min(maxInclude, scored.length),
    topSignals: scored.slice(0, maxInclude).map((s) => ({
      id: s.id,
      headline: s.headline,
      score: s.score,
      beat: s.beat,
    })),
    verdicts: factChecked.map((s) => ({
      id: s.id,
      headline: s.headline,
      verdict: s.verification.verdict,
      confidence: s.verification.confidence,
      notes: s.verification.notes,
      cost_atomic: s.verification.cost_atomic,
      payment_tx: s.verification.payment_tx,
    })),
  });
}
