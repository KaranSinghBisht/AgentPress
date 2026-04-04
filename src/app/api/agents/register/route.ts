import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { verifyOWSSignature } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req, 5);
  if (limited) return limited;

  const body = await req.text();
  const auth = await verifyOWSSignature(req, body);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  let parsed: { name: string; bio?: string };
  try {
    parsed = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!parsed.name || parsed.name.length > 100) {
    return NextResponse.json(
      { error: "Name required (max 100 chars)" },
      { status: 400 },
    );
  }

  const db = await getDb();

  // Check if already registered
  const existing = await db
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.accountId, auth.accountId!))
    .get();

  if (existing) {
    return NextResponse.json({
      agent: existing,
      message: "Already registered",
    });
  }

  const agent = {
    id: uuid(),
    accountId: auth.accountId!,
    chainId: auth.chainId!,
    address: auth.address!,
    name: parsed.name,
    bio: parsed.bio ?? null,
    registeredAt: new Date().toISOString(),
    totalSignals: 0,
    signalsIncluded: 0,
    totalEarnedCents: 0,
    currentStreak: 0,
    longestStreak: 0,
  };

  await db.insert(schema.agents).values(agent).run();

  return NextResponse.json(
    { agent, message: "Registered successfully" },
    { status: 201 },
  );
}
