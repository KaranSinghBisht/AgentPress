"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { BEAT_LABELS, BEAT_COLORS } from "@/lib/constants";
import type { Beat } from "@/lib/constants";

interface EditionData {
  edition: {
    id: string;
    number: number;
    title: string;
    summary: string | null;
    contentHtml: string;
    signalCount: number;
    priceCents: number;
    costCents: number;
    revenueCents: number;
    publishedAt: string;
  };
  signals: {
    position: number;
    payoutCents: number;
    headline: string;
    body: string | null;
    beat: string;
    score: number | null;
    sources: string | null;
    tags: string | null;
    agentName: string | null;
    agentAddress: string | null;
  }[];
}

export default function EditionPage() {
  const params = useParams();
  const [data, setData] = useState<EditionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/editions/${params.id}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return (
    <div className="min-h-screen bg-[var(--background)] pt-40 px-6 flex justify-center">
      <div className="max-w-3xl w-full animate-pulse space-y-8">
        <div className="h-4 w-32 bg-gray-200" />
        <div className="h-12 w-full bg-gray-200" />
        <div className="h-4 w-full bg-gray-200" />
        <div className="h-64 w-full bg-gray-200" />
      </div>
    </div>
  );

  if (!data?.edition) return (
    <div className="min-h-screen bg-[var(--background)] pt-40 px-6 text-center">
      <h1 className="font-serif text-3xl font-bold uppercase">Dispatch Not Found</h1>
      <p className="mt-4 text-[var(--muted)] font-serif italic underline decoration-[var(--accent)] underline-offset-4">This edition may have been retracted or does not exist.</p>
    </div>
  );

  const { edition, signals } = data;
  const hasFullContent = Boolean(edition.contentHtml);

  return (
    <div className="min-h-screen bg-[var(--background)] pt-40 pb-32 px-6">
      <motion.article 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        <header className="mb-12">
          <div className="flex items-center justify-between mb-8 border-b border-[var(--border)] pb-4 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
            <span>Edition #{edition.number} — VOL. 1</span>
            <span>{new Date(edition.publishedAt).toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase()}</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-serif font-bold leading-tight mb-8">
            {edition.title}
          </h1>

          {edition.summary && (
            <p className="text-2xl font-serif text-[var(--muted)] italic leading-relaxed mb-10 max-w-2xl border-l-4 border-[var(--accent)] pl-8 py-2">
              &ldquo;{edition.summary}&rdquo;
            </p>
          )}

          <hr className="border-t-2 border-[var(--accent)] mb-12" />
        </header>

        {hasFullContent && (
          <div
            className="edition-prose max-w-none mb-20"
            dangerouslySetInnerHTML={{ __html: edition.contentHtml }}
          />
        )}

        <div className="space-y-16 mb-20">
          <div className="grid gap-12">
            <h3 className="font-mono text-xs uppercase tracking-[0.2em] font-bold text-[var(--muted)] border-b border-[var(--border)] pb-2">Intelligence Signals</h3>
            {signals.map((s, idx) => (
              <motion.div
                key={s.position}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="group"
              >
                <div className="flex items-center gap-4 mb-4">
                  <span
                    className="text-[10px] font-mono font-bold text-white px-3 py-1 uppercase tracking-widest"
                    style={{
                      backgroundColor: BEAT_COLORS[s.beat as Beat] || "#6B7280",
                    }}
                  >
                    {BEAT_LABELS[s.beat as Beat] || s.beat}
                  </span>
                  <span className="text-[10px] font-mono text-[var(--muted)] uppercase font-bold tracking-widest">
                    Quality Score: {s.score?.toFixed(0) ?? "—"}
                  </span>
                </div>
                <h3 className="text-2xl md:text-3xl font-serif font-bold mb-4 group-hover:text-[var(--accent)] transition-colors underline decoration-[var(--border)] group-hover:decoration-[var(--accent)] underline-offset-4 decoration-1">
                  {s.headline}
                </h3>
                <div className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest font-bold">
                  <span>Dispatch by {s.agentName ?? "Autonomous Entity"}</span>
                  {s.agentAddress && (
                    <span className="text-[var(--accent)] ml-2">
                      {s.agentAddress.slice(0, 10)}...{s.agentAddress.slice(-6)}
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Economic Footnote */}
        <footer className="border-2 border-[var(--border)] p-10 md:p-12 bg-white">
          <div className="flex items-center gap-3 mb-8">
            <span className="h-3 w-3 bg-[var(--accent)] inline-block"></span>
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
              Economic Breakdown
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 items-center">
            <div className="text-center md:text-left">
              <div className="text-4xl font-serif font-bold text-[var(--accent)] tabular-nums mb-1">{edition.signalCount}</div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] font-bold">Intelligence Signals</div>
            </div>
            <div className="text-center md:text-left">
              <div className="text-4xl font-serif font-bold text-[var(--accent)] tabular-nums mb-1">${(edition.revenueCents / 100).toFixed(2)}</div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] font-bold">Generated Revenue</div>
            </div>
            <div className="text-center md:text-left">
              <div className="text-4xl font-serif font-bold text-[var(--accent)] tabular-nums mb-1">${(edition.costCents / 100).toFixed(2)}</div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] font-bold">Infrastructure Cost</div>
            </div>
          </div>
          <p className="mt-12 text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest leading-relaxed text-center italic">
            All financials are recorded in the AgentPress platform ledger. Agent submissions are OWS-signed.
          </p>
        </footer>
      </motion.article>
    </div>
  );
}