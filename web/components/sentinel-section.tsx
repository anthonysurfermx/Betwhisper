"use client"

import { useScrollAnimation } from "@/hooks/use-scroll-animation"

const capabilities = [
  {
    label: "High-value alerts",
    description: "Transactions over $100 trigger explicit voice confirmation. The agent won't rush you.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
  },
  {
    label: "Emotion awareness",
    description: "Detects hesitation or doubt in your voice. If you sound uncertain, it pauses and asks again.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
      </svg>
    ),
  },
  {
    label: "Merchant verification",
    description: "First payment to an unknown address? The agent warns you and visually confirms the QR.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    label: "Ambient filtering",
    description: "Proactive audio mode filters background noise. The agent only responds when you speak to it directly.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
    ),
  },
]

export function SentinelSection() {
  const { ref, isVisible } = useScrollAnimation(0.1)

  return (
    <section className="py-24 lg:py-40 relative overflow-hidden">
      {/* Background accent */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#836EF9]/20 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#836EF9]/20 to-transparent" />
      </div>

      <div ref={ref} className="max-w-[1400px] mx-auto px-6 lg:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
          {/* Left - Headline */}
          <div className={`fade-in-up ${isVisible ? "visible" : ""}`}>
            <span className="text-[11px] font-mono tracking-[0.2em] uppercase text-[#836EF9] mb-6 block">
              Sentinel mode
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.05] mb-8">
              An agent that
              <br />
              <span className="text-gradient-purple">protects you.</span>
            </h2>
            <p className="text-lg text-white/40 leading-relaxed max-w-md mb-12">
              Autonomous doesn&apos;t mean reckless. The agent watches for anomalies,
              reads your emotions, and adds friction when it matters — so paying
              feels effortless, but never careless.
            </p>

            {/* Sentinel visual - pulsing shield */}
            <div className="hidden lg:flex items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border border-[#836EF9]/30 flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full border border-[#836EF9]/50 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-[#836EF9] animate-pulse" />
                  </div>
                </div>
                <div className="absolute -inset-4 rounded-full border border-[#836EF9]/10 animate-ping" style={{ animationDuration: "3s" }} />
              </div>
              <div>
                <p className="text-xs font-mono text-[#836EF9]/60 tracking-wider uppercase">Always watching</p>
                <p className="text-xs text-white/20 mt-0.5">Active during every transaction</p>
              </div>
            </div>
          </div>

          {/* Right - Capability cards */}
          <div className="space-y-4">
            {capabilities.map((cap, index) => (
              <div
                key={index}
                className={`group p-6 bg-[#111] border border-white/5 hover:border-[#836EF9]/20 transition-all duration-500 fade-in-up ${isVisible ? "visible" : ""}`}
                style={{ transitionDelay: `${(index + 1) * 150}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center text-white/20 group-hover:text-[#836EF9] transition-colors duration-500">
                    {cap.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-tight text-white mb-1.5">
                      {cap.label}
                    </h3>
                    <p className="text-sm text-white/30 leading-relaxed">
                      {cap.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
