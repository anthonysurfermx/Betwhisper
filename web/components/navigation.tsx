"use client"

import Link from "next/link"
import { useState, useEffect } from "react"

export function Navigation() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/5"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
        <div className="flex justify-between items-center h-16 lg:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-2 h-2 bg-[#836EF9] rounded-full group-hover:shadow-[0_0_12px_rgba(131,110,249,0.6)] transition-shadow duration-300" />
            <span className="text-[11px] font-bold tracking-[0.25em] uppercase font-mono text-white">
              VOICESWAP
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            <a
              href="#experience"
              className="text-[11px] font-medium tracking-[0.15em] uppercase font-mono text-white/50 hover:text-white transition-colors duration-300"
            >
              The Agent
            </a>
            <a
              href="#how-it-works"
              className="text-[11px] font-medium tracking-[0.15em] uppercase font-mono text-white/50 hover:text-white transition-colors duration-300"
            >
              How it works
            </a>
            <Link
              href="/receive"
              className="text-[11px] font-medium tracking-[0.15em] uppercase font-mono text-white/50 hover:text-white transition-colors duration-300"
            >
              Merchants
            </Link>
            <a
              href="#waitlist"
              className="px-5 py-2.5 bg-[#836EF9] text-white text-[11px] font-bold tracking-[0.15em] uppercase font-mono hover:bg-[#A18FFF] transition-all duration-300 hover:shadow-[0_0_20px_rgba(131,110,249,0.4)]"
            >
              Get Early Access
            </a>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden flex flex-col gap-1.5 p-2"
            aria-label="Toggle menu"
          >
            <span className={`w-5 h-[1.5px] bg-white transition-all duration-300 ${menuOpen ? "rotate-45 translate-y-[4.5px]" : ""}`} />
            <span className={`w-5 h-[1.5px] bg-white transition-all duration-300 ${menuOpen ? "opacity-0" : ""}`} />
            <span className={`w-5 h-[1.5px] bg-white transition-all duration-300 ${menuOpen ? "-rotate-45 -translate-y-[4.5px]" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-500 ${
          menuOpen ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-6 py-6 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/5 space-y-4">
          <a
            href="#experience"
            onClick={() => setMenuOpen(false)}
            className="block text-[11px] font-medium tracking-[0.15em] uppercase font-mono text-white/60 hover:text-white transition-colors"
          >
            The Agent
          </a>
          <a
            href="#how-it-works"
            onClick={() => setMenuOpen(false)}
            className="block text-[11px] font-medium tracking-[0.15em] uppercase font-mono text-white/60 hover:text-white transition-colors"
          >
            How it works
          </a>
          <Link
            href="/receive"
            onClick={() => setMenuOpen(false)}
            className="block text-[11px] font-medium tracking-[0.15em] uppercase font-mono text-white/60 hover:text-white transition-colors"
          >
            Merchants
          </Link>
          <a
            href="#waitlist"
            onClick={() => setMenuOpen(false)}
            className="block w-full px-5 py-3 bg-[#836EF9] text-white text-[11px] font-bold tracking-[0.15em] uppercase font-mono text-center hover:bg-[#A18FFF] transition-colors"
          >
            Get Early Access
          </a>
        </div>
      </div>
    </nav>
  )
}
