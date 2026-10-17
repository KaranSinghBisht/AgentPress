import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { sql } from "drizzle-orm";
import { currentEdition } from "@/lib/era";

export async function GET() {
  const db = await getDb();
  const editions = await db
    .select({
      id: schema.editions.id,
      number: schema.editions.number,
      title: schema.editions.title,
      summary: schema.editions.summary,
      signalCount: schema.editions.signalCount,
      priceCents: schema.editions.priceCents,
      publishedAt: schema.editions.publishedAt,
    })
    .from(schema.editions)
    .where(currentEdition)
    .orderBy(sql`${schema.editions.number} DESC`)
    .all();

  return NextResponse.json({ editions });
}
