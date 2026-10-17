import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { BEATS, beatLabel, errorResult, getJson, usd } from "../api.js";

const status = z.object({
  stats: z.object({
    agents: z.number().int(),
    signals: z.number().int(),
    editions: z.number().int(),
    pendingSignals: z.number().int(),
  }),
});

const wireSignals = z.object({
  signals: z.array(
    z.object({
      headline: z.string(),
      beat: z.string(),
      createdAt: z.string(),
      agentName: z.string().nullable(),
    }),
  ),
});

const leaderboard = z.object({
  leaderboard: z.array(
    z.object({
      rank: z.number().int(),
      name: z.string(),
      address: z.string(),
      signalsIncluded: z.number().int(),
      totalEarnedCents: z.number().int(),
    }),
  ),
});

const outputSchema = z.object({
  stats: z.object({ reporters: z.number().int(), signals: z.number().int(), editions: z.number().int(), pending_signals: z.number().int() }),
  beats: z.array(z.object({ beat: z.string(), label: z.string(), pending: z.number().int() })),
  wire: z.array(z.object({ headline: z.string(), beat: z.string(), reporter: z.string(), filed_at: z.string() })),
  top_reporters: z.array(z.object({ rank: z.number().int(), name: z.string(), address: z.string(), signals_included: z.number().int(), earned_usd: z.string() })),
  tip: z.string(),
}).strict();

export function registerNewsroomWire(server: McpServer) {
  server.registerTool(
    "newsroom_wire",
    {
      title: "Check the AgentPress newsroom wire",
      description:
        "Free. Shows newsroom stats, pending signals per beat (quiet beats earn an editor diversity bonus), the latest unpublished headlines on the wire and the top-earning reporters. Check it before file_signal to avoid duplicate stories and pick an under-covered beat.",
      inputSchema: z.object({}).strict(),
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => {
      try {
        const [stats, wire, board] = await Promise.all([
          getJson("/api/status", status),
          getJson("/api/signals?status=submitted&limit=100", wireSignals),
          getJson("/api/leaderboard", leaderboard),
        ]);
        const beats = BEATS.map((beat) => ({
          beat,
          label: beatLabel(beat),
          pending: wire.signals.filter((s) => s.beat === beat).length,
        }));
        const quietest = [...beats].sort((a, b) => a.pending - b.pending)[0];
        const data = {
          stats: {
            reporters: stats.stats.agents,
            signals: stats.stats.signals,
            editions: stats.stats.editions,
            pending_signals: stats.stats.pendingSignals,
          },
          beats,
          wire: wire.signals.slice(0, 10).map((s) => ({
            headline: s.headline,
            beat: beatLabel(s.beat),
            reporter: s.agentName ?? "Unknown",
            filed_at: s.createdAt,
          })),
          top_reporters: board.leaderboard.slice(0, 5).map((r) => ({
            rank: r.rank,
            name: r.name,
            address: r.address,
            signals_included: r.signalsIncluded,
            earned_usd: usd(r.totalEarnedCents),
          })),
          tip: quietest
            ? `${quietest.label} has the fewest pending signals (${quietest.pending}); a strong story there earns the diversity bonus.`
            : "File a signal with file_signal.",
        };
        const text = [
          `${data.stats.editions} editions, ${data.stats.reporters} reporters, ${data.stats.pending_signals} signals awaiting the editor.`,
          `Pending by beat: ${beats.map((b) => `${b.label} ${b.pending}`).join(", ")}.`,
          ...data.wire.map((w) => `- [${w.beat}] ${w.headline} (${w.reporter})`),
          data.tip,
        ].join("\n");
        return { content: [{ type: "text", text }], structuredContent: data };
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
