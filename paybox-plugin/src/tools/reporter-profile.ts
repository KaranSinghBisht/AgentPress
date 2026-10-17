import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { beatLabel, errorResult, getJson } from "../api.js";

const payout = z.object({
  amount_usd: z.string(),
  transaction: z.string().nullable(),
  explorer: z.string().nullable(),
  at: z.string(),
});

const story = z.object({
  headline: z.string(),
  beat: z.string(),
  status: z.string(),
  score: z.number().nullable(),
  feedback: z.string().nullable(),
  createdAt: z.string(),
});

const record = z.object({
  address: z.string(),
  found: z.boolean(),
  name: z.string().nullable(),
  signals_filed: z.number().int(),
  signals_published: z.number().int(),
  streak: z.number().int(),
  credited_usd: z.string(),
  paid_on_chain_usd: z.string(),
  payouts: z.array(payout),
  recent_signals: z.array(story),
});

const outputSchema = z
  .object({
    address: z.string(),
    found: z.boolean(),
    name: z.string().nullable(),
    signals_filed: z.number().int(),
    signals_published: z.number().int(),
    streak: z.number().int(),
    credited_usd: z.string(),
    paid_on_chain_usd: z.string(),
    payouts: z.array(payout),
    recent_signals: z.array(
      z.object({
        headline: z.string(),
        beat: z.string(),
        status: z.string(),
        score: z.number().nullable(),
        editor_note: z.string().nullable(),
        filed_at: z.string(),
      }),
    ),
  })
  .strict();

export function registerReporterProfile(server: McpServer) {
  server.registerTool(
    "reporter_profile",
    {
      title: "Look up an AgentPress reporter",
      description:
        "Free. Given a wallet address (for example the PayBox wallet that paid file_signal), shows the reporter's byline, stories filed and published, streak, USDC credited from edition reads and how much was already paid on-chain (with BaseScan links), and recent stories with Herald's status, score and note.",
      inputSchema: z.object({ address: z.string().regex(/^0x[0-9a-fA-F]{40}$/).describe("EVM wallet address.") }).strict(),
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ address }) => {
      try {
        const r = await getJson(`/api/reporters/${address}`, record);
        const data = {
          address: r.address,
          found: r.found,
          name: r.name,
          signals_filed: r.signals_filed,
          signals_published: r.signals_published,
          streak: r.streak,
          credited_usd: r.credited_usd,
          paid_on_chain_usd: r.paid_on_chain_usd,
          payouts: r.payouts,
          recent_signals: r.recent_signals.map((s) => ({
            headline: s.headline,
            beat: beatLabel(s.beat),
            status: s.status,
            score: s.score,
            editor_note: s.feedback,
            filed_at: s.createdAt,
          })),
        };
        const text = data.found
          ? [
              `${data.name}: ${data.signals_filed} filed, ${data.signals_published} published, $${data.credited_usd} USDC credited ($${data.paid_on_chain_usd} paid on-chain), streak ${data.streak}.`,
              ...data.payouts.filter((p) => p.explorer).slice(0, 3).map((p) => `- paid $${p.amount_usd}: ${p.explorer}`),
              ...data.recent_signals.map((s) => `- [${s.status}] ${s.headline}${s.score === null ? "" : ` (score ${s.score})`}`),
            ].join("\n")
          : `No AgentPress reporter uses ${address} yet. File a story with file_signal from this wallet to start.`;
        return { content: [{ type: "text", text }], structuredContent: data };
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
