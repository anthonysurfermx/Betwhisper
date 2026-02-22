"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { useScrollAnimation } from "@/hooks/use-scroll-animation"

export function CTASection() {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const { ref, isVisible } = useScrollAnimation(0.1)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Something went wrong")
      }

      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join waitlist")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id="waitlist" className="py-24 lg:py-40 relative scroll-mt-20 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#836EF9]/[0.03] rounded-full blur-[150px]" />
      </div>

      <div ref={ref} className="max-w-[1400px] mx-auto px-6 lg:px-10 relative">
        {/* Main CTA */}
        <div className={`max-w-2xl mx-auto text-center fade-in-up ${isVisible ? "visible" : ""}`}>
          <span className="text-[11px] font-mono tracking-[0.2em] uppercase text-[#836EF9] mb-6 block">
            Early Access
          </span>

          <h2 className="text-3xl sm:text-4xl lg:text-6xl font-bold tracking-tight text-white leading-[1.05] mb-6">
            Give your glasses
            <br />
            <span className="text-gradient-purple">a wallet.</span>
          </h2>

          <p className="text-lg text-white/40 max-w-md mx-auto mb-10 leading-relaxed">
            The first AI payment agent that lives in your glasses.
            Join the waitlist and be the first to try it.
          </p>

          {!submitted ? (
            <div className={`space-y-4 fade-in-up ${isVisible ? "visible" : ""}`} style={{ transitionDelay: "200ms" }}>
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 px-5 py-4 bg-[#111] border border-white/10 text-white text-sm font-mono focus:outline-none focus:border-[#836EF9] placeholder:text-white/20 disabled:opacity-50 transition-colors"
                  required
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-4 bg-[#836EF9] text-white text-[12px] font-bold tracking-[0.15em] uppercase font-mono hover:bg-[#A18FFF] transition-all duration-300 hover:shadow-[0_0_30px_rgba(131,110,249,0.4)] inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Join Waitlist
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </>
                  )}
                </button>
              </form>
              {error && (
                <p className="text-sm text-red-400 font-mono">{error}</p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3 text-[#836EF9]">
              <div className="w-2 h-2 bg-[#836EF9] rounded-full animate-pulse" />
              <span className="font-medium text-lg">You&apos;re on the list. Check your email.</span>
            </div>
          )}
        </div>

        {/* Business CTA */}
        <div
          className={`max-w-2xl mx-auto mt-16 pt-16 border-t border-white/5 fade-in-up ${isVisible ? "visible" : ""}`}
          style={{ transitionDelay: "400ms" }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <span className="text-[11px] font-mono tracking-[0.15em] uppercase text-white/30 mb-2 block">
                For Merchants
              </span>
              <p className="text-lg font-bold text-white">
                Accept agent payments today
              </p>
              <p className="text-sm text-white/40 mt-1">
                Show a QR code — the agent handles the rest
              </p>
            </div>
            <Link
              href="/receive"
              className="group inline-flex items-center justify-center gap-3 px-8 py-4 border border-white/10 text-white text-[12px] font-bold tracking-[0.15em] uppercase font-mono hover:border-[#836EF9] transition-all duration-300 whitespace-nowrap"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
              </svg>
              Receive Payments
              <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
