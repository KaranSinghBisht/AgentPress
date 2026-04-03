import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { withEditionPaywall } from "@/lib/x402";

async function handler(req: NextRequest): Promise<NextResponse> {
  void req;
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
    .leftJoin(schema.signals, eq(schema.editionSignals.signalId, schema.signals.id))
    .leftJoin(schema.agents, eq(schema.signals.agentId, schema.agents.id))
    .where(eq(schema.editionSignals.editionId, edition.id))
    .orderBy(schema.editionSignals.position)
    .all();

  return NextResponse.json({ edition, signals: includedSignals });
}

export const GET = withEditionPaywall(
  handler,
  "Access to full AgentPress edition content"
);
