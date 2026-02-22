"use client"

import { useScrollAnimation } from "@/hooks/use-scroll-animation"

const galleryItems = [
  {
    label: "Mexico City",
    caption: "Agent pays for juice — hands-free",
    aspect: "aspect-[4/5]",
    span: "col-span-1 row-span-1",
    video: "https://17usg51unah8rfmu.public.blob.vercel-storage.com/gallery-1.mp4",
  },
  {
    label: "Tokyo",
    caption: "Late night ramen — the agent handles it",
    aspect: "aspect-[4/3]",
    span: "col-span-1 row-span-1",
    video: "https://17usg51unah8rfmu.public.blob.vercel-storage.com/gallery-2.mp4",
  },
  {
    label: "Rio de Janeiro",
    caption: "Voice command, on-chain settlement",
    aspect: "aspect-[3/4]",
    span: "col-span-1 row-span-1 md:row-span-2",
    video: "https://17usg51unah8rfmu.public.blob.vercel-storage.com/gallery-3.mp4",
  },
  {
    label: "Bangkok",
    caption: "Street food — scan, speak, settled on Monad",
    aspect: "aspect-[16/9]",
    span: "col-span-1 md:col-span-2 row-span-1",
    video: "https://17usg51unah8rfmu.public.blob.vercel-storage.com/gallery-4.mp4",
  },
]

export function LifestyleGallery() {
  const { ref, isVisible } = useScrollAnimation(0.1)

  return (
    <section id="experience" className="py-24 lg:py-32 overflow-hidden">
      <div ref={ref} className="max-w-[1400px] mx-auto px-6 lg:px-10">
        {/* Section header */}
        <div className={`mb-16 fade-in-up ${isVisible ? "visible" : ""}`}>
          <span className="text-[11px] font-mono tracking-[0.2em] uppercase text-[#836EF9] mb-4 block">
            In the wild
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.1]">
            The agent goes
            <br />
            <span className="text-white/30">where you go.</span>
          </h2>
        </div>

        {/* Gallery grid - images/videos to be replaced */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4">
          {galleryItems.map((item, index) => (
            <div
              key={index}
              className={`${item.span} fade-in-up ${isVisible ? "visible" : ""}`}
              style={{ transitionDelay: `${(index + 1) * 150}ms` }}
            >
              <div className={`relative ${item.aspect} bg-[#151515] overflow-hidden group cursor-pointer`}>
                <video
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                >
                  <source src={item.video} type="video/mp4" />
                </video>

                {/* Dark overlay matching hero style */}
                <div className="absolute inset-0 bg-black/40 pointer-events-none" />

                {/* Hover overlay with label */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-[#836EF9] block mb-1">
                      {item.label}
                    </span>
                    <p className="text-sm text-white/80">{item.caption}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
