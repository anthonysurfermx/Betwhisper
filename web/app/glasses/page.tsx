'use client'

import Link from 'next/link'
import { useEffect, useState, useRef } from 'react'
import { ArrowRight } from 'lucide-react'

// ── Scroll-triggered visibility ──
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

// ── Waitlist form ──
function WaitlistForm({ id }: { id?: string }) {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error('Failed')
      setSubmitted(true)
    } catch {
      alert('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex items-center gap-3 py-3">
        <div className="w-2 h-2 bg-emerald-500 rounded-full" />
        <span className="text-[15px] text-emerald-400">You&apos;re on the list. We&apos;ll be in touch.</span>
      </div>
    )
  }

  return (
    <form id={id} onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
      <input
        type="email"
        required
        placeholder="your@email.com"
        value={email}
        onChange={e => setEmail(e.target.value)}
        className="flex-1 px-4 py-3 bg-white/5 border border-white/10 text-white text-[14px] placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors"
      />
      <button
        type="submit"
        disabled={loading}
        className="px-6 py-3 bg-white text-black text-[14px] font-semibold hover:bg-white/90 transition-all active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
      >
        {loading ? 'Joining...' : 'Join Waitlist'}
        {!loading && <ArrowRight className="w-4 h-4" />}
      </button>
    </form>
  )
}

// ── Rotating use cases ──
const USE_CASES = [
  '"Hey, $20 on Lakers tonight."',
  '"Put $5 on Bitcoin above 100k."',
  '"$10 on rain in NYC tomorrow."',
  '"$15 on Trump winning Michigan."',
]

function RotatingPhrase() {
  const [index, setIndex] = useState(0)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setFading(true)
      setTimeout(() => {
        setIndex(prev => (prev + 1) % USE_CASES.length)
        setFading(false)
      }, 400)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <span
      className={`inline-block transition-all duration-400 ${
        fading ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'
      }`}
    >
      {USE_CASES[index]}
    </span>
  )
}

// ── Simulated voice conversation ──
function VoiceDemo() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const run = () => {
      setStep(0)
      const delays = [600, 2200, 4200, 6200]
      return delays.map((d, i) => setTimeout(() => setStep(i + 1), d))
    }
    const initial = run()
    const loop = setInterval(() => { run() }, 10000)
    return () => { initial.forEach(clearTimeout); clearInterval(loop) }
  }, [])

  const lines = [
    { who: 'you', text: 'Hey, $20 on Lakers tonight.' },
    { who: 'bw', text: 'Lakers vs Celtics. Yes is at 62 cents. $20 gets you 32 shares.' },
    { who: 'you', text: 'Do it.' },
    { who: 'bw', text: 'Done. 32.2 shares on Lakers. Good luck.' },
  ]

  return (
    <div className="border border-white/10 bg-black/50 backdrop-blur-sm max-w-lg w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-[12px] text-white/40 tracking-wide font-mono">LIVE</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1 h-1 bg-white/20 rounded-full" />
          <span className="text-[11px] text-white/30">Meta Ray-Ban</span>
        </div>
      </div>

      {/* Conversation */}
      <div className="p-5 space-y-4 min-h-[200px]">
        {lines.map((line, i) => (
          i < step && (
            <div
              key={i}
              className="animate-msg-in"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <span className="text-[10px] font-mono text-white/25 block mb-1">
                {line.who === 'you' ? 'YOU' : 'BETWHISPER'}
              </span>
              <p className={`text-[14px] leading-relaxed ${
                line.who === 'you' ? 'text-white/90' : 'text-white/60'
              }`}>
                {line.text}
              </p>
            </div>
          )
        ))}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-white/10 flex items-center gap-2">
        <div className="flex gap-1">
          {[0,1,2,3,4].map(i => (
            <div key={i} className="w-0.5 bg-white/20 rounded-full" style={{
              height: `${8 + Math.random() * 12}px`,
              animation: step > 0 && step < 4 ? `pulse 0.5s ease-in-out ${i * 0.1}s infinite alternate` : 'none',
            }} />
          ))}
        </div>
        <span className="text-[11px] text-white/20 ml-1">
          {step > 0 && step < 4 ? 'Listening...' : 'Say something'}
        </span>
      </div>
    </div>
  )
}

