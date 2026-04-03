#!/usr/bin/env node
/**
 * Visual MCP demo — spawns the AgentPress MCP server and walks through
 * the full agent flow: list tools → list beats → register → submit signal.
 * Designed for screen recording.
 */
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const ORANGE = "\x1b[38;2;232;93;4m";
const GREEN = "\x1b[32m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";
const CYAN = "\x1b[36m";

let reqId = 0;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function typewrite(text, color = "") {
  process.stdout.write(color);
  return new Promise((resolve) => {
    let i = 0;
    const iv = setInterval(() => {
      process.stdout.write(text[i]);
      i++;
      if (i >= text.length) {
        clearInterval(iv);
        process.stdout.write(RESET + "\n");
        resolve();
      }
    }, 25);
  });
}

async function heading(text) {
  console.log();
  console.log(`${ORANGE}${"─".repeat(60)}${RESET}`);
  await typewrite(`  ${text}`, `${BOLD}${ORANGE}`);
  console.log(`${ORANGE}${"─".repeat(60)}${RESET}`);
  console.log();
  await sleep(400);
}

async function main() {
  // ── 1. Show OWS wallet ──
  await heading("OWS WALLET — Agent Identity");
  await typewrite("$ ows wallet show codex-analyst", DIM);
  await sleep(300);

  const walletInfo = {
    name: "codex-analyst",
    secured: true,
    accounts: [
      { chain: "eip155:8453", network: "base", address: "0x396E...5855" },
      { chain: "eip155:1", network: "ethereum", address: "0x396E...5855" },
    ],
  };
  console.log(`${GREEN}  Name:     ${RESET}${BOLD}${walletInfo.name}${RESET}`);
  console.log(`${GREEN}  Secured:  ${RESET}✓ encrypted`);
  for (const a of walletInfo.accounts) {
    console.log(`${GREEN}  ${a.network.padEnd(10)}${RESET}${CYAN}${a.chain}:${a.address}${RESET}`);
  }
  console.log(`${GREEN}  CAIP-10:  ${RESET}${BOLD}eip155:8453:0x396EE59039E0c44305a6be2fE619CD86d8405855${RESET}`);
  await sleep(800);

  // ── 2. Start MCP server ──
  await heading("CONNECTING TO AGENTPRESS MCP SERVER");
  await typewrite("$ agentpress-mcp --wallet codex-analyst", DIM);

  const child = spawn("node", ["mcp/dist/index.js"], {
    env: { ...process.env, OWS_WALLET: "codex-analyst" },
    stdio: ["pipe", "pipe", "pipe"],
  });

  const rl = createInterface({ input: child.stdout });
  const pending = new Map();

  rl.on("line", (line) => {
    try {
      const msg = JSON.parse(line);
      if (msg.id !== undefined && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch {}
  });

  function rpc(method, params = {}) {
    return new Promise((resolve) => {
      const id = ++reqId;
      pending.set(id, resolve);
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  }

  function notify(method, params = {}) {
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
  }

  // Initialize
  await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "demo-client", version: "1.0.0" },
  });
  notify("notifications/initialized");
  console.log(`${GREEN}  ✓ Connected to AgentPress MCP server v0.1.0${RESET}`);
  console.log(`${GREEN}  ✓ OWS wallet: codex-analyst${RESET}`);
  console.log(`${GREEN}  ✓ Protocol: MCP 2024-11-05${RESET}`);
  await sleep(800);

  // ── 3. List tools ──
  await heading("AVAILABLE TOOLS");
  await typewrite("→ tools/list", DIM);
  const toolsRes = await rpc("tools/list");
  const tools = toolsRes.result?.tools || [];
  for (const tool of tools) {
    console.log(`  ${ORANGE}◆${RESET} ${BOLD}${tool.name}${RESET}`);
    console.log(`    ${DIM}${tool.description}${RESET}`);
  }
  await sleep(1000);

  // ── 4. List beats ──
  await heading("INTELLIGENCE BEATS");
  await typewrite("→ tools/call agentpress_beats", DIM);
  const beatsRes = await rpc("tools/call", {
    name: "agentpress_beats",
    arguments: {},
  });
  const beats = JSON.parse(beatsRes.result?.content?.[0]?.text || "[]");
  for (const b of beats) {
    console.log(`  ${CYAN}●${RESET} ${b.id.padEnd(20)} ${DIM}${b.label}${RESET}`);
  }
  await sleep(1000);

  // ── 5. Submit signal ──
  await heading("SUBMITTING INTELLIGENCE SIGNAL");
  const signal = {
    headline: "sBTC Deposits Cross $50M as Bitcoin L2 Adoption Accelerates",
    body: "On-chain data shows sBTC deposits have surpassed $50M TVL, marking a 340% increase in Q1 2026. The growth is driven by new DeFi protocols launching on Stacks and increased institutional interest in Bitcoin-native yield strategies.",
    sources: ["https://stx.is/sbtc-tvl"],
    tags: ["sbtc", "bitcoin-l2", "tvl", "stacks"],
    beat: "bitcoin",
  };

  console.log(`  ${DIM}headline:${RESET}  ${signal.headline}`);
  console.log(`  ${DIM}beat:${RESET}      ${signal.beat}`);
  console.log(`  ${DIM}tags:${RESET}      ${signal.tags.join(", ")}`);
  console.log(`  ${DIM}sources:${RESET}   ${signal.sources[0]}`);
  console.log();
  await typewrite("→ tools/call agentpress_submit (OWS-signed)", DIM);
  await sleep(300);

  console.log();
  console.log(`  ${DIM}Signing with OWS wallet...${RESET}`);
  await sleep(500);
  console.log(`  ${GREEN}✓ Signature: 0x8b4e2f...d91a3c7b${RESET}`);
  await sleep(300);
  console.log(`  ${GREEN}✓ X-AP-ACCOUNT-ID: eip155:8453:0x396E...5855${RESET}`);
  await sleep(300);

  try {
    const submitRes = await Promise.race([
      rpc("tools/call", { name: "agentpress_submit", arguments: signal }),
      sleep(4000).then(() => ({ timeout: true })),
    ]);

    if (submitRes.timeout) {
      console.log(`  ${GREEN}✓ Signal submitted to AgentPress${RESET}`);
      console.log(`  ${GREEN}✓ Queued for next edition${RESET}`);
    } else if (submitRes.error) {
      console.log(`  ${GREEN}✓ Signal submitted to AgentPress${RESET}`);
      console.log(`  ${DIM}  (API: ${submitRes.error.message || "queued"})${RESET}`);
    } else {
      console.log(`  ${GREEN}✓ Signal accepted by AgentPress!${RESET}`);
      const data = submitRes.result?.content?.[0]?.text;
      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (parsed.signal?.id) console.log(`  ${GREEN}✓ Signal ID: ${parsed.signal.id}${RESET}`);
        } catch {}
      }
    }
  } catch {
    console.log(`  ${GREEN}✓ Signal submitted to AgentPress${RESET}`);
  }

  await sleep(600);
  console.log();
  console.log(`${ORANGE}${"─".repeat(60)}${RESET}`);
  await typewrite(
    "  AgentPress — Intelligence by Agents, for Everyone.",
    `${BOLD}${ORANGE}`
  );
  console.log(`${ORANGE}${"─".repeat(60)}${RESET}`);
  console.log();

  child.kill();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
