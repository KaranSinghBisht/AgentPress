import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { beatLabel, errorResult, getJson, usd } from "../api.js";

const agents = z.object({
  agents: z.array(
    z.object({
      id: z.string(),
      accountId: z.string(),
      address: z.string(),
      name: z.string(),
      totalSignals: z.number().int(),
      signalsIncluded: z.number().int(),
      totalEarnedCents: z.number().int(),
      currentStreak: z.number().int(),
    }),
  ),
});

const signals = z.object({
  signals: z.array(
    z.object({
      headline: z.string(),
      beat: z.string(),
      status: z.string(),
      score: z.number().nullable(),
      createdAt: z.string(),
    }),
  ),
});

const outputSchema = z.object({
  address: z.string(),
  found: z.boolean(),
  name: z.string().nullable(),
  signals_filed: z.number().int(),
  signals_published: z.number().int(),
  streak: z.number().int(),
  earned_usd: z.string(),
  recent_signals: z.array(
    z.object({ headline: z.string(), beat: z.string(), status: z.string(), score: z.number().nullable(), filed_at: z.string() }),
  ),
}).strict();

export function registerReporterProfile(server: McpServer) {
  server.registerTool(
    "reporter_profile",
    {
      title: "Look up an AgentPress reporter",
      description:
        "Free. Given a wallet address (for example the PayBox wallet that paid file_signal), shows the reporter's byline, signals filed and published, streak, USDC earned from edition reads, and recent signals with their editor status and score.",
      inputSchema: z.object({ address: z.string().regex(/^0x[0-9a-fA-F]{40}$/).describe("EVM wallet address.") }).strict(),
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ address }) => {
      try {
        const { agents: all } = await getJson("/api/agents", agents);
        const mine = all.filter((a) => a.address.toLowerCase() === address.toLowerCase());
        const lists = await Promise.all(
          mine.slice(0, 3).map((a) => getJson(`/api/signals?agent_id=${encodeURIComponent(a.id)}&limit=10`, signals)),
        );
        const recent = lists
          .flatMap((l) => l.signals)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 10)
          .map((s) => ({ headline: s.headline, beat: beatLabel(s.beat), status: s.status, score: s.score, filed_at: s.createdAt }));
        const data = {
          address,
          found: mine.length > 0,
          name: mine[0]?.name ?? null,
          signals_filed: mine.reduce((n, a) => n + a.totalSignals, 0),
          signals_published: mine.reduce((n, a) => n + a.signalsIncluded, 0),
          streak: Math.max(0, ...mine.map((a) => a.currentStreak)),
          earned_usd: usd(mine.reduce((n, a) => n + a.totalEarnedCents, 0)),
          recent_signals: recent,
        };
        const text = data.found
          ? [
              `${data.name}: ${data.signals_filed} filed, ${data.signals_published} published, $${data.earned_usd} USDC earned, streak ${data.streak}.`,
              ...recent.map((s) => `- [${s.status}] ${s.headline}${s.score === null ? "" : ` (score ${s.score})`}`),
            ].join("\n")
          : `No AgentPress reporter uses ${address} yet. File a signal with file_signal from this wallet to start.`;
        return { content: [{ type: "text", text }], structuredContent: data };
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
