import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function GET() {
  const db = getDb();
  const agents = db
    .select()
    .from(schema.agents)
    .orderBy(sql`${schema.agents.signalsIncluded} DESC`)
    .all();

  return NextResponse.json({ agents });
}
