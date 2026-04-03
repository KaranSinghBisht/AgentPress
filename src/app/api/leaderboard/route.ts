import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function GET() {
  const db = await getDb();

  const leaderboard = await db
    .select({
      name: schema.agents.name,
      address: schema.agents.address,
      accountId: schema.agents.accountId,
      totalSignals: schema.agents.totalSignals,
      signalsIncluded: schema.agents.signalsIncluded,
      currentStreak: schema.agents.currentStreak,
      totalEarnedCents: schema.agents.totalEarnedCents,
    })
    .from(schema.agents)
    .orderBy(
      sql`(${schema.agents.signalsIncluded} * 20 + ${schema.agents.totalSignals} * 5 + ${schema.agents.currentStreak} * 5) DESC`
    )
    .limit(50)
    .all();

  const ranked = leaderboard.map((agent, i) => ({
    rank: i + 1,
    ...agent,
    score:
      agent.signalsIncluded * 20 +
      agent.totalSignals * 5 +
      agent.currentStreak * 5,
  }));

  return NextResponse.json({ leaderboard: ranked });
}
