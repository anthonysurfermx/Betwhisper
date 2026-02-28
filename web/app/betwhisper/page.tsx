'use client'

import Link from 'next/link'
import { useEffect, useState, useRef } from 'react'
import { ArrowRight, ArrowUpRight } from 'lucide-react'

// Scroll-triggered visibility hook
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

// Rotating assistant names — one per culture
const ASSISTANT_NAMES = [
  'Buddy',      // US
  'El Profe',   // MX
  'Mate',       // AR
  'Seu Jorge',  // BR
  'Coach',      // US/UK
  'La Guera',   // MX
  'Sensei',     // JP
  'Dona Cida',  // BR
  'Chief',      // NG
  'Don Fede',   // MX
  'Habibi',     // MENA
  'Guru',       // IN
]

function RotatingName() {
  const [index, setIndex] = useState(0)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setFading(true)
      setTimeout(() => {
        setIndex(prev => (prev + 1) % ASSISTANT_NAMES.length)
        setFading(false)
      }, 400)
    }, 2200)
    return () => clearInterval(interval)
  }, [])

  return (
    <span
      className={`inline-block transition-all duration-400 ${
        fading ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
      }`}
    >
      {ASSISTANT_NAMES[index]}
    </span>
  )
}

// Live conversation demo — tells the story in 4 lines
function ConversationDemo() {
  const [step, setStep] = useState(0)
  const [nameIdx, setNameIdx] = useState(0)

  useEffect(() => {
    const run = () => {
      setStep(0)
      setNameIdx(prev => (prev + 1) % ASSISTANT_NAMES.length)
      const delays = [800, 2400, 4000, 5800]
      return delays.map((d, i) => setTimeout(() => setStep(i + 1), d))
    }
    const initial = run()
    const loop = setInterval(() => { run() }, 10000)
    return () => { initial.forEach(clearTimeout); clearInterval(loop) }
  }, [])

  const name = ASSISTANT_NAMES[nameIdx]

  const lines = [
    { who: 'user', text: `${name}, $5 on Lakers` },
    { who: 'agent', text: '2 bots filtered. Smart money says YES at 78%.', tag: 'PROTECTS' },
    { who: 'agent', text: '12 traders near MSG went Lakers.', tag: 'CONNECTS' },
    { who: 'agent', text: 'Done. 23.8 shares via ZK pool. Deposit and trade are cryptographically unlinkable.', tag: 'SIMPLIFIES' },
  ]

  return (
    <div className="border border-[--border-light] bg-black">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[--border-light]">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
          <span className="text-[11px] text-[--text-secondary] tracking-wide">Live session</span>
        </div>
        <span className="text-[10px] text-white/40">Assistant: <span className="text-white/70 font-semibold">{name}</span></span>
      </div>
      <div className="p-5 space-y-3 min-h-[220px]">
        {lines.map((line, i) => (
          i < step && (
            <div
              key={`${nameIdx}-${i}`}
              className={`flex gap-3 items-start transition-all duration-500 ${
                line.who === 'user' ? 'justify-end' : ''
              }`}
            >
              {line.who === 'agent' && (
                <div className="w-6 h-6 border border-[--border-light] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[9px] font-bold text-white/60">{name.charAt(0)}</span>
                </div>
              )}
              <div className={`px-3 py-2 max-w-[340px] text-[13px] leading-relaxed ${
                line.who === 'user'
                  ? 'bg-white text-black'
                  : line.tag === 'PROTECTS'
                    ? 'border border-amber-500/30 text-amber-400/90'
                    : line.tag === 'CONNECTS'
                      ? 'border border-[#836EF9]/30 text-[#836EF9]/90'
                      : 'border border-emerald-500/30 text-emerald-400/90'
              }`}>
                {line.tag === 'PROTECTS' && (
                  <span className="text-[9px] font-bold tracking-wider text-amber-500 block mb-1">PROTECTS</span>
                )}
                {line.tag === 'CONNECTS' && (
                  <span className="text-[9px] font-bold tracking-wider text-[#836EF9] block mb-1">CONNECTS</span>
                )}
                {line.tag === 'SIMPLIFIES' && (
                  <span className="text-[9px] font-bold tracking-wider text-emerald-500 block mb-1">SIMPLIFIES</span>
                )}
                {line.text}
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  )
}

export default function BetWhisperLanding() {
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { setLoaded(true) }, [])

  const problem = useInView()
  const solution = useInView()
  const howItWorks = useInView()
  const privacy = useInView(0.2)
  const stack = useInView()

  return (
    <div className="min-h-screen bg-black text-white">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-b border-[--border]">
        <div className="max-w-[1200px] mx-auto px-6 flex justify-between items-center h-14">
          <Link href="/betwhisper" className="flex items-center gap-2.5">
            <div className="w-5 h-5 border border-white/20 flex items-center justify-center">
              <span className="text-[8px] font-bold">BW</span>
            </div>
            <span className="text-[13px] font-semibold tracking-tight">BetWhisper</span>
          </Link>
          <div className="flex items-center gap-6">
            <a href="#how-it-works" className="text-[13px] text-[--text-secondary] hover:text-white transition-colors hidden sm:block">How it works</a>
            <a
              href="https://github.com/anthonysurfermx/Betwhisper"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] text-[--text-secondary] hover:text-white transition-colors hidden sm:block"
            >
              GitHub
            </a>
            <Link
              href="/predict"
              className="px-4 py-2 bg-white text-black text-[13px] font-semibold hover:bg-white/90 transition-colors active:scale-[0.97]"
            >
              Launch App
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero: The Question ─── */}
      <section className="relative pt-14">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="pt-24 md:pt-36 pb-16 md:pb-28">
            {/* The big question */}
            <h1 className={`text-[clamp(2.5rem,7vw,5.5rem)] font-bold leading-[1.0] tracking-tight mb-8 max-w-4xl transition-all duration-700 delay-300 ${
              loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}>
              The first private social
              <br />
              agent layer.
            </h1>

            {/* The answer — your agent */}
            <div className={`mb-6 transition-all duration-700 delay-500 ${
              loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              <p className="text-[16px] md:text-[18px] text-[--text-secondary] max-w-lg leading-relaxed">
                Your prediction market trades go through a ZK privacy pool.
                Nobody can link your deposit to your bet — not the market maker,
                not the explorer, not even us.
                <br /><br />
                <span className="text-white/90">BetWhisper is your <RotatingName /></span> — an AI agent
                that filters bots, shows you the real crowd, and executes
                privately on-chain.
              </p>
            </div>

            {/* Identity line */}
            <div className={`mb-10 transition-all duration-700 delay-600 ${
              loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              <span className="text-[13px] text-[--text-secondary] border-l-2 border-[#836EF9]/40 pl-3">
                Built on Monad &middot; Privacy by Unlink &middot; Execution on Polymarket
              </span>
            </div>

            {/* CTAs */}
            <div className={`flex flex-col sm:flex-row items-start gap-3 mb-16 transition-all duration-700 delay-700 ${
              loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              <Link
                href="/predict"
                className="px-6 py-3 bg-white text-black text-[14px] font-semibold hover:bg-white/90 transition-all active:scale-[0.97] flex items-center gap-2"
              >
                Try BetWhisper <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/pulse"
                className="px-6 py-3 border border-[#836EF9]/30 text-[14px] text-[#836EF9] hover:bg-[#836EF9]/5 transition-all active:scale-[0.97]"
              >
                Open Social Map
              </Link>
            </div>

            {/* Demo — proof, not promise */}
            <div className={`transition-all duration-1000 delay-800 ${
              loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}>
              <ConversationDemo />
            </div>
          </div>
        </div>
        <div className="border-t border-[--border]" />
      </section>

      {/* ─── The Problem: You don't know. ─── */}
      <section ref={problem.ref} className="border-b border-[--border]">
        <div className="max-w-[1200px] mx-auto">
          <div className="px-6 py-12 md:py-16 border-b border-[--border]">
            <h2 className={`text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-tight transition-all duration-700 ${
              problem.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              You don&apos;t know.
            </h2>
            <p className={`text-[14px] text-[--text-secondary] mt-3 max-w-md transition-all duration-700 delay-100 ${
              problem.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              Today&apos;s prediction markets have three blind spots.
            </p>
          </div>

          <div className="grid md:grid-cols-3">
            {[
              { label: 'Manipulated', desc: 'Bots inflate odds. You can\'t tell real sentiment from manufactured consensus.' },
              { label: 'Isolated', desc: 'You trade alone. No idea what people around you think about the same market.' },
              { label: 'Exposed', desc: 'Every trade is public. Your wallet, your position, your identity — all linked on-chain for anyone to see.' },
            ].map((item, i) => (
              <div
                key={item.label}
                className={`px-6 py-10 ${i < 2 ? 'md:border-r border-[--border]' : ''} border-b md:border-b-0 border-[--border] transition-all duration-700`}
                style={{ transitionDelay: `${i * 100 + 200}ms` }}
              >
                <span className="text-[12px] font-mono text-red-400/60 block mb-3">{item.label}</span>
                <p className={`text-[14px] text-[--text-secondary] leading-relaxed transition-all duration-700 ${
                  problem.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── The Answer: Now you do. ─── */}
      <section ref={solution.ref} className="border-b border-[--border]">
        <div className="max-w-[1200px] mx-auto">
          <div className="px-6 py-14 md:py-20 border-b border-[--border]">
            <h2 className={`text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-tight max-w-2xl transition-all duration-700 ${
              solution.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              Now you do.
            </h2>
            <p className={`text-[14px] text-[--text-secondary] mt-3 max-w-md transition-all duration-700 delay-100 ${
              solution.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              Your agent protects, connects, and simplifies — so you trade with clarity, not blindness.
            </p>
          </div>

          <div className="grid md:grid-cols-3">
            {/* Protects */}
            <div className={`px-6 py-10 md:border-r border-[--border] border-b md:border-b-0 border-[--border] transition-all duration-700 ${
              solution.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                <span className="text-[11px] text-amber-500 font-semibold tracking-wide">PROTECTS</span>
              </div>
              <h3 className="text-[20px] font-bold mb-2">Filters bots. Hides your identity.</h3>
              <p className="text-[13px] text-[--text-secondary] leading-relaxed mb-5">
                Agent Radar scans every holder and flags bots before you trade. Your MON goes through Unlink&apos;s ZK privacy pool — deposit and bet execution appear as two unrelated transactions on-chain.
              </p>
              <div className="space-y-2 text-[12px]">
                <div className="flex justify-between py-1.5 border-b border-[--border]">
                  <span className="text-[--text-secondary]">Bot detection</span>
                  <span className="text-white/60 font-mono">7 behavioral signals</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[--border]">
                  <span className="text-[--text-secondary]">Privacy layer</span>
                  <span className="text-white/60 font-mono">Unlink ZK proofs</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[--border]">
                  <span className="text-[--text-secondary]">Hidden</span>
                  <span className="text-white/60 font-mono">amount · sender · recipient</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-[--text-secondary]">Chain</span>
                  <span className="text-white/60 font-mono">Monad Testnet</span>
                </div>
              </div>
            </div>

            {/* Connects */}
            <div className={`px-6 py-10 md:border-r border-[--border] border-b md:border-b-0 border-[--border] transition-all duration-700 delay-100 ${
              solution.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-1.5 bg-[#836EF9] rounded-full" />
                <span className="text-[11px] text-[#836EF9] font-semibold tracking-wide">CONNECTS</span>
              </div>
              <h3 className="text-[20px] font-bold mb-2">Shows you the crowd around you.</h3>
              <p className="text-[13px] text-[--text-secondary] leading-relaxed mb-5">
                Social Map is a live heatmap of what people near you are trading. Opt-in only — activate with PIN + Face ID. Your exact location is never shared.
              </p>
              <div className="space-y-2 text-[12px]">
                <div className="flex justify-between py-1.5 border-b border-[--border]">
                  <span className="text-[--text-secondary]">Heatmap</span>
                  <span className="text-white/60 font-mono">real-time push</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[--border]">
                  <span className="text-[--text-secondary]">Activation</span>
                  <span className="text-white/60 font-mono">PIN + Face ID</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-[--text-secondary]">GPS privacy</span>
                  <span className="text-white/60 font-mono">~80m fuzzing</span>
                </div>
              </div>
            </div>

            {/* Simplifies */}
            <div className={`px-6 py-10 transition-all duration-700 delay-200 ${
              solution.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                <span className="text-[11px] text-emerald-500 font-semibold tracking-wide">SIMPLIFIES</span>
              </div>
              <h3 className="text-[20px] font-bold mb-2">One message. Two chains. Done.</h3>
              <p className="text-[13px] text-[--text-secondary] leading-relaxed mb-5">
                Tell your agent what to trade. It handles MON payment on Monad, order execution on Polymarket, and cashout back to MON. Text, voice, or smart glasses.
              </p>
              <div className="space-y-2 text-[12px]">
                <div className="flex justify-between py-1.5 border-b border-[--border]">
                  <span className="text-[--text-secondary]">Intent</span>
                  <span className="text-white/60 font-mono">Monad</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[--border]">
                  <span className="text-[--text-secondary]">Execution</span>
                  <span className="text-white/60 font-mono">Polymarket CLOB</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-[--text-secondary]">Channels</span>
                  <span className="text-white/60 font-mono">text · voice · glasses</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" ref={howItWorks.ref} className="border-b border-[--border]">
        <div className="max-w-[1200px] mx-auto">
          <div className="px-6 py-14 md:py-20 border-b border-[--border]">
            <h2 className={`text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-tight transition-all duration-700 ${
              howItWorks.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              Ask. Scan. Trade. Track.
            </h2>
          </div>

          <div className="grid md:grid-cols-4">
            {[
              { num: '01', title: 'Ask', desc: 'Search any market. Sports, crypto, politics. Voice or text.' },
              { num: '02', title: 'Scan', desc: 'Agent Radar filters bots. Smart money signals surface real conviction.' },
              { num: '03', title: 'Trade', desc: 'MON deposits into Unlink ZK pool. Private transfer to server. CLOB executes on Polymarket. Zero link between you and the trade.' },
              { num: '04', title: 'Track', desc: 'Live P&L + Social Map heatmap. See what your city is trading.' },
            ].map((s, i) => (
              <div
                key={s.num}
                className={`px-6 py-10 ${i < 3 ? 'md:border-r border-[--border]' : ''} border-b md:border-b-0 border-[--border] transition-all duration-700`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <span className="text-[12px] font-mono text-[--text-tertiary] block mb-5">{s.num}</span>
                <h3 className="text-[20px] font-bold mb-2">{s.title}</h3>
                <p className="text-[13px] text-[--text-secondary] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Privacy Architecture ─── */}
      <section ref={privacy.ref} className="border-b border-[--border]">
        <div className="max-w-[1200px] mx-auto">
          <div className="px-6 py-14 md:py-20 border-b border-[--border]">
            <h2 className={`text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-tight transition-all duration-700 ${
              privacy.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              How privacy works.
            </h2>
            <p className={`text-[14px] text-[--text-secondary] mt-3 max-w-lg transition-all duration-700 delay-100 ${
              privacy.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              Your deposit and your trade appear as two unrelated transactions. The ZK proof guarantees correctness without revealing the connection.
            </p>
          </div>

          {/* Flow diagram — animated */}
          <div className="px-6 py-10">
            <div className="grid md:grid-cols-5 gap-px items-stretch">
              {/* Step 1: Deposit */}
              <div className={`border border-amber-500/20 p-5 bg-black transition-all duration-700 ${
                privacy.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`} style={{ transitionDelay: '200ms' }}>
                <span className="text-[11px] font-mono text-amber-400 block mb-2">STEP 1</span>
                <h4 className="text-[15px] font-bold mb-1">Deposit</h4>
                <p className="text-[12px] text-[--text-secondary] mb-4">MON into Unlink Pool</p>
                <div className="text-[11px] font-mono text-white/40 leading-relaxed space-y-0.5">
                  <div>Sender <span className="text-amber-400">visible</span></div>
                  <div>Amount <span className="text-amber-400">visible</span></div>
                  <div>Recipient <span className="text-emerald-400">hidden</span></div>
                </div>
              </div>

              {/* Arrow 1→2 */}
              <div className={`hidden md:flex items-center justify-center transition-all duration-500 ${
                privacy.visible ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'
              }`} style={{ transitionDelay: '600ms' }}>
                <div className="flex items-center gap-1">
                  <div className="h-px w-8 bg-gradient-to-r from-amber-500/40 to-emerald-500/40" style={{
                    animation: privacy.visible ? 'flowPulse 2s ease-in-out infinite' : 'none',
                  }} />
                  <div className="text-emerald-400/60 text-lg font-mono">&rarr;</div>
                </div>
              </div>

              {/* Step 2: Private Transfer */}
              <div className={`border border-emerald-500/20 p-5 bg-black transition-all duration-700 ${
                privacy.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`} style={{ transitionDelay: '800ms' }}>
                <span className="text-[11px] font-mono text-emerald-400 block mb-2">STEP 2</span>
                <h4 className="text-[15px] font-bold mb-1">Private Transfer</h4>
                <p className="text-[12px] text-[--text-secondary] mb-4">ZK proof generated in browser</p>
                <div className="text-[11px] font-mono text-white/40 leading-relaxed space-y-0.5">
                  <div>Sender <span className="text-emerald-400">hidden</span></div>
                  <div>Amount <span className="text-emerald-400">hidden</span></div>
                  <div>Recipient <span className="text-emerald-400">hidden</span></div>
                </div>
                {/* ZK shimmer effect */}
                {privacy.visible && (
                  <div className="mt-3 h-px w-full overflow-hidden rounded">
                    <div className="h-full bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" style={{
                      animation: 'zkShimmer 2.5s ease-in-out infinite',
                    }} />
                  </div>
                )}
              </div>

              {/* Arrow 2→3 */}
              <div className={`hidden md:flex items-center justify-center transition-all duration-500 ${
                privacy.visible ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'
              }`} style={{ transitionDelay: '1200ms' }}>
                <div className="flex items-center gap-1">
                  <div className="h-px w-8 bg-gradient-to-r from-emerald-500/40 to-[#836EF9]/40" style={{
                    animation: privacy.visible ? 'flowPulse 2s ease-in-out 0.5s infinite' : 'none',
                  }} />
                  <div className="text-[#836EF9]/60 text-lg font-mono">&rarr;</div>
                </div>
              </div>

              {/* Step 3: Trade Executed */}
              <div className={`border border-[#836EF9]/20 p-5 bg-black transition-all duration-700 ${
                privacy.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`} style={{ transitionDelay: '1400ms' }}>
                <span className="text-[11px] font-mono text-[#836EF9] block mb-2">STEP 3</span>
                <h4 className="text-[15px] font-bold mb-1">Trade Executed</h4>
                <p className="text-[12px] text-[--text-secondary] mb-4">Polymarket CLOB via server</p>
                <div className="text-[11px] font-mono text-white/40 leading-relaxed space-y-0.5">
                  <div>Different address</div>
                  <div>No link to deposit</div>
                  <div className="text-[#836EF9]/80">Identity protected</div>
                </div>
              </div>
            </div>

            {/* Privacy matrix */}
            <div className="mt-10 border border-[--border]">
              <div className="px-5 py-3 border-b border-[--border] flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                <span className="text-[11px] text-[--text-secondary] tracking-wide">Unlink Privacy Matrix — what the blockchain sees</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-[--border]">
                      <th className="px-5 py-3 text-left text-[--text-secondary] font-normal">Operation</th>
                      <th className="px-5 py-3 text-left text-[--text-secondary] font-normal">Amount</th>
                      <th className="px-5 py-3 text-left text-[--text-secondary] font-normal">Sender</th>
                      <th className="px-5 py-3 text-left text-[--text-secondary] font-normal">Recipient</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[--border]">
                      <td className="px-5 py-3 text-white/80 font-mono">Deposit</td>
                      <td className="px-5 py-3 text-amber-400 font-mono">Visible</td>
                      <td className="px-5 py-3 text-amber-400 font-mono">Visible</td>
                      <td className="px-5 py-3 text-emerald-400 font-mono">Hidden</td>
                    </tr>
                    <tr className="border-b border-[--border]">
                      <td className="px-5 py-3 text-white/80 font-mono">Transfer</td>
                      <td className="px-5 py-3 text-emerald-400 font-mono">Hidden</td>
                      <td className="px-5 py-3 text-emerald-400 font-mono">Hidden</td>
                      <td className="px-5 py-3 text-emerald-400 font-mono">Hidden</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-3 text-white/80 font-mono">Withdraw</td>
                      <td className="px-5 py-3 text-amber-400 font-mono">Visible</td>
                      <td className="px-5 py-3 text-emerald-400 font-mono">Hidden</td>
                      <td className="px-5 py-3 text-amber-400 font-mono">Visible</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-[12px] text-[--text-tertiary] mt-4 font-mono">
              Deposit tx and withdrawal tx are cryptographically unlinkable. Verified by ZK proofs on Monad.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Built with ─── */}
      <section ref={stack.ref} className="border-b border-[--border]">
        <div className="max-w-[1200px] mx-auto">
          <div className="px-6 py-12">
            <span className="text-[13px] text-[--text-secondary] block mb-6">Built with</span>
            <div className={`grid grid-cols-3 md:grid-cols-6 gap-px bg-[--border] transition-all duration-700 ${
              stack.visible ? 'opacity-100' : 'opacity-0'
            }`}>
              {[
                'Monad', 'Unlink', 'Polymarket', 'Gemini', 'Agent Radar', 'Ray-Ban Meta',
              ].map(name => (
                <div key={name} className="bg-black px-4 py-4 text-center">
                  <span className="text-[13px] font-semibold text-white/60">{name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA: Close the loop ─── */}
      <section className="grid-dashed">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-32 text-center">
          <p className="text-[14px] text-[--text-secondary] mb-4">
            Your trades. Your identity. Protected by math.
          </p>
          <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-bold tracking-tight mb-3">
            Trade privately. Know the crowd.
          </h2>
          <p className="text-[15px] text-[--text-secondary] max-w-sm mx-auto mb-8">
            Name your agent. Start whispering.
          </p>
          <Link
            href="/predict"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-black text-[14px] font-semibold hover:bg-white/90 transition-all active:scale-[0.97]"
          >
            Launch BetWhisper <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[--border]">
        <div className="max-w-[1200px] mx-auto px-6 py-5 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-4 h-4 border border-white/20 flex items-center justify-center">
              <span className="text-[7px] font-bold">BW</span>
            </div>
            <span className="text-[12px] text-white/30">BetWhisper — the first private social agent layer for prediction markets</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/anthonysurfermx/Betwhisper"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] text-[--text-tertiary] hover:text-white transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://github.com/anthonysurfermx/polymarket-agent-radar-API"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] text-[--text-tertiary] hover:text-white transition-colors flex items-center gap-1"
            >
              Agent Radar API <ArrowUpRight className="w-3 h-3" />
            </a>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              <span className="text-[11px] text-emerald-500/80">Live</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
