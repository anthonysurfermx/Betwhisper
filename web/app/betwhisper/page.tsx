'use client'

import Link from 'next/link'
import { useEffect, useState, useRef } from 'react'
import { ArrowRight, ArrowUpRight, ChevronDown } from 'lucide-react'

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

// Navbar dropdown (hover)
function NavDropdown({ label, items }: { label: string; items: { title: string; desc: string; href: string }[] }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="relative hidden sm:block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button className="flex items-center gap-1 text-[13px] text-[--text-secondary] hover:text-white transition-colors">
        {label}
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 pt-2 z-50">
          <div className="border border-[--border-light] bg-black w-[260px]">
            {items.map((item) => (
              <a
                key={item.href + item.title}
                href={item.href}
                className="block px-4 py-3 hover:bg-white/5 transition-colors border-b border-[--border] last:border-b-0"
              >
                <span className="text-[13px] text-white font-semibold block">{item.title}</span>
                <span className="text-[11px] text-[--text-secondary] block mt-0.5">{item.desc}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
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
  const protocol = useInView(0.15)
  const social = useInView(0.15)
  const glasses = useInView(0.15)
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
            <NavDropdown
              label="Social"
              items={[
                { title: 'Social Pulse Map', desc: 'Live heatmap of trading activity near you', href: '#social' },
                { title: 'Group Trading', desc: 'Compete on leaderboards with your crew', href: '#social' },
              ]}
            />
            <NavDropdown
              label="Glasses"
              items={[
                { title: 'Voice-First Trading', desc: 'Trade from your Meta Ray-Ban glasses', href: '#glasses' },
                { title: 'Hands-Free Experience', desc: 'No phone needed — just speak', href: '#glasses' },
              ]}
            />
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

            {/* The answer — judge-optimized copy */}
            <div className={`mb-6 transition-all duration-700 delay-500 ${
              loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              <p className="text-[16px] md:text-[18px] text-[--text-secondary] max-w-lg leading-relaxed">
                A permissionless, self-custodial AI agent for information markets.
                Your trades go through a ZK privacy pool — positions are shielded,
                deposits are unlinkable, and execution is censorship-resistant.
                Privacy by default, not by choice.
                <br /><br />
                <span className="text-white/90">BetWhisper is your <RotatingName /></span> — an autonomous agent
                that filters bots, shows you the real crowd, and executes
                privately on-chain.
              </p>
            </div>

            {/* Identity line */}
            <div className={`mb-10 transition-all duration-700 delay-600 ${
              loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              <span className="text-[13px] text-[--text-secondary] border-l-2 border-[#836EF9]/40 pl-3">
                Monad-native &middot; ZK privacy by Unlink &middot; AI-driven DeFi &middot; Open source
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
              Today&apos;s information markets have three blind spots.
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
              <h3 className="text-[20px] font-bold mb-2">Filters bots. Shields your identity.</h3>
              <p className="text-[13px] text-[--text-secondary] leading-relaxed mb-5">
                Agent Radar scans every holder and flags bots before you trade. Your MON goes through Unlink&apos;s ZK privacy pool — deposit and trade execution appear as two unrelated, unlinkable transactions on-chain.
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
                  <span className="text-[--text-secondary]">Shielded</span>
                  <span className="text-white/60 font-mono">amount · sender · recipient</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-[--text-secondary]">Chain</span>
                  <span className="text-white/60 font-mono">Monad (10,000 TPS)</span>
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
                Social Pulse Map is a live heatmap of what people near you are trading. Opt-in only — activate with PIN + Face ID. Your exact location is never shared. Fair access to crowd sentiment.
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
                Tell your autonomous agent what to trade. It handles MON payment on Monad, order execution on Polymarket CLOB, and cashout back to MON. Voice-first — text, voice, or smart glasses.
              </p>
              <div className="space-y-2 text-[12px]">
                <div className="flex justify-between py-1.5 border-b border-[--border]">
                  <span className="text-[--text-secondary]">Intent</span>
                  <span className="text-white/60 font-mono">Monad (1s finality)</span>
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
              { num: '01', title: 'Ask', desc: 'Search any information market. Sports, crypto, politics. Voice or text — frictionless.' },
              { num: '02', title: 'Scan', desc: 'Agent Radar filters bots. Smart money signals surface real conviction. Provably accurate price discovery.' },
              { num: '03', title: 'Trade', desc: 'MON deposits into Unlink ZK pool. Private transfer to server. CLOB executes on Polymarket. Zero link between you and the trade.' },
              { num: '04', title: 'Track', desc: 'Live P&L + Social Pulse heatmap. See what your city is trading — anonymous sentiment, verified humans.' },
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
              Your deposit and your trade appear as two unrelated transactions. Zero-knowledge proofs guarantee correctness without revealing the connection. Provably secure unlinkability.
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
                <p className="text-[12px] text-[--text-secondary] mb-4">ZK proof generated client-side</p>
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
              Deposit tx and withdrawal tx are cryptographically unlinkable. Verified by zero-knowledge proofs on Monad. Provably secure.
            </p>
          </div>
        </div>
      </section>

      {/* ─── BetWhisper Protocol ─── */}
      <section id="protocol" ref={protocol.ref} className="border-b border-[--border]">
        <div className="max-w-[1200px] mx-auto">
          <div className="px-6 py-14 md:py-20 border-b border-[--border]">
            <h2 className={`text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-tight transition-all duration-700 ${
              protocol.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              BetWhisper Protocol
            </h2>
            <p className={`text-[14px] text-[--text-secondary] mt-3 max-w-lg transition-all duration-700 delay-100 ${
              protocol.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              A credibly neutral, open protocol for private information markets. Three layers — one autonomous agent.
            </p>
          </div>

          <div className="px-6 py-10">
            <div className="max-w-[500px] mx-auto relative">
              {/* Vertical connector line */}
              <div className={`absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 transition-all duration-1000 ${
                protocol.visible ? 'bg-gradient-to-b from-amber-500/40 via-emerald-500/40 to-[#836EF9]/40 scale-y-100' : 'scale-y-0'
              }`} style={{ transformOrigin: 'top' }} />

              {/* Layer 3: Social (top) */}
              <div className={`relative border border-amber-500/30 p-6 bg-black mb-4 transition-all duration-700 ${
                protocol.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`} style={{ transitionDelay: '200ms' }}>
                <span className="text-[10px] font-mono text-amber-500 tracking-wider block mb-2">LAYER 3 — SOCIAL</span>
                <h3 className="text-[18px] font-bold mb-1">Social Layer</h3>
                <p className="text-[12px] text-[--text-secondary] leading-relaxed">
                  Social Pulse Map &middot; Group Trading &middot; Agent Radar &middot; Anonymous Sentiment
                </p>
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-2 h-2 bg-amber-500 rotate-45 z-10" />
              </div>

              {/* Layer 2: ZK Privacy (middle) */}
              <div className={`relative border border-emerald-500/30 p-6 bg-black mb-4 transition-all duration-700 ${
                protocol.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`} style={{ transitionDelay: '500ms' }}>
                <span className="text-[10px] font-mono text-emerald-500 tracking-wider block mb-2">LAYER 2 — PRIVACY</span>
                <h3 className="text-[18px] font-bold mb-1">ZK Privacy</h3>
                <p className="text-[12px] text-[--text-secondary] leading-relaxed">
                  Zero-knowledge proofs &middot; Unlinkable deposits &middot; Shielded positions &middot; Privacy-by-default
                </p>
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-2 h-2 bg-emerald-500 rotate-45 z-10" />
              </div>

              {/* Layer 1: Monad (base) */}
              <div className={`relative border border-[#836EF9]/30 p-6 bg-black transition-all duration-700 ${
                protocol.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`} style={{ transitionDelay: '800ms' }}>
                <span className="text-[10px] font-mono text-[#836EF9] tracking-wider block mb-2">LAYER 1 — BASE CHAIN</span>
                <h3 className="text-[18px] font-bold mb-1">Monad</h3>
                <p className="text-[12px] text-[--text-secondary] leading-relaxed">
                  10,000 TPS &middot; 1-second finality &middot; EVM-compatible &middot; Settlement layer
                </p>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-8">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                <span className="text-[11px] text-[--text-secondary]">Social</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                <span className="text-[11px] text-[--text-secondary]">Privacy</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#836EF9] rounded-full" />
                <span className="text-[11px] text-[--text-secondary]">Monad</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Social ─── */}
      <section id="social" ref={social.ref} className="border-b border-[--border]">
        <div className="max-w-[1200px] mx-auto">
          <div className="px-6 py-14 md:py-20 border-b border-[--border]">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
              <span className="text-[11px] text-amber-500 font-semibold tracking-wide">SOCIAL LAYER</span>
            </div>
            <h2 className={`text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-tight transition-all duration-700 ${
              social.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              Trade with your crowd. Not against it.
            </h2>
            <p className={`text-[14px] text-[--text-secondary] mt-3 max-w-lg transition-all duration-700 delay-100 ${
              social.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              See real human conviction. Anonymous sentiment from verified participants, not bots. Fair access to social price discovery.
            </p>
          </div>

          <div className="grid md:grid-cols-3">
            {/* Social Pulse Map */}
            <div className={`px-6 py-10 md:border-r border-[--border] border-b md:border-b-0 border-[--border] transition-all duration-700 ${
              social.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-1.5 bg-[#836EF9] rounded-full" />
                <span className="text-[11px] text-[#836EF9] font-semibold tracking-wide">PULSE MAP</span>
              </div>
              <h3 className="text-[20px] font-bold mb-2">Social Pulse Map</h3>
              <p className="text-[13px] text-[--text-secondary] leading-relaxed mb-5">
                Live heatmap of trading activity around you. See which markets are hot in your city, your neighborhood, your venue. Consumer-grade UX, feels like magic.
              </p>
              <div className="space-y-2 text-[12px]">
                <div className="flex justify-between py-1.5 border-b border-[--border]">
                  <span className="text-[--text-secondary]">Data</span>
                  <span className="text-white/60 font-mono">real-time push</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[--border]">
                  <span className="text-[--text-secondary]">Privacy</span>
                  <span className="text-white/60 font-mono">~80m GPS fuzzing</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-[--text-secondary]">Activation</span>
                  <span className="text-white/60 font-mono">PIN + Face ID</span>
                </div>
              </div>
            </div>

            {/* Group Trading */}
            <div className={`px-6 py-10 md:border-r border-[--border] border-b md:border-b-0 border-[--border] transition-all duration-700 delay-100 ${
              social.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                <span className="text-[11px] text-amber-500 font-semibold tracking-wide">GROUPS</span>
              </div>
              <h3 className="text-[20px] font-bold mb-2">Group Trading</h3>
              <p className="text-[13px] text-[--text-secondary] leading-relaxed mb-5">
                Create or join trading groups. Compete on leaderboards. Share conviction without exposing positions. Community-driven social prediction market.
              </p>
              <div className="space-y-2 text-[12px]">
                <div className="flex justify-between py-1.5 border-b border-[--border]">
                  <span className="text-[--text-secondary]">Groups</span>
                  <span className="text-white/60 font-mono">create or join</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[--border]">
                  <span className="text-[--text-secondary]">Leaderboard</span>
                  <span className="text-white/60 font-mono">P&L ranked</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-[--text-secondary]">Identity</span>
                  <span className="text-white/60 font-mono">pseudonymous</span>
                </div>
              </div>
            </div>

            {/* Anonymous Sentiment */}
            <div className={`px-6 py-10 transition-all duration-700 delay-200 ${
              social.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                <span className="text-[11px] text-emerald-500 font-semibold tracking-wide">SENTIMENT</span>
              </div>
              <h3 className="text-[20px] font-bold mb-2">Anonymous Sentiment</h3>
              <p className="text-[13px] text-[--text-secondary] leading-relaxed mb-5">
                See crowd conviction without exposing individual identities. Aggregated sentiment from verified humans — a credibly neutral DeFi primitive for price discovery.
              </p>
              <div className="space-y-2 text-[12px]">
                <div className="flex justify-between py-1.5 border-b border-[--border]">
                  <span className="text-[--text-secondary]">Signal</span>
                  <span className="text-white/60 font-mono">aggregated only</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[--border]">
                  <span className="text-[--text-secondary]">Filtering</span>
                  <span className="text-white/60 font-mono">Agent Radar</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-[--text-secondary]">Privacy</span>
                  <span className="text-white/60 font-mono">ZK-verified</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Glasses ─── */}
      <section id="glasses" ref={glasses.ref} className="border-b border-[--border]">
        <div className="max-w-[1200px] mx-auto">
          <div className="px-6 py-14 md:py-20 border-b border-[--border]">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1.5 h-1.5 bg-white rounded-full" />
              <span className="text-[11px] text-white/60 font-semibold tracking-wide">META RAY-BAN</span>
            </div>
            <h2 className={`text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-tight transition-all duration-700 ${
              glasses.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              Voice-first. Hands-free. Always on.
            </h2>
            <p className={`text-[14px] text-[--text-secondary] mt-3 max-w-lg transition-all duration-700 delay-100 ${
              glasses.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              The first autonomous AI agent for information markets that lives in your glasses. Speak to trade — no phone, no friction. A wearable DeFi experience that feels like magic.
            </p>
          </div>

          <div className="grid md:grid-cols-4">
            {[
              { num: '01', title: 'Voice-First', desc: '"Hey BetWhisper, $5 on Lakers." Natural language intent. Your autonomous agent handles the rest — frictionless.', accent: 'text-[#836EF9]' },
              { num: '02', title: 'Hands-Free', desc: 'Trade from your glasses — no phone needed. Walk, talk, trade. The consumer app for prediction markets.', accent: 'text-amber-400' },
              { num: '03', title: 'Camera', desc: 'Scan QR codes for merchant payments. Point, confirm, done. Self-custodial payments on Monad.', accent: 'text-emerald-400' },
              { num: '04', title: 'Always On', desc: 'Bluetooth + Meta Wearables DAT SDK. Persistent connection to your agent. Real-time settlement, 1-second finality.', accent: 'text-white/60' },
            ].map((item, i) => (
              <div
                key={item.num}
                className={`px-6 py-10 ${i < 3 ? 'md:border-r border-[--border]' : ''} border-b md:border-b-0 border-[--border] transition-all duration-700`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <span className={`text-[12px] font-mono ${item.accent} block mb-5`}>{item.num}</span>
                <h3 className={`text-[20px] font-bold mb-2 transition-all duration-700 ${
                  glasses.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}>{item.title}</h3>
                <p className={`text-[13px] text-[--text-secondary] leading-relaxed transition-all duration-700 ${
                  glasses.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}>{item.desc}</p>
              </div>
            ))}
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
                'Monad', 'Unlink ZK', 'Polymarket CLOB', 'Gemini AI', 'Agent Radar', 'Meta Ray-Ban',
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
            Self-custodial. Permissionless. Provably private.
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
