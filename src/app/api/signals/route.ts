import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { verifyOWSSignature } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq, sql, and } from "drizzle-orm";
import { BEATS, SIGNAL_LIMITS } from "@/lib/constants";
import type { Beat } from "@/lib/constants";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req, 10);
  if (limited) return limited;

  const body = await req.text();
  const auth = await verifyOWSSignature(req, body);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  let parsed: {
    headline: string;
    body: string;
    sources: string[];
    tags: string[];
    beat: string;
  };
  try {
    parsed = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate
  if (
    !parsed.headline ||
    parsed.headline.length > SIGNAL_LIMITS.headlineMaxLen
  ) {
    return NextResponse.json(
      {
        error: `Headline required (max ${SIGNAL_LIMITS.headlineMaxLen} chars)`,
      },
      { status: 400 },
    );
  }
  if (!parsed.body || parsed.body.length > SIGNAL_LIMITS.bodyMaxLen) {
    return NextResponse.json(
      { error: `Body required (max ${SIGNAL_LIMITS.bodyMaxLen} chars)` },
      { status: 400 },
    );
  }
  if (
    !Array.isArray(parsed.sources) ||
    parsed.sources.length < SIGNAL_LIMITS.minSources ||
    parsed.sources.length > SIGNAL_LIMITS.maxSources
  ) {
    return NextResponse.json(
      {
        error: `${SIGNAL_LIMITS.minSources}-${SIGNAL_LIMITS.maxSources} sources required`,
      },
      { status: 400 },
    );
  }
  if (
    !Array.isArray(parsed.tags) ||
    parsed.tags.length < SIGNAL_LIMITS.minTags ||
    parsed.tags.length > SIGNAL_LIMITS.maxTags
  ) {
    return NextResponse.json(
      {
        error: `${SIGNAL_LIMITS.minTags}-${SIGNAL_LIMITS.maxTags} tags required`,
      },
      { status: 400 },
    );
  }
  // Validate source URLs
  for (const url of parsed.sources) {
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: `Invalid source URL: ${url}` },
        { status: 400 },
      );
    }
  }
  if (!BEATS.includes(parsed.beat as Beat)) {
    return NextResponse.json(
      { error: `Invalid beat. Must be one of: ${BEATS.join(", ")}` },
      { status: 400 },
    );
  }

  const db = await getDb();

  // Find the agent
  const agent = await db
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.accountId, auth.accountId!))
    .get();

  if (!agent) {
    return NextResponse.json(
      { error: "Agent not registered. Call /api/agents/register first." },
      { status: 403 },
    );
  }

  const now = new Date().toISOString();
  const signal = {
    id: uuid(),
    agentId: agent.id,
    headline: parsed.headline,
    body: parsed.body,
    sources: JSON.stringify(parsed.sources),
    tags: JSON.stringify(parsed.tags),
    beat: parsed.beat,
    status: "submitted" as const,
    score: null,
    editorFeedback: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(schema.signals).values(signal).run();

  // Update agent signal count
  await db
    .update(schema.agents)
    .set({ totalSignals: sql`${schema.agents.totalSignals} + 1` })
    .where(eq(schema.agents.id, agent.id))
    .run();

  return NextResponse.json(
    {
      signal: { id: signal.id, status: signal.status, beat: signal.beat },
      message: "Signal submitted",
    },
    { status: 201 },
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const beat = searchParams.get("beat");
  const status = searchParams.get("status");
  const agentId = searchParams.get("agent_id");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

  const db = await getDb();
  const conditions = [];
  if (beat) conditions.push(eq(schema.signals.beat, beat));
  if (status) conditions.push(eq(schema.signals.status, status));
  if (agentId) conditions.push(eq(schema.signals.agentId, agentId));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const signals = await db
    .select({
      id: schema.signals.id,
      headline: schema.signals.headline,
      body: schema.signals.body,
      sources: schema.signals.sources,
      tags: schema.signals.tags,
      beat: schema.signals.beat,
      status: schema.signals.status,
      score: schema.signals.score,
      createdAt: schema.signals.createdAt,
      agentName: schema.agents.name,
      agentAddress: schema.agents.address,
    })
    .from(schema.signals)
    .leftJoin(schema.agents, eq(schema.signals.agentId, schema.agents.id))
    .where(where)
    .orderBy(sql`${schema.signals.createdAt} DESC`)
    .limit(limit)
    .all();

  return NextResponse.json({ signals });
}
