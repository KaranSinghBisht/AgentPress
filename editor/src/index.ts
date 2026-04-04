#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import {
  signMessage,
  getWallet,
  type WalletInfo,
} from "@open-wallet-standard/core";

const BASE = process.env.AGENTPRESS_URL || "http://localhost:3000";
const WALLET_NAME = process.env.OWS_WALLET || "agentpress-treasury";
const PASSWORD = process.env.OWS_PASSWORD || "";

function getEvmAccount(wallet: WalletInfo) {
  const acct = wallet.accounts.find((a) => a.chainId.startsWith("eip155:"));
  if (!acct) return null;
  return { chainId: acct.chainId, address: acct.address };
}

function getCAIP10(wallet: WalletInfo): string | null {
  const evm = getEvmAccount(wallet);
  if (!evm) return null;
  return `${evm.chainId}:${evm.address}`;
}

async function signedFetch(
  method: string,
  path: string,
  body?: Record<string, unknown>,
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

  return fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? bodyStr : undefined,
  });
}

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

async function signedJson(
  method: string,
  path: string,
): Promise<Record<string, unknown>> {
  const res = await signedFetch(method, path);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

async function editorPipeline() {
  const wallet = getWallet(WALLET_NAME);
  const accountId = getCAIP10(wallet);

  console.log("\n╔══════════════════════════════════════╗");
  console.log("║     AgentPress Editor Agent v0.2     ║");
  console.log("╚══════════════════════════════════════╝\n");
  console.log(`🔐 OWS Wallet: ${WALLET_NAME}`);
  console.log(`   CAIP-10: ${accountId}\n`);

  // Step 1: Check platform status
  console.log("📡 Checking platform status...");
  const status = await fetchJson(`${BASE}/api/status`);
  const stats = status.stats as Record<string, number>;
  console.log(
    `   Agents: ${stats.agents} | Signals: ${stats.signals} | Editions: ${stats.editions} | Subscribers: ${stats.subscribers}\n`,
  );

  // Step 2: Review signals (OWS-signed)
  console.log("🔍 Reviewing submitted signals...");
  const review = await signedJson("POST", "/api/editor/review");

  if ((review.reviewed as number) === 0) {
    console.log("   No signals to review. Exiting.\n");
    return;
  }

  console.log(`   Reviewed: ${review.reviewed} signals`);
  console.log(`   Included: ${review.included} signals`);
  if (review.topSignals) {
    console.log("   Top signals:");
    for (const s of review.topSignals as Array<{
      beat: string;
      score: number;
      headline: string;
    }>) {
      console.log(
        `     [${s.beat}] Score ${s.score.toFixed(0)}: ${s.headline}`,
      );
    }
  }
  console.log();

  // Step 3: Compile edition (OWS-signed)
  console.log("📰 Compiling edition...");
  const compile = await signedJson("POST", "/api/editor/compile");
  const edition = compile.edition as Record<string, unknown>;

  console.log(`   ${compile.message}`);
  console.log(`   Title: ${edition.title}`);
  console.log(`   Signals included: ${edition.signalCount}`);
  console.log();

  // Step 4: Publish (OWS-signed)
  console.log("🚀 Publishing...");
  const publish = await signedJson("POST", "/api/editor/publish");
  const pubEdition = publish.edition as Record<string, unknown>;

  console.log(`   ${publish.message}`);
  console.log(`   View at: ${BASE}${pubEdition.url}`);
  console.log();

  // Step 5: Show financials (public)
  console.log("💰 Financials:");
  const fin = await fetchJson(`${BASE}/api/financials`);
  console.log(
    `   Revenue:  $${((fin.revenueCents as number) / 100).toFixed(2)}`,
  );
  console.log(
    `   Expenses: $${((fin.expenseCents as number) / 100).toFixed(2)}`,
  );
  console.log(
    `   Payouts:  $${((fin.payoutCents as number) / 100).toFixed(2)}`,
  );
  console.log(
    `   Profit:   $${((fin.profitCents as number) / 100).toFixed(2)}`,
  );
  console.log();

  // Step 6: Show leaderboard (public)
  console.log("🏆 Leaderboard:");
  const lb = await fetchJson(`${BASE}/api/leaderboard`);
  for (const a of lb.leaderboard as Array<{
    rank: number;
    name: string;
    signalsIncluded: number;
    totalEarnedCents: number;
  }>) {
    console.log(
      `   #${a.rank} ${a.name} — ${a.signalsIncluded} included, earned $${(a.totalEarnedCents / 100).toFixed(2)}`,
    );
  }

  console.log("\n✅ Editor pipeline complete.\n");
}

const MIN_SIGNALS = 3;
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

async function autonomousLoop() {
  const wallet = getWallet(WALLET_NAME);
  const accountId = getCAIP10(wallet);

  console.log("\n╔══════════════════════════════════════╗");
  console.log("║   AgentPress Editor — Autonomous     ║");
  console.log("╚══════════════════════════════════════╝\n");
  console.log(`🔐 OWS Wallet: ${WALLET_NAME}`);
  console.log(`   CAIP-10: ${accountId}`);
  console.log(
    `   Mode: autonomous (polling every ${POLL_INTERVAL_MS / 1000}s, min ${MIN_SIGNALS} signals)\n`,
  );

  while (true) {
    try {
      const status = await fetchJson(`${BASE}/api/status`);
      const stats = status.stats as Record<string, number>;
      const pending = stats.pendingSignals ?? 0;

      const now = new Date().toLocaleTimeString();
      console.log(`[${now}] Checking... ${pending} pending signals`);

      if (pending >= MIN_SIGNALS) {
        console.log(
          `[${now}] ≥${MIN_SIGNALS} signals found — running editor pipeline`,
        );
        await editorPipeline();
      } else {
        console.log(
          `[${now}] Waiting for ${MIN_SIGNALS - pending} more signals`,
        );
      }
    } catch (err) {
      console.error(
        `[error] ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

const isAutonomous =
  process.argv.includes("--autonomous") || process.argv.includes("--auto");

if (isAutonomous) {
  autonomousLoop().catch((e) => {
    console.error("❌ Autonomous mode error:", e.message);
    process.exit(1);
  });
} else {
  editorPipeline().catch((e) => {
    console.error("❌ Editor error:", e.message);
    process.exit(1);
  });
}
