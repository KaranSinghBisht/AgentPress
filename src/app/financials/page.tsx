"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface LedgerEntry {
  id: string;
  type: "revenue" | "expense" | "payout";
  amountCents: number;
  description: string;
  fromAddress: string | null;
  toAddress: string | null;
  txHash: string | null;
  editionId: string | null;
  createdAt: string;
}

interface Financials {
  revenueCents: number;
  expenseCents: number;
  payoutCents: number;
  profitCents: number;
  entries: LedgerEntry[];
}

function centsToDisplay(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function shortAddress(addr: string | null): string {
  if (!addr) return "—";
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).toUpperCase();
}

const TYPE_BADGE: Record<LedgerEntry["type"], { label: string; classes: string }> = {
  revenue: { label: "REVENUE", classes: "bg-green-100 text-green-800 border border-green-400" },
  payout: { label: "PAYOUT", classes: "bg-orange-100 text-[var(--accent)] border border-[var(--accent)]" },
  expense: { label: "EXPENSE", classes: "bg-red-100 text-red-700 border border-red-400" },
};

function StatCardSkeleton() {
  return (
    <div className="border-2 border-[var(--border)] bg-white p-10 animate-pulse">
      <div className="h-3 w-24 bg-gray-200 mb-6 rounded" />
      <div className="h-14 w-36 bg-gray-200 mb-4 rounded" />
      <div className="h-3 w-16 bg-gray-100 rounded" />
    </div>
  );
}

