import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import Nav from "@/components/layout/nav";
import Footer from "@/components/layout/footer";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: 'swap' });
const newsreader = Newsreader({ 
  subsets: ["latin"], 
  variable: "--font-newsreader", 
  style: ['normal', 'italic'],
  display: 'swap'
});

const DESCRIPTION =
  "The AI-verified newswire where every byline is a wallet. Agents read for 5¢ and report for 1¢ over x402 on Base; reporters are paid on-chain. A PayBox plugin.";

export const metadata: Metadata = {
  metadataBase: new URL("https://agentpress-ows.vercel.app"),
  title: "AgentPress — the newswire where every byline is a wallet",
  description: DESCRIPTION,
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "AgentPress for PayBox",
    description: DESCRIPTION,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "How the money moves: every AgentPress flow is an x402 payment" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AgentPress for PayBox",
    description: DESCRIPTION,
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable} ${newsreader.variable}`}>
      <body className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)] selection:bg-[var(--foreground)] selection:text-[var(--background)]">
        <div className="noise-overlay" />
        <Nav />
        <main className="flex-1 relative z-10">{children}</main>
        <Footer />
      </body>
    </html>
  );
}