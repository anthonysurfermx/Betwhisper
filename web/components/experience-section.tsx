"use client"

import { useScrollAnimation } from "@/hooks/use-scroll-animation"

export function ExperienceSection() {
  const { ref, isVisible } = useScrollAnimation(0.1)

  return (
    <section className="relative py-24 lg:py-40 overflow-hidden">
      {/* Full-bleed background */}
      <div className="absolute inset-0 bg-[#111]">
        {/*
          BACKGROUND IMAGE/VIDEO PLACEHOLDER: Replace with immersive lifestyle media
          <img src="/experience-bg.jpg" alt="" className="w-full h-full object-cover opacity-30" />
          OR
          <video autoPlay muted loop playsInline className="w-full h-full object-cover opacity-30">
            <source src="/experience-bg.mp4" type="video/mp4" />
          </video>
        */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] via-transparent to-[#0a0a0a]" />
      </div>

      <div ref={ref} className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Left - Content */}
          <div className={`fade-in-up ${isVisible ? "visible" : ""}`}>
            <span className="text-[11px] font-mono tracking-[0.2em] uppercase text-[#836EF9] mb-6 block">
              The agent
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.05] mb-8">
              The first payment agent
              <br />
              <span className="text-gradient-purple">that lives in your glasses.</span>
            </h2>
            <p className="text-lg text-white/40 leading-relaxed mb-10 max-w-md">
              No wallets to open. No apps to switch. No screens to
              unlock. Your AI agent sees the QR code, hears the amount,
              signs the transaction, and broadcasts it on-chain. All autonomously.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8">
              <div>
                <p className="text-3xl lg:text-4xl font-bold text-white tabular-nums">&lt;1s</p>
                <p className="text-[10px] font-mono tracking-[0.15em] uppercase text-white/30 mt-1">Sub-second finality</p>
              </div>
              <div>
                <p className="text-3xl lg:text-4xl font-bold text-white tabular-nums">7+</p>
                <p className="text-[10px] font-mono tracking-[0.15em] uppercase text-white/30 mt-1">Agent tools</p>
              </div>
              <div>
                <p className="text-3xl lg:text-4xl font-bold text-gradient-purple">0</p>
                <p className="text-[10px] font-mono tracking-[0.15em] uppercase text-white/30 mt-1">Human taps needed</p>
              </div>
            </div>
          </div>

          {/* Right - Floating Glasses */}
          <div
            className={`fade-in-up ${isVisible ? "visible" : ""} flex justify-center`}
            style={{ transitionDelay: "200ms" }}
          >
            <div className="relative animate-float">
              {/* Purple glow behind glasses */}
              <div className="absolute -inset-16 bg-[#836EF9]/[0.08] rounded-full blur-[100px]" />

              {/* Glasses SVG - wayfarer style */}
              <svg
                viewBox="0 0 400 160"
                className="w-[300px] lg:w-[380px] relative z-10"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Left lens */}
                <rect x="20" y="30" width="150" height="100" rx="20" ry="20"
                  stroke="white" strokeWidth="3" fill="none" opacity="0.15" />
                <rect x="20" y="30" width="150" height="100" rx="20" ry="20"
                  stroke="#836EF9" strokeWidth="1.5" fill="none" opacity="0.3" />
                {/* Left lens tint */}
                <rect x="22" y="32" width="146" height="96" rx="18" ry="18"
                  fill="url(#lensTint)" opacity="0.08" />

                {/* Right lens */}
                <rect x="230" y="30" width="150" height="100" rx="20" ry="20"
                  stroke="white" strokeWidth="3" fill="none" opacity="0.15" />
                <rect x="230" y="30" width="150" height="100" rx="20" ry="20"
                  stroke="#836EF9" strokeWidth="1.5" fill="none" opacity="0.3" />
                {/* Right lens tint */}
                <rect x="232" y="32" width="146" height="96" rx="18" ry="18"
                  fill="url(#lensTint)" opacity="0.08" />

                {/* Bridge */}
                <path d="M170 65 Q200 50 230 65" stroke="white" strokeWidth="3" fill="none" opacity="0.15" />
                <path d="M170 65 Q200 50 230 65" stroke="#836EF9" strokeWidth="1.5" fill="none" opacity="0.3" />

                {/* Left temple */}
                <path d="M20 50 L-10 42" stroke="white" strokeWidth="3" fill="none" opacity="0.1" strokeLinecap="round" />
                <path d="M20 50 L-10 42" stroke="#836EF9" strokeWidth="1" fill="none" opacity="0.2" strokeLinecap="round" />

                {/* Right temple */}
                <path d="M380 50 L410 42" stroke="white" strokeWidth="3" fill="none" opacity="0.1" strokeLinecap="round" />
                <path d="M380 50 L410 42" stroke="#836EF9" strokeWidth="1" fill="none" opacity="0.2" strokeLinecap="round" />

                {/* Lens reflection */}
                <ellipse cx="80" cy="60" rx="30" ry="15" fill="white" opacity="0.03" transform="rotate(-15 80 60)" />
                <ellipse cx="290" cy="60" rx="30" ry="15" fill="white" opacity="0.03" transform="rotate(-15 290 60)" />

                <defs>
                  <linearGradient id="lensTint" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#836EF9" />
                    <stop offset="100%" stopColor="#A18FFF" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Shadow below glasses */}
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-[200px] h-[6px] bg-[#836EF9]/10 rounded-full blur-md" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
