'use client'

import { useCallback, useRef } from 'react'

/**
 * Minimalist sound effects using Web Audio API — no external files needed.
 * Each sound is a short synthesized tone, designed to be subtle and non-invasive.
 *
 * Sound palette:
 * - tick:      Soft click for UI interactions (button press, selection)
 * - send:      Whoosh for sending messages
 * - receive:   Gentle chime for incoming messages/data
 * - step:      Short blip for timeline step progression
 * - success:   Two-tone ascending chime for confirmed transactions
 * - error:     Low buzz for errors
 * - privacy:   Ethereal sweep for ZK/privacy events
 * - whale:     Deep bass hit for whale alerts
 * - deposit:   Coin-drop sound for deposits
 */

type SoundName =
  | 'tick'
  | 'send'
  | 'receive'
  | 'step'
  | 'success'
  | 'error'
  | 'privacy'
  | 'whale'
  | 'deposit'

export function useSounds(enabled: boolean = true) {
  const ctxRef = useRef<AudioContext | null>(null)

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    }
    // Resume if suspended (browser autoplay policy)
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume()
    }
    return ctxRef.current
  }, [])

  const play = useCallback((name: SoundName) => {
    if (!enabled) return
    try {
      const ctx = getCtx()
      const now = ctx.currentTime

      switch (name) {
        case 'tick': {
          // Short click — 3ms sine burst
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = 800
          gain.gain.setValueAtTime(0.08, now)
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03)
          osc.connect(gain).connect(ctx.destination)
          osc.start(now)
          osc.stop(now + 0.03)
          break
        }

        case 'send': {
          // Quick ascending sweep — 80ms
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.setValueAtTime(400, now)
          osc.frequency.exponentialRampToValueAtTime(900, now + 0.08)
          gain.gain.setValueAtTime(0.06, now)
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
          osc.connect(gain).connect(ctx.destination)
          osc.start(now)
          osc.stop(now + 0.1)
          break
        }

        case 'receive': {
          // Gentle two-note chime — 200ms
          const osc1 = ctx.createOscillator()
          const osc2 = ctx.createOscillator()
          const gain = ctx.createGain()
          osc1.type = 'sine'
          osc2.type = 'sine'
          osc1.frequency.value = 587 // D5
          osc2.frequency.value = 784 // G5
          gain.gain.setValueAtTime(0.05, now)
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
          osc1.connect(gain).connect(ctx.destination)
          osc2.connect(gain)
          osc1.start(now)
          osc2.start(now + 0.06)
          osc1.stop(now + 0.15)
          osc2.stop(now + 0.2)
          break
        }

        case 'step': {
          // Short blip — timeline step
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'triangle'
          osc.frequency.value = 660
          gain.gain.setValueAtTime(0.06, now)
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)
          osc.connect(gain).connect(ctx.destination)
          osc.start(now)
          osc.stop(now + 0.06)
          break
        }

        case 'success': {
          // Ascending chord — C5 E5 G5 arpeggiated, 300ms
          const notes = [523, 659, 784] // C5, E5, G5
          notes.forEach((freq, i) => {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = 'sine'
            osc.frequency.value = freq
            const t = now + i * 0.06
            gain.gain.setValueAtTime(0, t)
            gain.gain.linearRampToValueAtTime(0.07, t + 0.02)
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
            osc.connect(gain).connect(ctx.destination)
            osc.start(t)
            osc.stop(t + 0.25)
          })
          break
        }

        case 'error': {
          // Low buzz — 100ms
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sawtooth'
          osc.frequency.value = 150
          gain.gain.setValueAtTime(0.04, now)
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
          osc.connect(gain).connect(ctx.destination)
          osc.start(now)
          osc.stop(now + 0.12)
          break
        }

        case 'privacy': {
          // Ethereal descending sweep — ZK proof sound, 400ms
          const osc = ctx.createOscillator()
          const osc2 = ctx.createOscillator()
          const gain = ctx.createGain()
          const filter = ctx.createBiquadFilter()
          filter.type = 'lowpass'
          filter.frequency.value = 2000
          osc.type = 'sine'
          osc2.type = 'sine'
          osc.frequency.setValueAtTime(1200, now)
          osc.frequency.exponentialRampToValueAtTime(400, now + 0.35)
          osc2.frequency.setValueAtTime(1205, now) // slight detune for ethereal feel
          osc2.frequency.exponentialRampToValueAtTime(402, now + 0.35)
          gain.gain.setValueAtTime(0.04, now)
          gain.gain.setValueAtTime(0.04, now + 0.15)
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
          osc.connect(filter).connect(gain).connect(ctx.destination)
          osc2.connect(filter)
          osc.start(now)
          osc2.start(now)
          osc.stop(now + 0.4)
          osc2.stop(now + 0.4)
          break
        }

        case 'whale': {
          // Deep bass hit + subtle overtone — 250ms
          const osc = ctx.createOscillator()
          const osc2 = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = 80
          osc2.type = 'sine'
          osc2.frequency.value = 160
          gain.gain.setValueAtTime(0.1, now)
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
          osc.connect(gain).connect(ctx.destination)
          osc2.connect(gain)
          osc.start(now)
          osc2.start(now)
          osc.stop(now + 0.25)
          osc2.stop(now + 0.25)
          break
        }

        case 'deposit': {
          // Coin drop — quick descending tone + bounce, 200ms
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.setValueAtTime(1200, now)
          osc.frequency.exponentialRampToValueAtTime(300, now + 0.08)
          osc.frequency.setValueAtTime(600, now + 0.1)
          osc.frequency.exponentialRampToValueAtTime(300, now + 0.18)
          gain.gain.setValueAtTime(0.07, now)
          gain.gain.setValueAtTime(0.04, now + 0.1)
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
          osc.connect(gain).connect(ctx.destination)
          osc.start(now)
          osc.stop(now + 0.2)
          break
        }
      }
    } catch {
      // Silently fail if AudioContext isn't available
    }
  }, [enabled, getCtx])

  return { play }
}
