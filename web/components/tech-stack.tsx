"use client"

export function TechStack() {
  const technologies = ["Monad", "Gemini Live", "Meta Ray-Ban", "USDC", "On-Device Signing", "Multimodal AI"]

  return (
    <section className="py-6 overflow-hidden border-y border-white/5">
      <div className="relative">
        {/* Marquee animation */}
        <div className="flex animate-marquee whitespace-nowrap">
          {[...technologies, ...technologies, ...technologies, ...technologies].map((tech, index) => (
            <span
              key={index}
              className="mx-8 lg:mx-12 text-[11px] font-bold tracking-[0.2em] uppercase font-mono text-white/20"
            >
              {tech}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
