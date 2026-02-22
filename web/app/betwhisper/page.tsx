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

// Animated number counter
function Counter({ end, suffix = '' }: { end: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const { ref, visible } = useInView()
  useEffect(() => {
    if (!visible) return
    let frame: number
    const duration = 1200
    const start = performance.now()
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(eased * end))
      if (progress < 1) frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [visible, end])
  return <span ref={ref} className="tabular-nums">{count}{suffix}</span>
}

// Rotating assistant names
const ASSISTANT_NAMES = [
  'Don Fede',
  'Buddy',
  'La Guera',
  'Seu Jorge',
  'El Profe',
  'Mate',
  'Coach',
  'Dona Cida',
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

// Live conversation demo
function ConversationDemo() {
  const [step, setStep] = useState(0)
  const [nameIdx, setNameIdx] = useState(0)

  useEffect(() => {
    const run = () => {
      setStep(0)
      setNameIdx(prev => (prev + 1) % ASSISTANT_NAMES.length)
      const delays = [800, 2400, 4000, 5800, 7600, 9400]
      return delays.map((d, i) => setTimeout(() => setStep(i + 1), d))
    }
    const initial = run()
    const loop = setInterval(() => { run() }, 13000)
    return () => { initial.forEach(clearTimeout); clearInterval(loop) }
  }, [])

  const name = ASSISTANT_NAMES[nameIdx]

  const lines = [
    { who: 'user', text: `${name}, what are the odds on Verstappen winning?` },
    { who: 'agent', text: 'Verstappen at $0.21 YES. Running Agent Radar...' },
    { who: 'agent', text: '78% weighted consensus YES. Smart money loading.', tag: 'SIGNAL' },
    { who: 'agent', text: '2 AI agents detected. Consensus may be inflated.', tag: 'WARNING' },
    { who: 'user', text: `${name}, bet $5 on Yes` },
    { who: 'agent', text: 'Confirmed. 23.8 shares at $0.21. MON intent recorded on Monad.', tag: 'CONFIRMED' },
  ]

  return (
    <div className="border border-[--border-light] bg-black">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[--border-light]">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
          <span className="text-[11px] text-[--text-secondary] tracking-wide">Live session</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-white/40">Assistant: <span className="text-white/70 font-semibold">{name}</span></span>
          <span className="text-[10px] text-[--text-tertiary] font-mono">monad:143</span>
        </div>
      </div>
      <div className="p-5 space-y-3 min-h-[320px]">
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
              <div className={`px-3 py-2 max-w-[320px] text-[13px] leading-relaxed ${
                line.who === 'user'
                  ? 'bg-white text-black'
                  : line.tag === 'WARNING'
                    ? 'border border-amber-500/30 text-amber-400/90'
                    : line.tag === 'CONFIRMED'
                      ? 'border border-emerald-500/30 text-emerald-400/90'
                      : 'border border-[--border-light] text-white/70'
              }`}>
                {line.tag === 'SIGNAL' && (
                  <span className="text-[9px] font-bold tracking-wider text-emerald-500 block mb-1">SIGNAL</span>
                )}
                {line.tag === 'WARNING' && (
                  <span className="text-[9px] font-bold tracking-wider text-amber-500 block mb-1">AGENT SHIELD</span>
                )}
                {line.tag === 'CONFIRMED' && (
                  <span className="text-[9px] font-bold tracking-wider text-emerald-500 block mb-1">CONFIRMED</span>
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
  useEffect(() => setLoaded(true), [])

  const stats = useInView()
  const howItWorks = useInView()
  const shield = useInView()
  const stack = useInView()
  const crossChain = useInView()

  return (
    <div className="min-h-screen bg-black text-white">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-b border-[--border]">
        <div className="max-w-[1200px] mx-auto px-6 flex justify-between items-center h-14">
          <Link href="/betwhisper" className="flex items-center gap-2.5">
            <div className="w-5 h-5 border border-white/20 flex items-center justify-center">
              <span className="text-[8px] font-bold">BW</span>
            </div>
            <span className="text-[13px] font-semibold tracking-tight">
              BetWhisper
            </span>
          </Link>
          <div className="flex items-center gap-6">
            <a
              href="#how-it-works"
              className="text-[13px] text-[--text-secondary] hover:text-white transition-colors duration-200 hidden sm:block"
            >
              How it works
            </a>
            <a
              href="#cross-chain"
              className="text-[13px] text-[--text-secondary] hover:text-white transition-colors duration-200 hidden sm:block"
            >
              Cross-chain
            </a>
            <a
              href="#groups"
              className="text-[13px] text-[--text-secondary] hover:text-white transition-colors duration-200 hidden sm:block"
            >
              Groups
            </a>
            <a
              href="https://github.com/anthonysurfermx/Betwhisper"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] text-[--text-secondary] hover:text-white transition-colors duration-200 hidden sm:block"
            >
              GitHub
            </a>
            <Link
              href="/predict"
              className="px-4 py-2 bg-white text-black text-[13px] font-semibold hover:bg-white/90 transition-colors duration-200 active:scale-[0.97]"
            >
              Launch App
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-14">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="pt-24 md:pt-40 pb-20 md:pb-32">
            {/* Eyebrow */}
            <div className={`mb-6 transition-all duration-700 delay-200 ${
              loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              <span className="text-[13px] text-[--text-secondary]">
                The conversational interface to prediction markets
              </span>
            </div>

            {/* Headline */}
            <h1 className={`text-[clamp(2.5rem,7vw,5.5rem)] font-bold leading-[1.0] tracking-tight mb-8 max-w-4xl transition-all duration-700 delay-400 ${
              loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}>
              BetWhisper is your
              <br />
              <span className="text-white/90 border-b-2 border-white/20 pb-1"><RotatingName /></span>
            </h1>

            {/* Subheadline */}
            <p className={`text-[16px] md:text-[18px] text-[--text-secondary] max-w-xl leading-relaxed mb-10 transition-all duration-700 delay-500 ${
              loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              Name your AI assistant. Ask it about any prediction market. It detects bot manipulation, surfaces smart money signals, and executes your bet cross-chain: pay with MON on Monad, settle on Polymarket. Talk through smart glasses, send a voice note, or type.
            </p>

            {/* CTAs */}
            <div className={`flex flex-col sm:flex-row items-start gap-3 mb-20 transition-all duration-700 delay-600 ${
              loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              <Link
                href="/predict"
                className="px-6 py-3 bg-white text-black text-[14px] font-semibold hover:bg-white/90 transition-all duration-200 active:scale-[0.97] flex items-center gap-2"
              >
                Try the Demo <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#how-it-works"
                className="px-6 py-3 border border-[--border-light] text-[14px] text-[--text-secondary] hover:text-white hover:border-white/30 transition-all duration-200 active:scale-[0.97]"
              >
                How it works
              </a>
            </div>

            {/* Demo window */}
            <div className={`transition-all duration-1000 delay-700 ${
              loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}>
              <ConversationDemo />
            </div>
          </div>
        </div>

        {/* Bottom border */}
        <div className="border-t border-[--border]" />
      </section>

      {/* Stats bar */}
      <section ref={stats.ref} className="border-b border-[--border]">
        <div className="max-w-[1200px] mx-auto">
          <div className={`grid grid-cols-3 transition-all duration-700 ${
            stats.visible ? 'opacity-100' : 'opacity-0'
          }`}>
            {[
              { value: 2, suffix: '', label: 'Chains (Monad + Polygon)' },
              { value: 3, suffix: '', label: 'Channels (text, voice, glasses)' },
              { value: 3, suffix: '', label: 'Languages (EN, ES, PT)' },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className={`px-6 py-8 ${i < 2 ? 'border-r border-[--border]' : ''}`}
              >
                <div className="text-[clamp(2rem,4vw,3rem)] font-bold tracking-tight">
                  <Counter end={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-[13px] text-[--text-secondary] mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" ref={howItWorks.ref} className="border-b border-[--border]">
        <div className="max-w-[1200px] mx-auto">
          {/* Section header */}
          <div className="px-6 py-16 md:py-24 border-b border-[--border]">
            <span className="text-[13px] text-[--text-secondary] block mb-4">How it works</span>
            <h2 className={`text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-tight max-w-2xl transition-all duration-700 ${
              howItWorks.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              Five steps from question to cross-chain bet
            </h2>
          </div>

          {/* Steps grid */}
          <div className="grid md:grid-cols-5">
            {[
              {
                num: '01',
                title: 'Ask',
                desc: 'Search any market. F1, NBA, crypto, politics. Type, voice note, or talk through smart glasses.',
              },
              {
                num: '02',
                title: 'Scan',
                desc: 'Agent Radar scans token holders. Weighted consensus, conviction levels, bot detection.',
              },
              {
                num: '03',
                title: 'Bet',
                desc: 'Pay with MON on Monad. BetWhisper executes on Polymarket CLOB with slippage protection.',
              },
              {
                num: '04',
                title: 'Track',
                desc: 'Live portfolio with P&L. Transaction history with dual explorer links (Monad + Polygon).',
              },
              {
                num: '05',
                title: 'Cash Out',
                desc: 'Sell your position. Proceeds auto-convert back to MON on Monad. Full cross-chain cycle.',
              },
            ].map((step, i) => (
              <div
                key={step.num}
                className={`px-6 py-10 ${i < 4 ? 'border-r border-[--border]' : ''} border-b md:border-b-0 border-[--border] transition-all duration-700`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <span className="text-[12px] font-mono text-[--text-tertiary] block mb-6">{step.num}</span>
                <h3 className="text-[20px] font-bold mb-3">{step.title}</h3>
                <p className="text-[13px] text-[--text-secondary] leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cross-Chain */}
      <section id="cross-chain" ref={crossChain.ref} className="border-b border-[--border]">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid md:grid-cols-2">
            {/* Left: explanation */}
            <div className={`px-6 py-16 md:py-24 md:border-r border-[--border] transition-all duration-700 ${
              crossChain.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-2 h-2 bg-[#836EF9] rounded-full" />
                <span className="text-[13px] text-[#836EF9] font-semibold">Cross-Chain Execution</span>
              </div>
              <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-bold tracking-tight mb-6">
                Pay with MON. Bet on Polymarket. Cash out to MON.
              </h2>
              <p className="text-[14px] text-[--text-secondary] leading-relaxed mb-8">
                BetWhisper bridges the gap between Monad and Polymarket. Your MON payment is recorded on-chain as an intent signal. The bet executes on Polygon via Polymarket CLOB. When you sell, proceeds convert back to MON automatically.
              </p>
              <div className="space-y-3">
                {[
                  'MON intent recorded on Monad (provenance layer)',
                  'Fill-or-kill execution on Polymarket CLOB',
                  'Sell positions and auto-cashout to MON',
                  'Dual tx hashes: Monad + Polygon for every trade',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-1 h-1 bg-white rounded-full" />
                    <span className="text-[14px] text-white/80">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: visual flow */}
            <div className={`px-6 py-16 md:py-24 flex items-center transition-all duration-700 delay-200 ${
              crossChain.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              <div className="w-full space-y-3">
                {[
                  { step: '1', chain: 'MONAD', action: 'MON payment received', color: 'emerald', hash: '0x7a3f...c82d' },
                  { step: '2', chain: 'MONAD', action: 'Intent signal recorded', color: 'emerald', hash: '0x9b2e...f41a' },
                  { step: '3', chain: 'POLYGON', action: 'CLOB order filled (23.8 shares @ $0.21)', color: 'blue', hash: '0x4d1c...a93b' },
                  { step: '4', chain: 'POLYGON', action: 'Position open: 23.8 YES shares', color: 'blue', hash: '' },
                  { step: '5', chain: 'MONAD', action: 'Sell: 45.26 MON cashout sent', color: 'emerald', hash: '0xf82a...d17c' },
                ].map((item) => (
                  <div key={item.step} className={`border ${
                    item.color === 'emerald' ? 'border-emerald-500/20 bg-emerald-500/[0.02]' : 'border-blue-500/20 bg-blue-500/[0.02]'
                  } px-4 py-3 flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-mono font-bold ${
                        item.color === 'emerald' ? 'text-emerald-500' : 'text-blue-400'
                      }`}>{item.chain}</span>
                      <span className="text-[13px] text-white/70">{item.action}</span>
                    </div>
                    {item.hash && (
                      <span className="text-[10px] font-mono text-white/20">{item.hash}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Agent Shield */}
      <section id="agent-shield" ref={shield.ref} className="border-b border-[--border]">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid md:grid-cols-2">
            {/* Left: explanation */}
            <div className={`px-6 py-16 md:py-24 md:border-r border-[--border] transition-all duration-700 ${
              shield.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-2 h-2 bg-amber-500 rounded-full" />
                <span className="text-[13px] text-amber-500 font-semibold">Agent Shield</span>
              </div>
              <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-bold tracking-tight mb-6">
                Protection against AI market manipulation
              </h2>
              <p className="text-[14px] text-[--text-secondary] leading-relaxed mb-8">
                Before every bet, BetWhisper scores each token holder to separate human whales from AI agents and surface the real signal.
              </p>
              <div className="space-y-3">
                {[
                  'Detects bot manipulation before you bet',
                  'Separates human whales from AI agents',
                  'Weighted consensus filters noise from signal',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-1 h-1 bg-white rounded-full" />
                    <span className="text-[14px] text-white/80">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: visual card */}
            <div className={`px-6 py-16 md:py-24 flex items-center transition-all duration-700 delay-200 ${
              shield.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              <div className="w-full border border-amber-500/20 bg-amber-500/[0.02]">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-amber-500/20">
                  <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                  <span className="text-[11px] text-amber-500 font-semibold tracking-wide">AGENT SHIELD ACTIVE</span>
                </div>
                <div className="px-5 py-4 space-y-3 text-[13px]">
                  <div className="flex justify-between py-2 border-b border-amber-500/10">
                    <span className="text-[--text-secondary]">Bot activity</span>
                    <span className="text-amber-400 font-semibold">2 agents</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-amber-500/10">
                    <span className="text-[--text-secondary]">Interval regularity</span>
                    <span className="text-red-400 font-semibold">HIGH</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-amber-500/10">
                    <span className="text-[--text-secondary]">24/7 trading pattern</span>
                    <span className="text-red-400 font-semibold">DETECTED</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-amber-500/10">
                    <span className="text-[--text-secondary]">Human whale consensus</span>
                    <span className="text-emerald-400 font-semibold">78% YES</span>
                  </div>
                  <div className="pt-2">
                    <span className="text-[12px] text-amber-500/60">
                      Proceed with caution. AI agents may inflate YES side.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Channels */}
      <section className="border-b border-[--border]">
        <div className="max-w-[1200px] mx-auto">
          <div className="px-6 py-16 md:py-24 border-b border-[--border]">
            <span className="text-[13px] text-[--text-secondary] block mb-4">Channels</span>
            <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-tight max-w-2xl">
              One assistant, everywhere you are
            </h2>
          </div>
          <div className="grid md:grid-cols-3">
            {[
              {
                icon: '💬',
                title: 'Web + Text',
                desc: 'Full web dashboard with portfolio, P&L tracking, transaction history, and smart market search across sports, crypto, and politics.',
                status: 'Live',
              },
              {
                icon: '🎙️',
                title: 'Voice',
                desc: 'Send a voice note to your assistant. On-device transcription via SFSpeechRecognizer with Bluetooth HFP. Hands-free betting.',
                status: 'Live',
              },
              {
                icon: '👓',
                title: 'Smart Glasses',
                desc: 'Talk to your assistant through Meta Ray-Bans. On-device speech recognition with 2-second silence detection. The most natural way to bet.',
                status: 'Live',
              },
            ].map((channel, i) => (
              <div
                key={channel.title}
                className={`px-6 py-10 ${i < 2 ? 'border-r border-[--border]' : ''} border-b md:border-b-0 border-[--border]`}
              >
                <div className="text-2xl mb-4">{channel.icon}</div>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-[22px] font-bold">{channel.title}</h3>
                  <span className="text-[10px] font-semibold tracking-wider px-2 py-0.5 bg-emerald-500/10 text-emerald-500">
                    LIVE
                  </span>
                </div>
                <p className="text-[14px] text-[--text-secondary] leading-relaxed">{channel.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Group Drafts */}
      <section id="groups" className="border-b border-[--border]">
        <div className="max-w-[1200px] mx-auto">
          <div className="px-6 py-16 md:py-24 border-b border-[--border]">
            <span className="text-[13px] text-[--text-secondary] block mb-4">Groups</span>
            <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-tight max-w-2xl">
              Bet with friends. Unlock AI.
            </h2>
            <p className="text-[14px] text-[--text-secondary] mt-3 max-w-lg">
              Create a group, share a QR code, and compete. Invite one friend to unlock AI-powered market explanations.
            </p>
          </div>

          <div className="grid md:grid-cols-2">
            {/* Left: Mode cards */}
            <div className="px-6 py-10 md:border-r border-[--border] space-y-4">
              <div className="border border-emerald-500/30 bg-emerald-500/[0.02] p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[18px] font-bold">Draft Pool</h3>
                  <span className="text-[10px] font-semibold tracking-wider px-2 py-0.5 bg-emerald-500/10 text-emerald-500">
                    SAME MARKET
                  </span>
                </div>
                <p className="text-[14px] text-[--text-secondary] leading-relaxed">
                  Creator picks the market. Everyone bets the same question. Pure conviction test.
                </p>
              </div>

              <div className="border border-[--border-light] bg-black p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[18px] font-bold">Leaderboard</h3>
                  <span className="text-[10px] font-semibold tracking-wider px-2 py-0.5 bg-white/5 text-[--text-tertiary]">
                    FREE PICK
                  </span>
                </div>
                <p className="text-[14px] text-[--text-secondary] leading-relaxed">
                  Free competition. Each member picks their own markets. Ranked by P&L.
                </p>
              </div>

              {/* QR flow */}
              <div className="border border-[#836EF9]/30 bg-[#836EF9]/[0.02] p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[18px] font-bold">QR Invite</h3>
                  <span className="text-[10px] font-semibold tracking-wider px-2 py-0.5 bg-[#836EF9]/10 text-[#836EF9]">
                    SCAN TO JOIN
                  </span>
                </div>
                <p className="text-[14px] text-[--text-secondary] leading-relaxed">
                  Share a QR code. Friend scans, connects wallet, auto-joins. AI features unlock instantly for the group creator.
                </p>
              </div>
            </div>

            {/* Right: Group preview */}
            <div className="px-6 py-10 flex items-center">
              <div className="w-full border border-[--border-light] bg-black">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-[--border-light]">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  <span className="text-[11px] text-[--text-secondary] tracking-wide">Group preview</span>
                </div>
                <div className="px-5 py-4 space-y-3 text-[13px]">
                  <div className="flex justify-between py-2 border-b border-[--border]">
                    <span className="text-[--text-secondary]">Group</span>
                    <span className="text-white font-semibold">F1 Friends</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-[--border]">
                    <span className="text-[--text-secondary]">Mode</span>
                    <span className="text-emerald-400 font-semibold">Leaderboard</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-[--border]">
                    <span className="text-[--text-secondary]">Members</span>
                    <span className="text-white font-semibold">3/5</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-[--border]">
                    <span className="text-[--text-secondary]">AI Gate</span>
                    <span className="text-emerald-400 font-semibold">UNLOCKED</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-[--text-secondary]">Invite</span>
                    <span className="text-white font-mono font-semibold">BW-F1-2026</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section ref={stack.ref} className="border-b border-[--border]">
        <div className="max-w-[1200px] mx-auto">
          <div className="px-6 py-16 md:py-20">
            <span className="text-[13px] text-[--text-secondary] block mb-10">Built with</span>
            <div className={`grid grid-cols-2 md:grid-cols-3 gap-px bg-[--border] transition-all duration-700 ${
              stack.visible ? 'opacity-100' : 'opacity-0'
            }`}>
              {[
                { name: 'Monad', desc: 'Intent layer + data provenance', url: 'https://monad.xyz' },
                { name: 'Polymarket CLOB', desc: 'Order execution on Polygon', url: 'https://polymarket.com' },
                { name: 'Gemini Live', desc: 'Multimodal AI analysis', url: 'https://deepmind.google/technologies/gemini/' },
                { name: 'SFSpeechRecognizer', desc: 'On-device voice', url: 'https://developer.apple.com/documentation/speech' },
                { name: 'Agent Radar', desc: 'Whale detection + bot scoring', url: '#agent-shield' },
                { name: 'Meta Ray-Ban', desc: 'Smart glasses interface', url: 'https://www.ray-ban.com/usa/ray-ban-meta-smart-glasses' },
              ].map(tech => (
                <a
                  key={tech.name}
                  href={tech.url}
                  target={tech.url.startsWith('http') ? '_blank' : undefined}
                  rel={tech.url.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="bg-black px-6 py-6 hover:bg-[#0a0a0a] transition-colors duration-200 group"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[15px] font-semibold">{tech.name}</span>
                    <ArrowUpRight className="w-3 h-3 text-[--text-tertiary] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <span className="text-[12px] text-[--text-secondary]">{tech.desc}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="grid-dashed">
        <div className="max-w-[1200px] mx-auto px-6 py-24 md:py-40 text-center">
          <h2 className="text-[clamp(2rem,5vw,4rem)] font-bold tracking-tight mb-6">
            Name yours.
            <br />
            <span className="text-[--text-secondary]">Start whispering.</span>
          </h2>
          <p className="text-[16px] text-[--text-secondary] max-w-md mx-auto mb-10">
            Pay with MON. Bet on Polymarket. Cash out cross-chain.
            Let your AI find the edge.
          </p>
          <Link
            href="/predict"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-black text-[14px] font-semibold hover:bg-white/90 transition-all duration-200 active:scale-[0.97]"
          >
            Launch BetWhisper <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[--border]">
        <div className="max-w-[1200px] mx-auto px-6 py-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-4 h-4 border border-white/20 flex items-center justify-center">
              <span className="text-[7px] font-bold">BW</span>
            </div>
            <span className="text-[13px] font-semibold tracking-tight text-white/40">
              BetWhisper
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#groups" className="text-[12px] text-[--text-tertiary] hover:text-white transition-colors">
              Groups
            </a>
            <a
              href="https://github.com/anthonysurfermx/Betwhisper"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] text-[--text-tertiary] hover:text-white transition-colors"
            >
              GitHub
            </a>
            <span className="text-[12px] text-[--text-tertiary]">
              Monad Blitz CDMX 2026
            </span>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              <span className="text-[11px] text-emerald-500/80">Systems operational</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