// ══════════════════════════════════════
// MAIN LANDING PAGE
// ══════════════════════════════════════
export default function GlassesLanding() {
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { setLoaded(true) }, [])

  const how = useInView()
  const scenarios = useInView()
  const video = useInView()
  const faq = useInView()
  const finalCta = useInView()

  return (
    <div className="min-h-screen bg-black text-white">

      {/* ── Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-b border-white/[0.06]">
        <div className="max-w-[1200px] mx-auto px-6 flex justify-between items-center h-14">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-5 h-5 border border-white/20 flex items-center justify-center">
              <span className="text-[8px] font-bold">BW</span>
            </div>
            <span className="text-[13px] font-semibold tracking-tight">BetWhisper</span>
          </Link>
          <div className="flex items-center gap-6">
            <a href="#how" className="text-[13px] text-white/40 hover:text-white transition-colors hidden sm:block">How it works</a>
            <a href="#video" className="text-[13px] text-white/40 hover:text-white transition-colors hidden sm:block">Demo</a>
            <Link
              href="/protocol"
              className="text-[13px] text-white/40 hover:text-white transition-colors hidden sm:block"
            >
              Protocol
            </Link>
            <a
              href="#waitlist"
              className="px-4 py-2 bg-white text-black text-[13px] font-semibold hover:bg-white/90 transition-colors active:scale-[0.97]"
            >
              Join Waitlist
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative pt-14">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="pt-24 md:pt-36 pb-16 md:pb-28">

            {/* Tagline */}
            <div className={`mb-6 transition-all duration-700 delay-200 ${
              loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              <span className="text-[12px] font-mono text-white/30 tracking-wider">PREDICTION MARKETS ON YOUR FACE</span>
            </div>

            {/* Headline */}
            <h1 className={`text-[clamp(2.5rem,7vw,5.5rem)] font-bold leading-[1.0] tracking-tight mb-8 max-w-4xl transition-all duration-700 delay-300 ${
              loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}>
              Trade Polymarket
              <br />
              from your glasses.
            </h1>

            {/* Subheadline */}
            <p className={`text-[16px] md:text-[19px] text-white/50 max-w-lg leading-relaxed mb-4 transition-all duration-700 delay-500 ${
              loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              Just say what you want to bet on. BetWhisper handles the rest.
              <br />
              No phone. No app switching. No screens.
            </p>

            {/* Rotating use case */}
            <div className={`text-[15px] text-white/30 mb-12 h-6 transition-all duration-700 delay-600 ${
              loaded ? 'opacity-100' : 'opacity-0'
            }`}>
              <RotatingPhrase />
            </div>

            {/* Waitlist CTA */}
            <div className={`mb-16 transition-all duration-700 delay-700 ${
              loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              <WaitlistForm id="waitlist" />
              <p className="text-[11px] text-white/20 mt-3">Early access for Meta Ray-Ban owners. No spam.</p>
            </div>

            {/* Voice demo */}
            <div className={`transition-all duration-1000 delay-800 ${
              loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}>
              <VoiceDemo />
            </div>
          </div>
        </div>
        <div className="border-t border-white/[0.06]" />
      </section>

      {/* ── Social proof line ── */}
      <section className="border-b border-white/[0.06]">
        <div className="max-w-[1200px] mx-auto px-6 py-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          {[
            'Polymarket CLOB',
            'Meta Ray-Ban',
            'Gemini AI',
            'Voice-native',
          ].map(item => (
            <span key={item} className="text-[12px] font-mono text-white/20 tracking-wide">{item}</span>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" ref={how.ref} className="border-b border-white/[0.06]">
        <div className="max-w-[1200px] mx-auto">
          <div className="px-6 py-14 md:py-20 border-b border-white/[0.06]">
            <h2 className={`text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-tight transition-all duration-700 ${
              how.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              Three seconds. That&apos;s it.
            </h2>
            <p className={`text-[14px] text-white/40 mt-3 max-w-md transition-all duration-700 delay-100 ${
              how.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              From thought to trade, without reaching for your phone.
            </p>
          </div>

          <div className="grid md:grid-cols-3">
            {[
              {
                num: '01',
                title: 'Say it',
                desc: 'Tell your glasses what you want to bet on. Sports, crypto, politics, weather — anything on Polymarket.',
              },
              {
                num: '02',
                title: 'Confirm it',
                desc: 'BetWhisper finds the market, shows you the price, and asks for your go. One word: "Do it."',
              },
              {
                num: '03',
                title: 'Done',
                desc: 'Trade executed on Polymarket. You get a confirmation in your ear. Keep walking.',
              },
            ].map((s, i) => (
              <div
                key={s.num}
                className={`px-6 py-10 ${i < 2 ? 'md:border-r border-white/[0.06]' : ''} border-b md:border-b-0 border-white/[0.06] transition-all duration-700`}
                style={{ transitionDelay: `${i * 100 + 200}ms` }}
              >
                <span className={`text-[40px] font-bold block mb-4 transition-all duration-700 ${
                  how.visible ? 'opacity-100' : 'opacity-0'
                }`} style={{ transitionDelay: `${i * 100 + 300}ms`, color: 'rgba(255,255,255,0.08)' }}>
                  {s.num}
                </span>
                <h3 className={`text-[20px] font-bold mb-2 transition-all duration-700 ${
                  how.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`} style={{ transitionDelay: `${i * 100 + 200}ms` }}>
                  {s.title}
                </h3>
                <p className={`text-[13px] text-white/40 leading-relaxed transition-all duration-700 ${
                  how.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`} style={{ transitionDelay: `${i * 100 + 300}ms` }}>
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What you can trade ── */}
      <section ref={scenarios.ref} className="border-b border-white/[0.06]">
        <div className="max-w-[1200px] mx-auto">
          <div className="px-6 py-14 md:py-20 border-b border-white/[0.06]">
            <h2 className={`text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-tight transition-all duration-700 ${
              scenarios.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              Bet on anything. From anywhere.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                category: 'SPORTS',
                example: '"$10 on Lakers tonight"',
                detail: 'NBA, NFL, UFC, soccer — live odds from Polymarket.',
              },
              {
                category: 'CRYPTO',
                example: '"$25 on BTC above 100k"',
                detail: 'Bitcoin, Ethereum, Solana price markets. Updated in real-time.',
              },
              {
                category: 'POLITICS',
                example: '"$15 on the next president"',
                detail: 'Elections, policy, geopolitics. The markets Wall Street watches.',
              },
              {
                category: 'CULTURE',
                example: '"$5 on rain tomorrow"',
                detail: 'Weather, entertainment, anything with a prediction market.',
              },
            ].map((s, i) => (
              <div
                key={s.category}
                className={`px-6 py-10 ${i < 3 ? 'lg:border-r border-white/[0.06]' : ''} border-b lg:border-b-0 border-white/[0.06] transition-all duration-700`}
                style={{ transitionDelay: `${i * 80 + 100}ms` }}
              >
                <span className={`text-[11px] font-mono text-white/20 tracking-wider block mb-4 transition-all duration-700 ${
                  scenarios.visible ? 'opacity-100' : 'opacity-0'
                }`}>{s.category}</span>
                <p className={`text-[15px] text-white/70 mb-3 transition-all duration-700 ${
                  scenarios.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`} style={{ transitionDelay: `${i * 80 + 150}ms` }}>
                  {s.example}
                </p>
                <p className={`text-[12px] text-white/30 leading-relaxed transition-all duration-700 ${
                  scenarios.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`} style={{ transitionDelay: `${i * 80 + 250}ms` }}>
                  {s.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Video section ── */}
      <section id="video" ref={video.ref} className="border-b border-white/[0.06]">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-28">
          <div className="text-center mb-10">
            <h2 className={`text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-tight mb-4 transition-all duration-700 ${
              video.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              See it in action.
            </h2>
            <p className={`text-[14px] text-white/40 transition-all duration-700 delay-100 ${
              video.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              30 seconds. One trade. Zero screens.
            </p>
          </div>

          {/* Video placeholder — replace src with actual video */}
          <div className={`max-w-3xl mx-auto aspect-video bg-white/[0.03] border border-white/[0.06] flex items-center justify-center transition-all duration-700 delay-200 ${
            video.visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}>
            {/* Replace this div with actual video embed */}
            <div className="text-center">
              <div className="w-16 h-16 border border-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[16px] border-l-white/40 border-b-[10px] border-b-transparent ml-1" />
              </div>
              <p className="text-[13px] text-white/20">Demo video coming soon</p>
              <p className="text-[11px] text-white/10 mt-1">Rooftop trade on Meta Ray-Ban glasses</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why BetWhisper ── */}
      <section ref={faq.ref} className="border-b border-white/[0.06]">
        <div className="max-w-[1200px] mx-auto">
          <div className="px-6 py-14 md:py-20 border-b border-white/[0.06]">
            <h2 className={`text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-tight transition-all duration-700 ${
              faq.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              Why glasses?
            </h2>
          </div>

          <div className="grid md:grid-cols-2">
            {[
              {
                q: 'Markets move fast. Your phone is slow.',
                a: 'By the time you unlock your phone, open the app, find the market, and confirm — the odds have moved. With glasses, you just speak.',
              },
              {
                q: 'You shouldn\'t have to stop your life to trade.',
                a: 'Walking, working out, cooking, at a bar watching the game. BetWhisper lives on your face. Trade without breaking your flow.',
              },
              {
                q: 'AI that understands context, not buttons.',
                a: 'Say "put $10 on the Lakers" and BetWhisper knows which market, which side, and what price. No menus. No forms.',
              },
              {
                q: 'Real trades on real markets.',
                a: 'Every trade executes directly on Polymarket\'s order book. Real liquidity, real odds, real payouts. Not a simulation.',
              },
            ].map((item, i) => (
              <div
                key={i}
                className={`px-6 py-8 border-b border-white/[0.06] ${i % 2 === 0 ? 'md:border-r border-white/[0.06]' : ''} transition-all duration-700`}
                style={{ transitionDelay: `${i * 80 + 100}ms` }}
              >
                <h3 className={`text-[16px] font-semibold mb-2 transition-all duration-700 ${
                  faq.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`} style={{ transitionDelay: `${i * 80 + 100}ms` }}>
                  {item.q}
                </h3>
                <p className={`text-[13px] text-white/40 leading-relaxed transition-all duration-700 ${
                  faq.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`} style={{ transitionDelay: `${i * 80 + 200}ms` }}>
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section ref={finalCta.ref}>
        <div className="max-w-[1200px] mx-auto px-6 py-24 md:py-32">
          <div className={`max-w-xl transition-all duration-700 ${
            finalCta.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}>
            <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-bold tracking-tight leading-[1.1] mb-4">
              The fastest way to trade
              <br />
              prediction markets.
            </h2>
            <p className="text-[15px] text-white/40 mb-8">
              Get early access. Be the first to trade Polymarket hands-free.
            </p>
            <WaitlistForm />
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06]">
        <div className="max-w-[1200px] mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-5 h-5 border border-white/20 flex items-center justify-center">
                  <span className="text-[8px] font-bold">BW</span>
                </div>
                <span className="text-[13px] font-semibold">BetWhisper</span>
              </div>
              <p className="text-[12px] text-white/20">Trade prediction markets with your voice.</p>
            </div>

            <div className="flex items-center gap-6">
              <Link href="/protocol" className="text-[12px] text-white/30 hover:text-white/60 transition-colors">
                Protocol
              </Link>
              <Link href="/predict" className="text-[12px] text-white/30 hover:text-white/60 transition-colors">
                Web App
              </Link>
              <a
                href="https://github.com/nicholasycKL/Betwhisper"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] text-white/30 hover:text-white/60 transition-colors"
              >
                GitHub
              </a>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-white/[0.06] text-[11px] text-white/15">
            &copy; 2026 BetWhisper. Built on Monad.
          </div>
        </div>
      </footer>
    </div>
  )
}
