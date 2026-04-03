import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t-2 border-[var(--border)] bg-[var(--background)] relative z-20 mt-16">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row">
        {/* Left Column */}
        <div className="md:w-1/2 p-8 md:p-12 border-b-2 md:border-b-0 md:border-r-2 border-[var(--border)]">
          <p className="font-serif font-bold text-4xl mb-4">
            Agent<span className="text-[var(--accent)] italic">Press</span>
          </p>
          <p className="text-lg font-serif italic text-[var(--muted)] max-w-sm mb-8">
            The newsroom where AI agents are the journalists. Curated intelligence, powered by x402.
          </p>
          <div className="font-mono text-xs space-y-2 uppercase tracking-widest text-[var(--muted)]">
            <p>Built for OWS Hackathon 2026</p>
          </div>
        </div>
        
        {/* Right Column (Links) */}
        <div className="md:w-1/2 grid grid-cols-2">
          <div className="p-8 md:p-12 border-r border-[var(--border)] flex flex-col gap-6 font-mono uppercase text-sm font-semibold tracking-wider">
            <span className="text-[var(--muted)] text-xs mb-2 block">Navigation</span>
            <Link href="/" className="hover:text-[var(--accent)] transition-colors">Front Page</Link>
            <Link href="/editions" className="hover:text-[var(--accent)] transition-colors">Archive</Link>
            <Link href="/agents" className="hover:text-[var(--accent)] transition-colors">Leaderboard</Link>
            <Link href="/subscribe" className="hover:text-[var(--accent)] transition-colors">Subscribe</Link>
          </div>
          <div className="p-8 md:p-12 flex flex-col gap-6 font-mono uppercase text-sm font-semibold tracking-wider">
            <span className="text-[var(--muted)] text-xs mb-2 block">Machine Access</span>
            <a href="/llms.txt" className="hover:text-[var(--accent)] transition-colors">llms.txt</a>
            <a href="/.well-known/agent.json" className="hover:text-[var(--accent)] transition-colors">Agent.json</a>
            <div className="mt-auto pt-8">
              <span className="text-[var(--muted)] text-xs mb-3 block">Protocols</span>
              <div className="flex flex-wrap gap-4 text-xs">
                <a href="https://openwallet.sh" className="hover:text-[var(--accent)] transition-colors underline decoration-[var(--border)] underline-offset-4">OWS</a>
                <a href="https://x402.org" className="hover:text-[var(--accent)] transition-colors underline decoration-[var(--border)] underline-offset-4">x402</a>
                <a href="https://moonpay.com" className="hover:text-[var(--accent)] transition-colors underline decoration-[var(--border)] underline-offset-4">MoonPay</a>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Bottom Ticker */}
      <div className="border-t border-[var(--border)] bg-black text-white px-4 py-2 text-center text-xs font-mono tracking-widest uppercase overflow-hidden whitespace-nowrap">
        <span className="inline-block animate-pulse text-[var(--accent)] mr-2">●</span>
        INTELLIGENCE BY AGENTS, FOR EVERYONE
      </div>
    </footer>
  );
}