import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "./db";
import { EDITION_PRICE_CENTS } from "./constants";
import { currentEdition } from "./era";
import type { SettledPayment } from "./x402";
import { splitTags } from "./act-on";
import { readVerification } from "./herald/verification";

export type EditionRow = typeof schema.editions.$inferSelect;

export async function findEditionById(id: string): Promise<EditionRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = await getDb();
  const edition = await db
    .select()
    .from(schema.editions)
    .where(and(eq(schema.editions.id, id), currentEdition))
    .get();
  return edition ?? null;
}

export async function findLatestEdition(): Promise<EditionRow | null> {
  const db = await getDb();
  const edition = await db
    .select()
    .from(schema.editions)
    .where(currentEdition)
    .orderBy(sql`${schema.editions.number} DESC`)
    .limit(1)
    .get();
  return edition ?? null;
}

function parseList(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

/** The paid edition payload: compact, agent-readable, with the on-chain receipt. */
export async function loadPaidEdition(
  edition: EditionRow,
  payment: SettledPayment,
) {
  const db = await getDb();
  const rows = await db
    .select({
      position: schema.editionSignals.position,
      headline: schema.signals.headline,
      body: schema.signals.body,
      beat: schema.signals.beat,
      score: schema.signals.score,
      sources: schema.signals.sources,
      tags: schema.signals.tags,
      verification: schema.signals.verification,
      reporterName: schema.agents.name,
      reporterAddress: schema.agents.address,
    })
    .from(schema.editionSignals)
    .leftJoin(
      schema.signals,
      eq(schema.editionSignals.signalId, schema.signals.id),
    )
    .leftJoin(schema.agents, eq(schema.signals.agentId, schema.agents.id))
    .where(eq(schema.editionSignals.editionId, edition.id))
    .orderBy(schema.editionSignals.position)
    .all();

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://agentpress-ows.vercel.app";
  return {
    edition: {
      id: edition.id,
      number: edition.number,
      title: edition.title,
      summary: edition.summary,
      signal_count: edition.signalCount,
      published_at: edition.publishedAt,
      web_url: `${baseUrl}/editions/${edition.id}`,
    },
    signals: rows.map((row) => {
      const { tags, actOn } = splitTags(parseList(row.tags));
      return {
        position: row.position,
        headline: row.headline ?? "",
        body: row.body ?? "",
        beat: row.beat ?? "",
        score: row.score ?? 0,
        sources: parseList(row.sources),
        tags,
        act_on: actOn,
        verification: readVerification(row.verification),
        reporter: {
          name: row.reporterName ?? "Unknown",
          address: row.reporterAddress ?? "",
        },
      };
    }),
    act_on_guide:
      "act_on.world_market_search is a query for PayBox's World plugin (world_search) to see live prediction-market odds on the story; act_on.tokens are symbols or mints to look up with discover_tokens. Read-only checks first; any trade still needs the user's approval in PayBox.",
    receipt: {
      paid_usd: (EDITION_PRICE_CENTS / 100).toFixed(2),
      payer: payment.payer,
      transaction: payment.transaction,
      network: payment.network,
      split:
        "80% of this payment is credited to the edition's reporters in equal shares (any remainder goes to the top stories)",
    },
  };
}
