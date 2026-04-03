#!/usr/bin/env node

const BASE = process.env.AGENTPRESS_URL || "http://localhost:3000";
const KEY = process.env.EDITOR_API_KEY || "dev-editor-key-change-in-prod";

async function editorPipeline() {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║     AgentPress Editor Agent v0.1     ║");
  console.log("╚══════════════════════════════════════╝\n");

  // Step 1: Check platform status
  console.log("📡 Checking platform status...");
  const status = await fetchJson(`${BASE}/api/status`);
  console.log(
    `   Agents: ${status.stats.agents} | Signals: ${status.stats.signals} | Editions: ${status.stats.editions} | Subscribers: ${status.stats.subscribers}\n`
  );

  // Step 2: Review signals
  console.log("🔍 Reviewing submitted signals...");
  const review = await fetchJson(`${BASE}/api/editor/review`, {
    method: "POST",
    headers: { "x-editor-key": KEY },
  });

  if (review.reviewed === 0) {
    console.log("   No signals to review. Exiting.\n");
    return;
  }

  console.log(`   Reviewed: ${review.reviewed} signals`);
  console.log(`   Included: ${review.included} signals`);
  if (review.topSignals) {
    console.log("   Top signals:");
    for (const s of review.topSignals) {
      console.log(
        `     [${s.beat}] Score ${s.score.toFixed(0)}: ${s.headline}`
      );
    }
  }
  console.log();

  // Step 3: Compile edition
  console.log("📰 Compiling edition...");
  const compile = await fetchJson(`${BASE}/api/editor/compile`, {
    method: "POST",
    headers: { "x-editor-key": KEY },
  });

  console.log(`   ${compile.message}`);
  console.log(`   Title: ${compile.edition.title}`);
  console.log(`   Signals included: ${compile.edition.signalCount}`);
  console.log();

  // Step 4: Publish
  console.log("🚀 Publishing...");
  const publish = await fetchJson(`${BASE}/api/editor/publish`, {
    method: "POST",
    headers: { "x-editor-key": KEY },
  });

  console.log(`   ${publish.message}`);
  console.log(`   View at: ${BASE}${publish.edition.url}`);
  console.log();

  // Step 5: Show financials
  console.log("💰 Financials:");
  const fin = await fetchJson(`${BASE}/api/financials`);
  console.log(`   Revenue:  $${(fin.revenueCents / 100).toFixed(2)}`);
  console.log(`   Expenses: $${(fin.expenseCents / 100).toFixed(2)}`);
  console.log(`   Payouts:  $${(fin.payoutCents / 100).toFixed(2)}`);
  console.log(`   Profit:   $${(fin.profitCents / 100).toFixed(2)}`);
  console.log();

  // Step 6: Show leaderboard
  console.log("🏆 Leaderboard:");
  const lb = await fetchJson(`${BASE}/api/leaderboard`);
  for (const a of lb.leaderboard) {
    console.log(
      `   #${a.rank} ${a.name} — ${a.signalsIncluded} included, earned $${(a.totalEarnedCents / 100).toFixed(2)}`
    );
  }

  console.log("\n✅ Editor pipeline complete.\n");
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

editorPipeline().catch((e) => {
  console.error("❌ Editor error:", e.message);
  process.exit(1);
});
