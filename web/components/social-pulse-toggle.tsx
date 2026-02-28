'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Shield, ShieldCheck, Fingerprint, Lock } from 'lucide-react'

// ─── Types ───

interface SocialPulseToggleProps {
  isActive: boolean
  onActivate: () => void
  onDeactivate: () => void
  walletAddress?: string
  lang?: 'en' | 'es' | 'pt'
  /** If true, skip PIN + biometric gate (for demo mode) */
  demoMode?: boolean
}

type GateStep = 'idle' | 'pin' | 'biometric' | 'activating' | 'active'

const labels = {
  en: {
    off: 'PRIVATE MODE',
    activating: 'VERIFYING...',
    on: 'SOCIAL MAP',
    pinTitle: 'ENTER PIN TO ACTIVATE',
    bioTitle: 'CONFIRM IDENTITY',
    bioPrompt: 'Use Face ID or fingerprint',
    bioFallback: 'Skip biometric',
    pinWrong: 'Wrong PIN',
    locked: 'Too many attempts',
    privacyNote: 'Your exact location is never shared (~80m fuzzing)',
  },
  es: {
    off: 'MODO PRIVADO',
    activating: 'VERIFICANDO...',
    on: 'SOCIAL MAP',
    pinTitle: 'INGRESA PIN PARA ACTIVAR',
    bioTitle: 'CONFIRMA TU IDENTIDAD',
    bioPrompt: 'Usa Face ID o huella',
    bioFallback: 'Saltar biometría',
    pinWrong: 'PIN incorrecto',
    locked: 'Demasiados intentos',
    privacyNote: 'Tu ubicación exacta nunca se comparte (~80m de imprecisión)',
  },
  pt: {
    off: 'MODO PRIVADO',
    activating: 'VERIFICANDO...',
    on: 'SOCIAL MAP',
    pinTitle: 'DIGITE PIN PARA ATIVAR',
    bioTitle: 'CONFIRME SUA IDENTIDADE',
    bioPrompt: 'Use Face ID ou digital',
    bioFallback: 'Pular biometria',
    pinWrong: 'PIN incorreto',
    locked: 'Muitas tentativas',
    privacyNote: 'Sua localização exata nunca é compartilhada (~80m de imprecisão)',
  },
}

// ─── Biometric helpers (WebAuthn) ───

async function isBiometricAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!window.PublicKeyCredential) return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

async function requestBiometric(): Promise<boolean> {
  try {
    // Use WebAuthn to verify user presence with platform authenticator (Face ID / Touch ID)
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'BetWhisper', id: window.location.hostname },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: 'social-pulse-verify',
          displayName: 'Social Pulse Verification',
        },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 60000,
      },
    })
    return !!credential
  } catch {
    return false
  }
}

// ─── Component ───

