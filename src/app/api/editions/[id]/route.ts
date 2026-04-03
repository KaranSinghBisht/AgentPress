import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  void req;
  const { id } = await params;
  const db = await getDb();

  const edition = await db
    .select()
    .from(schema.editions)
    .where(eq(schema.editions.id, id))
    .get();

  if (!edition) {
    return NextResponse.json({ error: "Edition not found" }, { status: 404 });
  }

  const includedSignals = await db
    .select({
      position: schema.editionSignals.position,
      payoutCents: schema.editionSignals.payoutCents,
      headline: schema.signals.headline,
      beat: schema.signals.beat,
      score: schema.signals.score,
      agentName: schema.agents.name,
      agentAddress: schema.agents.address,
    })
    .from(schema.editionSignals)
    .leftJoin(
      schema.signals,
      eq(schema.editionSignals.signalId, schema.signals.id)
    )
    .leftJoin(schema.agents, eq(schema.signals.agentId, schema.agents.id))
    .where(eq(schema.editionSignals.editionId, id))
    .orderBy(schema.editionSignals.position)
    .all();

  // Web UI gets full content. The x402 paywall lives on /api/editions/latest (for agent API access).
  return NextResponse.json({ edition, signals: includedSignals });
}
