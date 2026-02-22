import Link from "next/link"

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[#0a0a0a]">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16 lg:py-20">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 lg:gap-16">
          {/* Brand */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-[#836EF9] rounded-full" />
              <span className="text-[11px] font-bold tracking-[0.25em] uppercase font-mono text-white">
                VOICESWAP
              </span>
            </div>
            <p className="text-sm text-white/30 max-w-xs leading-relaxed">
              The first AI payment agent that lives in your glasses.
              Built on Monad.
            </p>
          </div>

          {/* Product */}
          <div className="space-y-4">
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase font-mono text-white/20">
              Product
            </span>
            <div className="flex flex-col gap-3">
              <a href="#waitlist" className="text-sm text-white/40 hover:text-[#836EF9] transition-colors duration-300">
                Get Early Access
              </a>
              <Link href="/receive" className="text-sm text-white/40 hover:text-[#836EF9] transition-colors duration-300">
                Merchants
              </Link>
              <a href="#experience" className="text-sm text-white/40 hover:text-[#836EF9] transition-colors duration-300">
                The Agent
              </a>
            </div>
          </div>

          {/* Resources */}
          <div className="space-y-4">
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase font-mono text-white/20">
              Resources
            </span>
            <div className="flex flex-col gap-3">
              <a
                href="https://github.com/anthropicsurfermx/voiceswap"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-white/40 hover:text-[#836EF9] transition-colors duration-300"
              >
                GitHub
              </a>
              <a
                href="https://monad.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-white/40 hover:text-[#836EF9] transition-colors duration-300"
              >
                Monad
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-12 mt-12 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-[10px] font-mono tracking-[0.1em] uppercase text-white/20">
            &copy; 2026 VOICESWAP
          </p>
          <p className="text-[10px] font-mono tracking-[0.1em] uppercase text-white/20">
            Built on Monad
          </p>
        </div>
      </div>
    </footer>
  )
}
