'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { priceStream, type PriceUpdate } from '@/lib/polymarket-ws'

/**
 * Hook: subscribe to live price for a single token pair (Yes/No)
 * Returns current mid price, best bid/ask, and last trade info.
 * Updates in real-time via WebSocket.
 */
export function useLivePrice(tokenId: string | undefined) {
  const [price, setPrice] = useState<PriceUpdate | null>(
    tokenId ? priceStream.getPrice(tokenId) ?? null : null
  )

  useEffect(() => {
    if (!tokenId) return
    const cached = priceStream.getPrice(tokenId)
    if (cached) setPrice(cached)

    const unsub = priceStream.subscribe([tokenId], (update) => {
      setPrice(update)
    })
    return unsub
  }, [tokenId])

  return price
}

/**
 * Hook: subscribe to live prices for multiple tokens at once.
 * Returns a Map of tokenId → PriceUpdate, updated in real-time.
 */
export function useLivePrices(tokenIds: string[]) {
  const [prices, setPrices] = useState<Map<string, PriceUpdate>>(() => {
    const initial = new Map<string, PriceUpdate>()
    for (const id of tokenIds) {
      const cached = priceStream.getPrice(id)
      if (cached) initial.set(id, cached)
    }
    return initial
  })

  const tokenIdsRef = useRef(tokenIds)
  tokenIdsRef.current = tokenIds

  const handleUpdate = useCallback((update: PriceUpdate) => {
    if (!tokenIdsRef.current.includes(update.tokenId)) return
    setPrices(prev => {
      const next = new Map(prev)
      next.set(update.tokenId, update)
      return next
    })
  }, [])

  useEffect(() => {
    if (tokenIds.length === 0) return
    const unsub = priceStream.subscribe(tokenIds, handleUpdate)
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenIds.join(','), handleUpdate])

  return prices
}

/**
 * Hook: track price delta (flash green/red on change)
 * Returns { price, delta, direction } where direction flashes briefly.
 */
export function usePriceFlash(tokenId: string | undefined) {
  const [current, setCurrent] = useState<{ midPrice: number; direction: 'up' | 'down' | null }>({
    midPrice: tokenId ? priceStream.getPrice(tokenId)?.midPrice ?? 0 : 0,
    direction: null,
  })
  const prevPrice = useRef(current.midPrice)
  const flashTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (!tokenId) return

    const unsub = priceStream.subscribe([tokenId], (update) => {
      const prev = prevPrice.current
      const dir = update.midPrice > prev ? 'up' : update.midPrice < prev ? 'down' : null
      prevPrice.current = update.midPrice

      setCurrent({ midPrice: update.midPrice, direction: dir })

      // Clear flash after 800ms
      if (dir) {
        if (flashTimer.current) clearTimeout(flashTimer.current)
        flashTimer.current = setTimeout(() => {
          setCurrent(c => ({ ...c, direction: null }))
        }, 800)
      }
    })

    return () => {
      unsub()
      if (flashTimer.current) clearTimeout(flashTimer.current)
    }
  }, [tokenId])

  return current
}
