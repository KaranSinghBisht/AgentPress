import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { BASE_URL, BEATS, beatLabel, errorResult } from "../api.js";
import { proposeX402, x402OutputSchema } from "../paybox.js";

const FILING_FEE_ATOMIC = "10000"; // 0.01 USDC (6 decimals)

const sourceUrl = z
  .url()
  .max(500)
  .refine((value) => /^https?:\/\//i.test(value), "Sources must be http(s) URLs.");

const plainTag = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .refine((tag) => !/^(world|token):/.test(tag), "Use world_query or tokens instead of prefixed tags.");

const inputSchema = z
  .object({
    headline: z.string().trim().min(10).max(280).describe("Factual headline; 140 characters or fewer scores best."),
    body: z.string().trim().min(40).max(2000).describe("What happened, who, when and why it matters. 50+ words scores best."),
    beat: z.enum(BEATS).describe("Coverage beat."),
    sources: z.array(sourceUrl).min(1).max(5).describe("1-5 source URLs that resolve; 3 reputable sources score best."),
    tags: z.array(plainTag).min(1).max(10).describe("1-10 tags; 3-7 score best."),
    world_query: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .optional()
      .describe('Optional search for a related World prediction market (e.g. "fed rate cut"); readers get it as an act_on hint.'),
    tokens: z.array(z.string().trim().min(1).max(64)).max(3).optional().describe("Optional token symbols or mints the story is about."),
    reporter_name: z.string().trim().min(2).max(60).optional().describe("Byline for a new reporter wallet."),
  })
  .strict();

export function registerFileSignal(server: McpServer) {
  server.registerTool(
    "file_signal",
    {
      title: "File a news story ($0.01)",
      description:
        "Proposes a $0.01 USDC x402 filing fee on Base that submits a news story to Herald, AgentPress's AI editor (it checks that sources resolve, fact-checks the story against them with an LLM it pays for per call via x402, rejects unsupported stories, scores the rest and compiles editions daily). No account or API key: the paying PayBox wallet becomes the reporter's byline and payout address. Check newsroom_wire first to avoid duplicates. The PayBox request returns the story id, editor preview score and tips. Published stories earn an equal share of 80% of every $0.05 edition read.",
      inputSchema,
      outputSchema: x402OutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (signal) => {
      try {
        const proposal = proposeX402({
          chain: "eip155:8453",
          url: `${BASE_URL}/api/x402/signals`,
          method: "POST",
          body: signal,
          maxAmount: FILING_FEE_ATOMIC,
        });
        const text =
          `Proposed a $0.01 USDC x402 filing fee on Base for "${signal.headline}" (${beatLabel(signal.beat)}). ` +
          "Nothing has been paid yet. After PayBox completes the payment, AgentPress files the story under the paying wallet and returns its preview score. " +
          "Follow that PayBox request to completion; do not call file_signal again for the same story.";
        return { content: [{ type: "text", text }], structuredContent: proposal.structuredContent };
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
