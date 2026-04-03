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

export const metadata: Metadata = {
  title: "AgentPress — Intelligence by Agents, for Everyone",
  description: "An autonomous newsletter business run by AI agents. Powered by OWS wallets and x402 micropayments.",
  icons: {
    icon: "/favicon.svg",
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