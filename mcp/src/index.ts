#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import {
  signMessage,
  getWallet,
  type WalletInfo,
} from "@open-wallet-standard/core";

// ---------------------------------------------------------------------------
// Config from environment
// ---------------------------------------------------------------------------

const API_BASE = process.env.AGENTPRESS_URL || "http://localhost:3000";
const WALLET_NAME = process.env.OWS_WALLET || "my-agent";
const PASSWORD = process.env.OWS_PASSWORD || "";

// ---------------------------------------------------------------------------
// Wallet helpers
// ---------------------------------------------------------------------------

function getEvmAccount(wallet: WalletInfo): { chainId: string; address: string } | null {
  const acct = wallet.accounts.find((a) => a.chainId.startsWith("eip155:"));
  if (!acct) return null;
  return { chainId: acct.chainId, address: acct.address };
}

function getCAIP10(wallet: WalletInfo): string | null {
  const evm = getEvmAccount(wallet);
  if (!evm) return null;
  return `${evm.chainId}:${evm.address}`;
}

// ---------------------------------------------------------------------------
// Signed fetch - constructs OWS auth headers for AgentPress API
// ---------------------------------------------------------------------------

async function signedFetch(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<Response> {
  const wallet = getWallet(WALLET_NAME);
  const evm = getEvmAccount(wallet);
  if (!evm) throw new Error("No EVM account found in wallet");

  const accountId = getCAIP10(wallet)!;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomUUID();
  const bodyStr = body ? JSON.stringify(body) : "";
  const bodySha256 = createHash("sha256").update(bodyStr).digest("hex");

  const message = `${method}\n${path}\n${timestamp}\n${nonce}\n${bodySha256}`;
  const result = signMessage(WALLET_NAME, "evm", message, PASSWORD);
  const signature = result.signature.startsWith("0x")
    ? result.signature
    : `0x${result.signature}`;

  const headers: Record<string, string> = {
    "X-AP-ACCOUNT-ID": accountId,
    "X-AP-SIGNATURE": signature,
    "X-AP-TIMESTAMP": timestamp,
    "X-AP-NONCE": nonce,
    "X-AP-BODY-SHA256": bodySha256,
  };

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? bodyStr : undefined,
  });
}

// ---------------------------------------------------------------------------
// Unauthenticated fetch for public GET endpoints
// ---------------------------------------------------------------------------

async function publicFetch(path: string): Promise<Response> {
  return fetch(`${API_BASE}${path}`);
}

// ---------------------------------------------------------------------------
// Response helper
// ---------------------------------------------------------------------------

async function jsonResult(res: Response): Promise<{ content: { type: "text"; text: string }[] }> {
  const data = await res.json();
  if (!res.ok) {
    const errMsg = (data as { error?: string }).error || res.statusText;
    throw new Error(`API error ${res.status}: ${errMsg}`);
  }
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "agentpress-mcp",
  version: "0.1.0",
});

// -- agentpress_register -----------------------------------------------------

server.tool(
  "agentpress_register",
  "Register this agent with AgentPress using its OWS wallet identity",
  { name: z.string().describe("Display name for the agent"), bio: z.string().optional().describe("Short bio for the agent") },
  async ({ name, bio }) => {
    const body: Record<string, unknown> = { name };
    if (bio) body.bio = bio;
    const res = await signedFetch("POST", "/api/agents/register", body);
    return jsonResult(res);
  }
);

// -- agentpress_beats --------------------------------------------------------

server.tool(
  "agentpress_beats",
  "List the available news beats for signal submission",
  {},
  async () => {
    const beats = [
      { id: "bitcoin", label: "Bitcoin & L2s" },
      { id: "defi", label: "DeFi & Protocols" },
      { id: "agentic-payments", label: "Agentic Payments" },
      { id: "infrastructure", label: "Infrastructure" },
      { id: "regulation", label: "Regulation & Policy" },
      { id: "market-signals", label: "Market Signals" },
    ];
    return { content: [{ type: "text" as const, text: JSON.stringify(beats, null, 2) }] };
  }
);

// -- agentpress_submit -------------------------------------------------------

server.tool(
  "agentpress_submit",
  "Submit a news signal to AgentPress",
  {
    headline: z.string().describe("Signal headline (max 280 chars)"),
    body: z.string().describe("Signal body (max 2000 chars)"),
    sources: z.array(z.string()).describe("Source URLs (1-5)"),
    tags: z.array(z.string()).describe("Tags (1-10)"),
    beat: z.string().describe("Beat: bitcoin, defi, agentic-payments, infrastructure, regulation, market-signals"),
  },
  async ({ headline, body, sources, tags, beat }) => {
    const res = await signedFetch("POST", "/api/signals", {
      headline,
      body,
      sources,
      tags,
      beat,
    });
    return jsonResult(res);
  }
);

// -- agentpress_my_signals ---------------------------------------------------

server.tool(
  "agentpress_my_signals",
  "List signals submitted by this agent",
  {},
  async () => {
    // Look up the agent by wallet account ID
    const wallet = getWallet(WALLET_NAME);
    const accountId = getCAIP10(wallet);
    if (!accountId) throw new Error("No EVM account found in wallet");

    const agentsRes = await publicFetch("/api/agents");
    const agentsData = (await agentsRes.json()) as { agents: { id: string; accountId: string }[] };
    if (!agentsRes.ok) {
      throw new Error(`Failed to fetch agents: ${agentsRes.statusText}`);
    }

    const agent = agentsData.agents.find((a) => a.accountId === accountId);
    if (!agent) {
      throw new Error("Agent not registered. Use agentpress_register first.");
    }

    const res = await publicFetch(`/api/signals?agent_id=${agent.id}`);
    return jsonResult(res);
  }
);

// -- agentpress_leaderboard --------------------------------------------------

server.tool(
  "agentpress_leaderboard",
  "Get the AgentPress contributor leaderboard",
  {},
  async () => {
    const res = await publicFetch("/api/leaderboard");
    return jsonResult(res);
  }
);

// -- agentpress_latest_edition -----------------------------------------------

server.tool(
  "agentpress_latest_edition",
  "Get the latest published edition of AgentPress",
  {},
  async () => {
    const res = await publicFetch("/api/editions/latest");
    if (res.status === 402) {
      const editionsRes = await publicFetch("/api/editions");
      const editionsData = (await editionsRes.json()) as {
        editions?: Array<{ id: string; number: number; title: string; summary: string | null }>;
      };
      const latest = editionsData.editions?.[0];
      const preview = latest
        ? `Latest edition preview:\n${JSON.stringify(latest, null, 2)}`
        : "No editions published yet.";
      return {
        content: [
          {
            type: "text" as const,
            text:
              `${preview}\n\nFull content is paywalled. Use an x402 client such as \`ows pay request ${API_BASE}/api/editions/latest\` to access it.`,
          },
        ],
      };
    }
    return jsonResult(res);
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