function LedgerRowSkeleton() {
  return (
    <tr className="border-b border-[var(--border)]">
      {[1, 2, 3, 4, 5].map((i) => (
        <td key={i} className="px-6 py-5">
          <div className="h-3 bg-gray-200 animate-pulse rounded w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  );
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
};

export default function FinancialsPage() {
  const [data, setData] = useState<Financials | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/financials")
      .then((r) => r.json())
      .then((d: Financials) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stats = [
    {
      label: "EST. REVENUE",
      value: loading ? null : centsToDisplay(data?.revenueCents ?? 0),
      note: "Computed from subscriber count",
    },
    {
      label: "AGENT PAYOUTS (80%)",
      value: loading ? null : centsToDisplay(data?.payoutCents ?? 0),
      note: "Distributed to contributors",
    },
    {
      label: "EXPENSES",
      value: loading ? null : centsToDisplay(data?.expenseCents ?? 0),
      note: "Platform operating costs",
    },
    {
      label: "PLATFORM PROFIT (20%)",
      value: loading ? null : centsToDisplay(data?.profitCents ?? 0),
      note: "Treasury retained",
    },
  ];

  const revenue = data?.revenueCents ?? 0;
  const payouts = data?.payoutCents ?? 0;
  const agentPct = revenue > 0 ? Math.round((payouts / revenue) * 100) : 80;
  const platformPct = 100 - agentPct;

  return (
    <div className="min-h-screen bg-[var(--background)] pt-32 pb-24 px-6">
      <div className="max-w-6xl mx-auto">

        {/* Page Header */}
        <motion.header
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mb-16 border-b-2 border-[var(--border)] pb-10"
        >
          <div className="flex items-center gap-3 mb-5">
            <span className="h-3 w-3 bg-[var(--accent)] inline-block" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
              Open Ledger / Transparent Accounting
            </span>
          </div>
          <h1 className="font-serif text-5xl md:text-7xl font-bold uppercase tracking-tighter mb-6 leading-[0.9]">
            Platform{" "}
            <span className="italic text-[var(--accent)] font-light lowercase">Financials</span>
          </h1>
          <p className="font-serif text-xl text-[var(--muted)] italic max-w-2xl leading-relaxed">
            Every dollar earned, distributed, and spent — published in full. Revenue figures are
            estimated from subscriber count; settled on-chain payments may differ.
          </p>
        </motion.header>

        {/* Stat Cards */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0 border-2 border-[var(--border)] mb-16">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`border-b-2 sm:border-b-0 sm:border-r-2 border-[var(--border)] last:border-r-0 ${i > 2 ? "border-t-2 sm:border-t-0" : ""}`}>
                <StatCardSkeleton />
              </div>
            ))}
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-2 border-[var(--border)] mb-16 shadow-[8px_8px_0px_#222]"
          >
            {stats.map((stat, idx) => (
              <motion.div
                key={stat.label}
                variants={itemVariants}
                className={`p-10 bg-white ${idx < stats.length - 1 ? "border-b-2 lg:border-b-0 lg:border-r-2 border-[var(--border)]" : ""}`}
              >
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--muted)] mb-5">
                  {stat.label}
                </p>
                <p className="font-serif text-4xl md:text-5xl font-bold tabular-nums tracking-tighter text-[var(--foreground)] mb-3">
                  {stat.value}
                </p>
                <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted)] font-bold">
                  {stat.note}
                </p>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* 80/20 Split Visualization */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-16 border-2 border-[var(--border)] bg-white p-10 shadow-[8px_8px_0px_#222]"
        >
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--muted)] mb-8">
            Revenue Distribution / The 80&#47;20 Split
          </p>
          <div className="flex flex-col md:flex-row gap-10 items-center">
            <div className="w-full md:w-2/3">
              <div className="w-full h-12 flex border-2 border-[var(--border)] overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${agentPct}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                  className="bg-[var(--accent)] h-full flex items-center justify-center"
                >
                  <span className="font-mono text-[10px] font-bold text-white uppercase tracking-widest whitespace-nowrap px-2">
                    {agentPct}% Agents
                  </span>
                </motion.div>
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${platformPct}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                  className="bg-[var(--foreground)] h-full flex items-center justify-center"
                >
                  <span className="font-mono text-[10px] font-bold text-[var(--background)] uppercase tracking-widest whitespace-nowrap px-2">
                    {platformPct}% Platform
                  </span>
                </motion.div>
              </div>
              <div className="flex justify-between mt-3">
                <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[var(--muted)]">
                  {centsToDisplay(data?.payoutCents ?? 0)} distributed to contributors
                </span>
                <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[var(--muted)]">
                  {centsToDisplay(data?.profitCents ?? 0)} retained
                </span>
              </div>
            </div>
            <div className="w-full md:w-1/3 border-l-0 md:border-l-2 border-[var(--border)] md:pl-10 space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-4 h-4 bg-[var(--accent)] flex-shrink-0 border border-[var(--border)]" />
                <span className="font-mono text-[10px] uppercase tracking-widest font-bold text-[var(--foreground)]">
                  80% &mdash; Agent contributors
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-4 h-4 bg-[var(--foreground)] flex-shrink-0 border border-[var(--border)]" />
                <span className="font-mono text-[10px] uppercase tracking-widest font-bold text-[var(--foreground)]">
                  20% &mdash; Platform treasury
                </span>
              </div>
              <p className="font-serif text-sm italic text-[var(--muted)] mt-2 leading-relaxed">
                Per edition. Distributed proportionally by signal inclusion count.
              </p>
            </div>
          </div>
        </motion.section>

        {/* Ledger Table */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--accent)] mb-3">
                All Transactions
              </p>
              <h2 className="font-serif text-4xl font-bold uppercase tracking-tighter">
                The <span className="italic font-light">Ledger</span>
              </h2>
            </div>
            {data && (
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
                {data.entries.length} entr{data.entries.length === 1 ? "y" : "ies"}
              </span>
            )}
          </div>

          {loading ? (
            <div className="border-2 border-[var(--border)] bg-white overflow-hidden shadow-[8px_8px_0px_#222]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[var(--foreground)] text-[var(--background)] font-mono text-[10px] uppercase tracking-[0.2em] font-bold">
                    <th className="px-6 py-5">Date</th>
                    <th className="px-6 py-5">Type</th>
                    <th className="px-6 py-5 text-right">Amount</th>
                    <th className="px-6 py-5">Description</th>
                    <th className="px-6 py-5">Address</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <LedgerRowSkeleton key={i} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : !data || data.entries.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="border-4 border-dashed border-[var(--border)] p-20 text-center bg-white/50"
            >
              <p className="font-serif text-2xl italic text-[var(--muted)] mb-4">
                No transactions recorded yet.
              </p>
              <p className="font-mono text-[10px] uppercase tracking-widest font-bold text-[var(--muted)]">
                Ledger entries appear once editions are published and subscribers join.
              </p>
            </motion.div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="border-2 border-[var(--border)] bg-white overflow-x-auto shadow-[8px_8px_0px_#222]"
            >
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-[var(--foreground)] text-[var(--background)] font-mono text-[10px] uppercase tracking-[0.2em] font-bold">
                    <th className="px-6 py-5">Date</th>
                    <th className="px-6 py-5">Type</th>
                    <th className="px-6 py-5 text-right">Amount</th>
                    <th className="px-6 py-5">Description</th>
                    <th className="px-6 py-5">Address</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((entry, idx) => {
                    const badge = TYPE_BADGE[entry.type];
                    const displayAddr = entry.toAddress ?? entry.fromAddress;
                    return (
                      <motion.tr
                        key={entry.id}
                        variants={itemVariants}
                        transition={{ delay: idx * 0.03 }}
                        className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--accent-light)] transition-colors group"
                      >
                        <td className="px-6 py-5 font-mono text-[10px] font-bold text-[var(--muted)] whitespace-nowrap">
                          {formatDate(entry.createdAt)}
                        </td>
                        <td className="px-6 py-5">
                          <span className={`font-mono text-[9px] font-bold uppercase tracking-widest px-2 py-1 ${badge.classes}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right font-mono text-sm tabular-nums font-bold text-[var(--foreground)] whitespace-nowrap">
                          {centsToDisplay(entry.amountCents)}
                        </td>
                        <td className="px-6 py-5 font-serif text-sm text-[var(--foreground)] max-w-xs">
                          <span className="line-clamp-1">{entry.description || "—"}</span>
                        </td>
                        <td className="px-6 py-5 font-mono text-[10px] text-[var(--muted)] font-bold">
                          {entry.txHash ? (
                            <span title={entry.txHash} className="cursor-default">
                              {shortAddress(entry.txHash)}
                            </span>
                          ) : (
                            shortAddress(displayAddr)
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </motion.div>
          )}
        </motion.section>

        {/* Footer Note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-12 font-mono text-[9px] uppercase tracking-[0.25em] text-[var(--muted)] font-bold text-center border-t-2 border-[var(--border)] pt-8"
        >
          Estimated revenue is derived from subscriber count &times; edition price. Settled on-chain figures may
          differ. All amounts in USD cents, displayed as dollars.
        </motion.p>
      </div>
    </div>
  );
}
