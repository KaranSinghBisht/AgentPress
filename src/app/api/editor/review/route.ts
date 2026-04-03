import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { scoreSignal } from "@/lib/scoring";

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-editor-key");
  if (apiKey !== process.env.EDITOR_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

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
      agentStreak: schema.agents.currentStreak,
      agentIncluded: schema.agents.signalsIncluded,
    })
    .from(schema.signals)
    .leftJoin(schema.agents, eq(schema.signals.agentId, schema.agents.id))
    .where(eq(schema.signals.status, "submitted"))
    .all();

  if (submitted.length === 0) {
    return NextResponse.json({ message: "No signals to review", reviewed: 0 });
  }

  // Count signals per beat for diversity scoring
  const beatCounts: Record<string, number> = {};
  for (const s of submitted) {
    beatCounts[s.beat] = (beatCounts[s.beat] || 0) + 1;
  }

  // Score each signal
  const scored = submitted.map((s) => {
    const sources: string[] = JSON.parse(s.sources);
    const tags: string[] = JSON.parse(s.tags);
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
      beatCounts
    );
    return { ...s, score, breakdown };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Top 10 get "included", rest get "reviewed"
  const maxInclude = 10;
  const now = new Date().toISOString();

  for (let i = 0; i < scored.length; i++) {
    const s = scored[i];
    const status = i < maxInclude ? "included" : "reviewed";
    const feedback =
      i < maxInclude
        ? `Included (rank #${i + 1}, score ${s.score.toFixed(1)})`
        : `Not included (score ${s.score.toFixed(1)})`;

    await db.update(schema.signals)
      .set({
        status,
        score: s.score,
        editorFeedback: feedback,
        updatedAt: now,
      })
      .where(eq(schema.signals.id, s.id))
      .run();
  }

  return NextResponse.json({
    message: `Reviewed ${scored.length} signals`,
    reviewed: scored.length,
    included: Math.min(maxInclude, scored.length),
    topSignals: scored.slice(0, maxInclude).map((s) => ({
      id: s.id,
      headline: s.headline,
      score: s.score,
      beat: s.beat,
    })),
  });
}
