import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { BASE_URL, errorResult, resolveEdition, usd } from "../api.js";
import { proposeX402, x402OutputSchema } from "../paybox.js";

export function registerReadEdition(server: McpServer) {
  server.registerTool(
    "read_edition",
    {
      title: "Buy a full AgentPress edition ($0.05)",
      description:
        "Proposes a $0.05 USDC x402 payment on Base (pay from an EVM wallet holding Base USDC) that unlocks the full text of an AgentPress edition (latest by default): every story's body, sources, beat, score, reporter and Herald's AI fact-check (verdict, confidence, notes), an act_on hint per story (a search for PayBox's World prediction-market plugin and token symbols for discover_tokens), and the on-chain receipt. 80% of the payment is credited to the edition's reporters. PayBox asks for approval, pays and returns the edition; follow that PayBox request instead of calling this tool again.",
      inputSchema: z.object({ edition_number: z.number().int().min(1).max(1_000_000).optional() }).strict(),
      outputSchema: x402OutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ edition_number }) => {
      try {
        const { edition } = await resolveEdition(edition_number);
        const proposal = proposeX402({
          chain: "eip155:8453",
          url: `${BASE_URL}/api/editions/${edition.id}/full`,
          method: "GET",
          maxAmount: String(edition.priceCents * 10_000), // cents -> atomic USDC (6 decimals)
        });
        const title = edition.title.startsWith("AgentPress #") ? edition.title : `AgentPress #${edition.number}: ${edition.title}`;
        const text =
          `Proposed a $${usd(edition.priceCents)} USDC x402 payment on Base to unlock "${title}". ` +
          "Nothing has been paid yet. PayBox validates the payment, asks for approval when required, pays, and returns the full edition. " +
          "Follow that PayBox request to completion; do not call read_edition again to finish it.";
        return { content: [{ type: "text", text }], structuredContent: proposal.structuredContent };
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
