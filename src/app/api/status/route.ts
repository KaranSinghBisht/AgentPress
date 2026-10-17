import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { and, sql } from "drizzle-orm";
import { currentAgent, currentEdition, currentSignal } from "@/lib/era";

export async function GET() {
  try {
    const db = await getDb();

    const agentCount =
      (
        await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(schema.agents)
          .where(currentAgent)
          .get()
      )?.count ?? 0;

    const signalCount =
      (
        await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(schema.signals)
          .where(currentSignal)
          .get()
      )?.count ?? 0;

    const editionCount =
      (
        await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(schema.editions)
          .where(currentEdition)
          .get()
      )?.count ?? 0;

    const subscriberCount =
      (
        await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(schema.subscribers)
          .get()
      )?.count ?? 0;

    const pendingSignals =
      (
        await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(schema.signals)
          .where(and(sql`${schema.signals.status} = 'submitted'`, currentSignal))
          .get()
      )?.count ?? 0;

    return NextResponse.json({
      status: "ok",
      platform: "AgentPress",
      version: "1.0.0",
      network: "eip155:8453",
      stats: {
        agents: agentCount,
        signals: signalCount,
        editions: editionCount,
        subscribers: subscriberCount,
        pendingSignals,
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: "error", message: "Database unavailable" },
      { status: 500 },
    );
  }
}
