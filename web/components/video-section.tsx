"use client"

import { useState } from "react"
import { X } from "lucide-react"

export function VideoSection() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Video Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="group inline-flex items-center gap-3 px-8 py-4 border border-white/20 text-white text-[12px] font-bold tracking-[0.15em] uppercase font-mono hover:border-[#836EF9] hover:text-[#836EF9] transition-all duration-300"
      >
        <div className="w-8 h-8 rounded-full border border-current flex items-center justify-center group-hover:bg-[#836EF9] group-hover:border-[#836EF9] group-hover:text-white transition-all duration-300">
          <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        Watch Demo
      </button>

      {/* Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          onClick={() => setIsOpen(false)}
        >
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-6 right-6 p-3 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <div
            className="relative w-full max-w-sm aspect-[9/16] bg-black overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              className="w-full h-full object-cover"
              controls
              autoPlay
              playsInline
            >
              <source src="https://17usg51unah8rfmu.public.blob.vercel-storage.com/demo.mp4" type="video/mp4" />
              <source src="https://17usg51unah8rfmu.public.blob.vercel-storage.com/demo.mov" type="video/quicktime" />
              Your browser does not support the video tag.
            </video>
          </div>

          <p className="absolute bottom-8 left-0 right-0 text-center text-[11px] font-mono tracking-[0.15em] uppercase text-white/30">
            Voice payment on smart AI glasses
          </p>
        </div>
      )}
    </>
  )
}
