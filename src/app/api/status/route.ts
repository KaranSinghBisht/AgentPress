import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    const db = getDb();

    const agentCount = (await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.agents)
      .get())?.count ?? 0;

    const signalCount = (await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.signals)
      .get())?.count ?? 0;

    const editionCount = (await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.editions)
      .get())?.count ?? 0;

    const subscriberCount = (await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.subscribers)
      .get())?.count ?? 0;

    return NextResponse.json({
      status: "ok",
      platform: "AgentPress",
      version: "0.1.0",
      stats: {
        agents: agentCount,
        signals: signalCount,
        editions: editionCount,
        subscribers: subscriberCount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: "error", message: "Database unavailable" },
      { status: 500 }
    );
  }
}
