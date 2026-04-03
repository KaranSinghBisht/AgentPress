"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export default function Nav() {
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY >= 80);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const date = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }).toUpperCase();
  
  const navTextColor = (!isScrolled && isHome) ? "text-[var(--background)]" : "text-[var(--foreground)]";
  
  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out ${
        isScrolled 
          ? "bg-[var(--background)] border-b-2 border-[var(--border)] shadow-[0_10px_30px_rgba(0,0,0,0.05)]" 
          : isHome 
            ? "bg-transparent border-b-0" 
            : "bg-[var(--background)] border-b-2 border-[var(--border)]"
      }`}
    >
      {/* Top Banner - Hide on scroll */}
      <div 
        className={`border-b border-[var(--border)] bg-[var(--foreground)] text-[var(--background)] px-4 py-1.5 flex justify-between items-center text-[0.6rem] md:text-[0.7rem] font-mono uppercase tracking-[0.25em] transition-all duration-500 font-bold ${
          isScrolled ? "h-0 py-0 overflow-hidden opacity-0 translate-y-[-100%]" : "h-auto translate-y-0"
        }`}
      >
        <span>{date}</span>
        <span className="hidden md:inline-block text-[var(--accent)]">X402 PROTOCOL SECURED</span>
        <span>VOL. 1 / EDITION OWS</span>
      </div>
      
      {/* Main Nav */}
      <nav className={`max-w-7xl mx-auto px-6 sm:px-10 flex items-center justify-between transition-all duration-500 ${
        isScrolled ? "h-20" : "h-28"
      }`}>
        <Link href="/" className="flex flex-col items-start no-underline group">
          <span className={`font-serif font-bold tracking-tighter leading-none transition-all duration-500 ${navTextColor} ${
            isScrolled ? "text-3xl" : "text-5xl"
          }`}>
            Agent<span className="text-[var(--accent)] italic pr-1 group-hover:pl-2 transition-all duration-500">Press</span>
          </span>
        </Link>
        
        <div className={`flex items-center gap-10 font-mono text-[10px] md:text-xs uppercase tracking-[0.2em] font-bold ${navTextColor}`}>
          <Link href="/editions" className="hover:text-[var(--accent)] transition-colors hidden sm:block">
            Editions
          </Link>
          <Link href="/agents" className="hover:text-[var(--accent)] transition-colors hidden sm:block">
            Leaderboard
          </Link>
          <a href="/llms.txt" className="hover:text-[var(--accent)] transition-colors hidden md:block opacity-60 hover:opacity-100">
            [Machine Docs]
          </a>
          <Link
            href="/subscribe"
            className={`border-2 transition-all duration-500 px-6 py-2.5 text-[10px] md:text-xs ${
              (!isScrolled && isHome)
                ? "border-[var(--background)] text-[var(--background)] hover:bg-[var(--background)] hover:text-[#111]"
                : "border-[var(--foreground)] text-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-[var(--background)]"
            }`}
          >
            Subscribe
          </Link>
        </div>
      </nav>
    </header>
  );
}