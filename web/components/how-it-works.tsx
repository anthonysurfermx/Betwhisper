"use client"

import { useScrollAnimation } from "@/hooks/use-scroll-animation"

const steps = [
  {
    number: "01",
    title: "Perceive",
    description: "The agent sees through your glasses camera. It detects QR codes, reads prices, and understands the scene around you — in real time.",
    visual: "scan",
  },
  {
    number: "02",
    title: "Understand",
    description: "Speak naturally. The agent understands intent, amounts, and emotion — if you hesitate, it pauses. If you're confident, it moves fast.",
    visual: "voice",
  },
  {
    number: "03",
    title: "Execute",
    description: "The agent signs the transaction on-device, broadcasts to Monad, and confirms — all autonomously. No phone. No taps. No wallet apps.",
    visual: "check",
  },
]

export function HowItWorks() {
  const { ref, isVisible } = useScrollAnimation(0.1)

  return (
    <section id="how-it-works" className="py-24 lg:py-40 relative">
      {/* Subtle background accent */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#836EF9]/[0.02] to-transparent pointer-events-none" />

      <div ref={ref} className="max-w-[1400px] mx-auto px-6 lg:px-10 relative">
        {/* Section header */}
        <div className={`text-center mb-20 lg:mb-28 fade-in-up ${isVisible ? "visible" : ""}`}>
          <span className="text-[11px] font-mono tracking-[0.2em] uppercase text-[#836EF9] mb-6 block">
            Agent loop
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-6xl font-bold tracking-tight text-white leading-[1.05]">
            Perceive. Understand.
            <br />
            <span className="text-white/30">Execute.</span>
          </h2>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`relative fade-in-up ${isVisible ? "visible" : ""}`}
              style={{ transitionDelay: `${(index + 1) * 200}ms` }}
            >
              {/* Connector line (desktop) */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-16 right-0 w-full h-[1px] bg-gradient-to-r from-white/10 to-white/5 z-0" />
              )}

              <div className="relative z-10 p-8 lg:p-10">
                {/* Step number */}
                <div className="flex items-center gap-4 mb-8">
                  <span className="text-5xl lg:text-6xl font-bold text-gradient-purple tabular-nums">
                    {step.number}
                  </span>
                </div>

                {/* Visual placeholder */}
                <div className="relative w-full aspect-[4/3] bg-[#111] mb-8 overflow-hidden group">
                  {/*
                    IMAGE/VIDEO PLACEHOLDER: Replace with step visuals
                    <img src={`/step-${index + 1}.jpg`} alt={step.title} className="w-full h-full object-cover" />
                  */}

                  {/* Placeholder animation */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    {step.visual === "scan" && (
                      <div className="w-20 h-20 border-2 border-[#836EF9]/30 rounded-lg relative">
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#836EF9]" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#836EF9]" />
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#836EF9]" />
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#836EF9]" />
                        <div className="absolute top-1/2 left-2 right-2 h-[2px] bg-[#836EF9]/50 animate-pulse" />
                      </div>
                    )}
                    {step.visual === "voice" && (
                      <div className="flex items-end gap-1">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className="w-1 bg-[#836EF9]/50 rounded-full animate-pulse"
                            style={{
                              height: `${20 + Math.random() * 30}px`,
                              animationDelay: `${i * 0.15}s`,
                            }}
                          />
                        ))}
                      </div>
                    )}
                    {step.visual === "check" && (
                      <div className="w-16 h-16 rounded-full border-2 border-[#836EF9]/40 flex items-center justify-center">
                        <svg className="w-8 h-8 text-[#836EF9]/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-2xl font-bold tracking-tight text-white mb-3">
                  {step.title}
                </h3>

                {/* Description */}
                <p className="text-white/40 leading-relaxed">
                  {step.description}
                </p>
              </div>

              {/* Mobile divider */}
              {index < steps.length - 1 && (
                <div className="lg:hidden h-[1px] bg-white/5 mx-8" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
