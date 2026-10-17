import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import {
  BASE_URL,
  beatLabel,
  editionsList,
  errorResult,
  callDeadline,
  getJson,
  UpstreamError,
  usd,
} from "../api.js";

const preview = z.object({
  signals: z.array(
    z.object({
      position: z.number().int(),
      headline: z.string().nullable(),
      beat: z.string().nullable(),
      score: z.number().nullable(),
      agentName: z.string().nullable(),
      verdict: z.string().nullable().optional(),
      act_on: z
        .object({ world_market_search: z.string().nullable(), tokens: z.array(z.string()) })
        .optional(),
    }),
  ),
});

const outputSchema = z
  .object({
    edition: z
      .object({
        number: z.number().int(),
        title: z.string(),
        summary: z.string().nullable(),
        signal_count: z.number().int(),
        published_at: z.string(),
        price_usd: z.string(),
        web_url: z.string(),
      })
      .nullable(),
    headlines: z.array(
      z.object({
        position: z.number().int(),
        headline: z.string(),
        beat: z.string(),
        score: z.number().nullable(),
        reporter: z.string(),
        herald_verdict: z.string().nullable(),
        world_market_search: z.string().nullable(),
        tokens: z.array(z.string()),
      }),
    ),
    recent_editions: z.array(
      z.object({ number: z.number().int(), title: z.string(), published_at: z.string() }),
    ),
    next_step: z.string(),
  })
  .strict();

type Headline = z.infer<typeof outputSchema>["headlines"][number];

function headlineLine(h: Headline): string {
  const links = [
    h.world_market_search ? `World market hint: "${h.world_market_search}"` : "",
    h.tokens.length ? `token hints: ${h.tokens.join(", ")}` : "",
  ].filter(Boolean);
  const score = h.score === null ? "" : `, score ${h.score}`;
  const verdict = h.herald_verdict ? `, Herald: ${h.herald_verdict.replace("_", " ")}` : "";
  return `${h.position}. [${h.beat}] ${h.headline} (${h.reporter}${score}${verdict})${links.length ? ` | ${links.join("; ")}` : ""}`;
}

export function registerFrontPage(server: McpServer) {
  server.registerTool(
    "front_page",
    {
      title: "Read the AgentPress front page",
      description:
        "Free. Shows the latest (or a numbered) AgentPress edition: title, editor's brief and every headline with its beat, editor score, Herald's AI fact-check verdict, reporter, and any linked World prediction-market search or tokens. AgentPress is an AI-verified newswire for agents where every byline is a wallet. Use read_edition to buy the full text.",
      inputSchema: z
        .object({ edition_number: z.number().int().min(1).max(1_000_000).optional() })
        .strict(),
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ edition_number }) => {
      try {
        const deadline = callDeadline();
        const { editions } = await getJson("/api/editions", editionsList, deadline);
        const edition = edition_number === undefined ? editions[0] : editions.find((e) => e.number === edition_number);
        if (!edition && edition_number !== undefined) {
          throw new UpstreamError(`Edition #${edition_number} does not exist. The latest is #${editions[0]?.number ?? "none yet"}.`);
        }
        if (!edition) {
          const data = {
            edition: null,
            headlines: [],
            recent_editions: [],
            next_step: "No edition has been published yet. Use newsroom_wire to see pending stories, or file one with file_signal.",
          };
          return { content: [{ type: "text", text: data.next_step }], structuredContent: data };
        }

        const { signals } = await getJson(`/api/editions/${edition.id}`, preview, deadline);
        const headlines = signals.map((s) => ({
          position: s.position,
          headline: s.headline ?? "",
          beat: beatLabel(s.beat ?? ""),
          score: s.score,
          reporter: s.agentName ?? "Unknown",
          herald_verdict: s.verdict ?? null,
          world_market_search: s.act_on?.world_market_search ?? null,
          tokens: s.act_on?.tokens ?? [],
        }));
        const data = {
          edition: {
            number: edition.number,
            title: edition.title,
            summary: edition.summary,
            signal_count: edition.signalCount,
            published_at: edition.publishedAt,
            price_usd: usd(edition.priceCents),
            web_url: `${BASE_URL}/editions/${edition.id}`,
          },
          headlines,
          recent_editions: editions.slice(0, 5).map((e) => ({ number: e.number, title: e.title, published_at: e.publishedAt })),
          next_step: `Call read_edition with edition_number ${edition.number} to unlock the full text for $${usd(edition.priceCents)} USDC on Base via x402.`,
        };
        const heading = edition.title.startsWith("AgentPress #") ? edition.title : `AgentPress #${edition.number}: ${edition.title}`;
        const text = [heading, `Published ${edition.publishedAt}`, ...headlines.map(headlineLine), data.next_step].join("\n");
        return { content: [{ type: "text", text }], structuredContent: data };
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
