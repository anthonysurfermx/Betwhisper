"use client"

import { useEffect, useState } from "react"

export function HeroSection() {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(true)
  }, [])

  return (
    <section className="relative h-screen min-h-[700px] flex items-center justify-center overflow-hidden">
      {/* Background video */}
      <div className="absolute inset-0 bg-[#0a0a0a]">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover opacity-50"
        >
          <source src="https://17usg51unah8rfmu.public.blob.vercel-storage.com/hero-video.mp4" type="video/mp4" />
        </video>

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a]/70 via-transparent to-[#0a0a0a]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/80 via-[#0a0a0a]/30 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-10 w-full">
        <div className="max-w-3xl">
          {/* Eyebrow */}
          <div
            className={`flex items-center gap-3 mb-8 transition-all duration-1000 delay-300 ${
              loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            <div className="w-1.5 h-1.5 bg-[#836EF9] rounded-full animate-pulse" />
            <span className="text-[11px] font-medium tracking-[0.2em] uppercase font-mono text-white/40">
              Autonomous payment agent
            </span>
          </div>

          {/* Main headline */}
          <h1
            className={`text-[clamp(2.5rem,7vw,5.5rem)] font-bold leading-[0.95] tracking-tight mb-8 transition-all duration-1000 delay-500 ${
              loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <span className="text-white">It sees.</span>
            <br />
            <span className="text-gradient-purple">It listens.</span>
            <br />
            <span className="text-white/40">It pays.</span>
          </h1>

          {/* Subtitle */}
          <p
            className={`text-lg lg:text-xl text-white/50 max-w-lg leading-relaxed mb-10 transition-all duration-1000 delay-700 ${
              loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            An AI agent that lives in your glasses. It perceives the world through your camera,
            understands your voice, and executes payments on-chain. Autonomously.
          </p>

          {/* CTAs */}
          <div
            className={`flex flex-col sm:flex-row items-start gap-4 transition-all duration-1000 delay-900 ${
              loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            <a
              href="#waitlist"
              className="group px-8 py-4 bg-[#836EF9] text-white text-[12px] font-bold tracking-[0.15em] uppercase font-mono hover:bg-[#A18FFF] transition-all duration-300 hover:shadow-[0_0_30px_rgba(131,110,249,0.4)] inline-flex items-center gap-3"
            >
              Join the waitlist
              <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        className={`absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 transition-all duration-1000 delay-[1200ms] ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/30">
          Scroll
        </span>
        <div className="w-[1px] h-8 bg-gradient-to-b from-white/30 to-transparent animate-pulse" />
      </div>
    </section>
  )
}