export function SocialPulseToggle({
  isActive,
  onActivate,
  onDeactivate,
  walletAddress,
  lang = 'en',
  demoMode = false,
}: SocialPulseToggleProps) {
  const t = labels[lang]
  const [gateStep, setGateStep] = useState<GateStep>(isActive ? 'active' : 'idle')
  const [pinDigits, setPinDigits] = useState(['', '', '', ''])
  const [pinError, setPinError] = useState('')
  const [pinLoading, setPinLoading] = useState(false)
  const [hasBiometric, setHasBiometric] = useState(false)
  const [showGate, setShowGate] = useState(false)
  const pinRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ]

  // Check biometric availability on mount
  useEffect(() => {
    isBiometricAvailable().then(setHasBiometric)
  }, [])

  // Sync external active state
  useEffect(() => {
    if (isActive) setGateStep('active')
    else setGateStep('idle')
  }, [isActive])

  // ─── PIN input handlers ───

  const handlePinDigit = useCallback((index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const digit = value.slice(-1)
    const newDigits = [...pinDigits]
    newDigits[index] = digit
    setPinDigits(newDigits)
    setPinError('')

    if (digit && index < 3) {
      pinRefs[index + 1].current?.focus()
    }

    // Auto-submit on 4th digit
    if (index === 3 && digit) {
      const pin = newDigits.join('')
      if (pin.length === 4) verifyPin(pin)
    }
  }, [pinDigits])

  const handlePinKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      pinRefs[index - 1].current?.focus()
      const newDigits = [...pinDigits]
      newDigits[index - 1] = ''
      setPinDigits(newDigits)
    }
  }, [pinDigits])

  // ─── PIN verification ───

  const verifyPin = useCallback(async (pin: string) => {
    if (!walletAddress) return
    setPinLoading(true)
    try {
      const res = await fetch('/api/user/pin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: walletAddress.toLowerCase(), pin }),
      })
      const data = await res.json()
      if (data.verified) {
        // PIN verified → move to biometric step (or activate directly)
        if (hasBiometric && !demoMode) {
          setGateStep('biometric')
        } else {
          activateNow()
        }
      } else if (data.locked) {
        setPinError(t.locked)
      } else {
        setPinError(t.pinWrong)
        setPinDigits(['', '', '', ''])
        pinRefs[0].current?.focus()
      }
    } catch {
      setPinError('Error')
    } finally {
      setPinLoading(false)
    }
  }, [walletAddress, hasBiometric, demoMode, t])

  // ─── Biometric verification ───

  const handleBiometric = useCallback(async () => {
    setGateStep('activating')
    const success = await requestBiometric()
    if (success) {
      activateNow()
    } else {
      // Biometric failed/cancelled — still activate (PIN was already verified)
      activateNow()
    }
  }, [])

  // ─── Activation ───

  const activateNow = useCallback(() => {
    setGateStep('activating')
    setTimeout(() => {
      setGateStep('active')
      setShowGate(false)
      setPinDigits(['', '', '', ''])
      onActivate()
    }, 600) // Brief animation delay
  }, [onActivate])

  // ─── Toggle handler ───

  const handleToggleClick = useCallback(() => {
    if (isActive) {
      // Deactivating is instant (no gate needed)
      setGateStep('idle')
      onDeactivate()
      return
    }

    if (demoMode) {
      // Demo: skip all gates
      activateNow()
      return
    }

    // Check if user has a PIN set up
    if (walletAddress) {
      fetch(`/api/user/pin/check?wallet=${walletAddress.toLowerCase()}`)
        .then(r => r.json())
        .then(data => {
          if (data.hasPin) {
            setGateStep('pin')
            setShowGate(true)
            setPinDigits(['', '', '', ''])
            setPinError('')
            setTimeout(() => pinRefs[0].current?.focus(), 100)
          } else {
            // No PIN configured → activate directly (with biometric if available)
            if (hasBiometric) {
              setGateStep('biometric')
              setShowGate(true)
            } else {
              activateNow()
            }
          }
        })
        .catch(() => activateNow()) // Fail-open on network error
    } else {
      activateNow()
    }
  }, [isActive, demoMode, walletAddress, hasBiometric, onDeactivate, activateNow])

  const dismissGate = useCallback(() => {
    setShowGate(false)
    setGateStep('idle')
    setPinDigits(['', '', '', ''])
    setPinError('')
  }, [])

  // ─── Render ───

  const isOn = gateStep === 'active'

  return (
    <div className="relative">
      {/* Main toggle button */}
      <button
        onClick={handleToggleClick}
        className={`
          group relative flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono tracking-[1.5px] uppercase
          transition-all duration-500 ease-out cursor-pointer select-none
          border
          ${isOn
            ? 'bg-[#836EF9]/15 border-[#836EF9]/40 text-[#836EF9] shadow-[0_0_15px_rgba(131,110,249,0.15)]'
            : 'bg-white/[0.03] border-white/[0.08] text-white/30 hover:border-white/15 hover:text-white/40'
          }
        `}
      >
        {/* Shield icon with slide animation */}
        <div className={`
          relative w-4 h-4 flex items-center justify-center
          transition-all duration-500
          ${isOn ? 'text-[#836EF9]' : 'text-white/20'}
        `}>
          {isOn ? (
            <ShieldCheck className="w-3.5 h-3.5 animate-privacy-shield" />
          ) : (
            <Shield className="w-3.5 h-3.5" />
          )}
          {/* Glow dot when active */}
          {isOn && (
            <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#836EF9] animate-pulse" />
          )}
        </div>

        {/* Label */}
        <span className="relative">
          {isOn ? t.on : gateStep === 'activating' ? t.activating : t.off}
        </span>

        {/* Slide track indicator */}
        <div className={`
          relative w-6 h-3 rounded-full border transition-all duration-500
          ${isOn
            ? 'bg-[#836EF9]/30 border-[#836EF9]/40'
            : 'bg-white/[0.04] border-white/[0.08]'
          }
        `}>
          <div className={`
            absolute top-0.5 w-2 h-2 rounded-full transition-all duration-500
            ${isOn
              ? 'left-3 bg-[#836EF9] shadow-[0_0_6px_rgba(131,110,249,0.6)]'
              : 'left-0.5 bg-white/20'
            }
          `} />
        </div>
      </button>

      {/* Privacy note when active */}
      {isOn && (
        <div className="absolute top-full left-0 mt-1 text-[8px] font-mono text-[#836EF9]/40 tracking-[0.5px] whitespace-nowrap animate-fade-in">
          <Shield className="w-2 h-2 inline mr-1 -mt-px" />
          {t.privacyNote}
        </div>
      )}

      {/* Gate overlay — PIN + Biometric */}
      {showGate && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) dismissGate() }}>
          <div className="w-[280px] bg-[#0a0a0a] border border-white/[0.08] p-6 space-y-5 animate-scale-in">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#836EF9]" />
                <span className="text-[11px] font-mono text-white/70 tracking-[1px]">SOCIAL MAP</span>
              </div>
              <button onClick={dismissGate} className="text-white/20 hover:text-white/40 transition-colors">
                <span className="text-[16px]">&times;</span>
              </button>
            </div>

            {/* PIN Step */}
            {gateStep === 'pin' && (
              <div className="space-y-4">
                <p className="text-[10px] font-mono text-white/40 tracking-[1px]">{t.pinTitle}</p>
                <div className="flex gap-2 justify-center">
                  {pinDigits.map((d, i) => (
                    <input
                      key={i}
                      ref={pinRefs[i]}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      value={d}
                      onChange={e => handlePinDigit(i, e.target.value)}
                      onKeyDown={e => handlePinKeyDown(i, e)}
                      disabled={pinLoading}
                      className="w-10 h-12 bg-white/[0.04] border border-white/[0.10] text-center text-[20px] font-mono font-bold text-white outline-none focus:border-[#836EF9]/50 transition-colors"
                    />
                  ))}
                </div>
                {pinError && (
                  <p className="text-[10px] font-mono text-red-400/80 text-center">{pinError}</p>
                )}
                {pinLoading && (
                  <div className="flex justify-center">
                    <div className="w-4 h-4 border-2 border-[#836EF9]/30 border-t-[#836EF9] rounded-full animate-spin" />
                  </div>
                )}
              </div>
            )}

            {/* Biometric Step */}
            {gateStep === 'biometric' && (
              <div className="space-y-4 text-center">
                <p className="text-[10px] font-mono text-white/40 tracking-[1px]">{t.bioTitle}</p>
                <button
                  onClick={handleBiometric}
                  className="mx-auto w-16 h-16 rounded-full border border-[#836EF9]/30 bg-[#836EF9]/10 flex items-center justify-center hover:bg-[#836EF9]/20 transition-all active:scale-95"
                >
                  <Fingerprint className="w-8 h-8 text-[#836EF9]" />
                </button>
                <p className="text-[9px] font-mono text-white/25">{t.bioPrompt}</p>
                <button
                  onClick={activateNow}
                  className="text-[9px] font-mono text-white/15 hover:text-white/30 underline transition-colors"
                >
                  {t.bioFallback}
                </button>
              </div>
            )}

            {/* Activating */}
            {gateStep === 'activating' && (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-10 h-10 flex items-center justify-center">
                  <ShieldCheck className="w-8 h-8 text-[#836EF9] animate-privacy-shield" />
                </div>
                <p className="text-[10px] font-mono text-[#836EF9]/60 tracking-[1px]">{t.activating}</p>
              </div>
            )}

            {/* Privacy reassurance */}
            <div className="pt-3 border-t border-white/[0.04]">
              <div className="flex items-start gap-2">
                <Lock className="w-3 h-3 text-white/10 mt-0.5 flex-shrink-0" />
                <p className="text-[8px] font-mono text-white/15 leading-relaxed">
                  {t.privacyNote}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
