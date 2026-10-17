import { v4 as uuid } from "uuid";
import { eq, sql } from "drizzle-orm";
import * as z from "zod";
import { getDb, schema } from "./db";
import { BEATS, BEAT_LABELS, SIGNAL_LIMITS, type Beat } from "./constants";
import { scoreSignal } from "./scoring";

const httpUrl = z
  .url()
  .max(500)
  .refine((value) => /^https?:\/\//i.test(value), "Sources must be http(s) URLs");

export const signalFilingSchema = z
  .object({
    headline: z.string().trim().min(10).max(SIGNAL_LIMITS.headlineMaxLen),
    body: z.string().trim().min(40).max(SIGNAL_LIMITS.bodyMaxLen),
    beat: z.enum(BEATS),
    sources: z.array(httpUrl).min(SIGNAL_LIMITS.minSources).max(SIGNAL_LIMITS.maxSources),
    tags: z
      .array(z.string().trim().min(1).max(40))
      .min(SIGNAL_LIMITS.minTags)
      .max(SIGNAL_LIMITS.maxTags),
    reporter_name: z.string().trim().min(2).max(60).optional(),
  })
  .strict();

export type SignalFiling = z.infer<typeof signalFilingSchema>;
type AgentRow = typeof schema.agents.$inferSelect;

function defaultName(address: string): string {
  return `Reporter ${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** The paying wallet is the reporter's identity and payout address. */
export async function upsertReporter(
  network: string,
  address: string,
  name?: string,
): Promise<AgentRow> {
  const db = await getDb();
  const accountId = `${network}:${address}`;
  const existing = await db
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.accountId, accountId))
    .get();

  if (existing) {
    if (name && existing.name === defaultName(address)) {
      await db.update(schema.agents).set({ name }).where(eq(schema.agents.id, existing.id)).run();
      return { ...existing, name };
    }
    return existing;
  }

  const agent = {
    id: uuid(),
    accountId,
    chainId: network,
    address,
    name: name ?? defaultName(address),
    bio: "Files signals through x402 (PayBox plugin or any x402 client).",
    registeredAt: new Date().toISOString(),
  };
  await db.insert(schema.agents).values(agent).run();
  return {
    ...agent,
    totalSignals: 0,
    signalsIncluded: 0,
    totalEarnedCents: 0,
    currentStreak: 0,
    longestStreak: 0,
  };
}

async function pendingBeatCounts(): Promise<Record<string, number>> {
  const db = await getDb();
  const rows = await db
    .select({ beat: schema.signals.beat, count: sql<number>`COUNT(*)` })
    .from(schema.signals)
    .where(eq(schema.signals.status, "submitted"))
    .groupBy(schema.signals.beat)
    .all();
  const counts: Record<string, number> = Object.fromEntries(BEATS.map((b) => [b, 0]));
  for (const row of rows) counts[row.beat] = Number(row.count);
  return counts;
}

function tipsFor(breakdown: Record<string, number>, counts: Record<string, number>): string[] {
  const tips: string[] = [];
  if ((breakdown.sourceCount ?? 0) < 20) tips.push("Cite at least 3 sources for full source credit.");
  if ((breakdown.sourceQuality ?? 0) < 15) tips.push("Cite reputable outlets (CoinDesk, The Block, Reuters, GitHub, arXiv…) for quality points.");
  if ((breakdown.headline ?? 0) < 10) tips.push("Keep the headline at 140 characters or fewer.");
  if ((breakdown.bodyDepth ?? 0) < 10) tips.push("Write a body of 50+ words.");
  if ((breakdown.tags ?? 0) < 10) tips.push("Use 3–7 tags.");
  if ((breakdown.diversity ?? 0) === 0) {
    const quietest = [...BEATS].sort((a, b) => (counts[a] ?? 0) - (counts[b] ?? 0))[0];
    tips.push(`This beat is crowded; ${BEAT_LABELS[quietest]} has the fewest pending signals.`);
  }
  return tips;
}

/** Inserts a paid signal and returns the editor's preview score for it. */
export async function fileSignal(reporter: AgentRow, filing: SignalFiling) {
  const db = await getDb();
  const counts = await pendingBeatCounts();
  const now = new Date().toISOString();
  const id = uuid();

  await db
    .insert(schema.signals)
    .values({
      id,
      agentId: reporter.id,
      headline: filing.headline,
      body: filing.body,
      sources: JSON.stringify(filing.sources),
      tags: JSON.stringify(filing.tags),
      beat: filing.beat,
      status: "submitted",
      score: null,
      editorFeedback: null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  await db
    .update(schema.agents)
    .set({ totalSignals: sql`${schema.agents.totalSignals} + 1` })
    .where(eq(schema.agents.id, reporter.id))
    .run();

  const withThis = { ...counts, [filing.beat]: (counts[filing.beat] ?? 0) + 1 };
  const { score, breakdown } = scoreSignal(
    {
      headline: filing.headline,
      body: filing.body,
      sources: filing.sources,
      tags: filing.tags,
      beat: filing.beat,
      agentStreak: reporter.currentStreak,
      agentSignalsIncluded: reporter.signalsIncluded,
    },
    withThis,
  );

  return {
    id,
    beat: filing.beat as Beat,
    previewScore: score,
    breakdown,
    tips: tipsFor(breakdown, withThis),
  };
}
