import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

// ─── Real Polymarket trades → projected onto MSG heatmap ──────────
//
// Strategy:
// 1. Fetch REAL recent trades from Polymarket data API (Knicks NBA Finals market)
// 2. Project each trade onto the MSG area (40.7505, -73.9934) with spatial jitter
// 3. Larger trades = closer to center (whales sit courtside)
// 4. Also seed hackathon venue area with ZK trades
//
// This gives us REAL Polymarket volume numbers with a spatial narrative.

const KNICKS_CONDITION_ID = '0x713641f745d71f6ec61f906237ffca3c8583f251e49384429a63ceb0ccdb2d37'
const KNICKS_SLUG = 'will-the-new-york-knicks-win-the-2026-nba-finals'

// MSG center coordinates
const MSG_CENTER = { lat: 40.7505, lng: -73.9934 }

// Hackathon venue: 50 W 23rd St
const VENUE_CENTER = { lat: 40.7420, lng: -73.9918 }

// Spatial zones: trades are projected based on size
const ZONES = {
  // Whales ($500+) = tight cluster around MSG center (courtside)
  whale: { spread: 0.0008 },
  // Big ($100-500) = inner ring
  big: { spread: 0.0015 },
  // Medium ($10-100) = mid ring
  medium: { spread: 0.003 },
  // Small (<$10) = outer ring (bars, homes, transit)
  small: { spread: 0.006 },
}

interface PolymarketTrade {
  side: string
  size: number
  price: number
  timestamp: number
  outcome: string
  outcomeIndex: number
  transactionHash: string
  proxyWallet: string
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297
  return x - Math.floor(x)
}

function getAmountBucket(usdcValue: number): string {
  if (usdcValue < 10) return '1-10'
  if (usdcValue < 50) return '10-50'
  if (usdcValue < 100) return '50-100'
  return '100+'
}

function getSizeZone(usdcValue: number): keyof typeof ZONES {
  if (usdcValue >= 500) return 'whale'
  if (usdcValue >= 100) return 'big'
  if (usdcValue >= 10) return 'medium'
  return 'small'
}

export async function POST() {
  const conditionId = KNICKS_SLUG
  const now = Date.now()

  // Ensure table has execution_mode column
  await sql`ALTER TABLE pulse_trades ADD COLUMN IF NOT EXISTS execution_mode TEXT NOT NULL DEFAULT 'direct'`.catch(() => {})

  // Clear old seed data
  await sql`DELETE FROM pulse_trades WHERE condition_id = ${conditionId}`

  let totalInserted = 0
  let totalZk = 0
  let realTradeCount = 0
  let syntheticCount = 0

  // ─── PHASE 1: Fetch REAL Polymarket trades ──────────────────
  let realTrades: PolymarketTrade[] = []
  try {
    const res = await fetch(
      `https://data-api.polymarket.com/trades?market=${KNICKS_CONDITION_ID}&limit=200&takerOnly=false`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (res.ok) {
      realTrades = await res.json()
    }
  } catch (e) {
    console.error('[Pulse Seed] Failed to fetch Polymarket trades:', e instanceof Error ? e.message : e)
  }

  // ─── PHASE 2: Project real trades onto MSG ──────────────────
  for (let i = 0; i < realTrades.length; i++) {
    const trade = realTrades[i]
    const usdcValue = trade.size * trade.price
    if (usdcValue < 0.5) continue // skip dust

    const seed = i * 137 + 42
    const zone = ZONES[getSizeZone(usdcValue)]

    // Project onto MSG area — whales closer to center
    const lat = MSG_CENTER.lat + (seededRandom(seed) - 0.5) * zone.spread
    const lng = MSG_CENTER.lng + (seededRandom(seed + 1) - 0.5) * zone.spread

    const side = trade.outcome === 'Yes' ? 'Yes' : 'No'
    const bucket = getAmountBucket(usdcValue)

    // Timestamp: use real trade timestamp
    const ts = trade.timestamp * 1000 // Polymarket uses seconds
    const tsBucket = Math.floor(ts / 60000) * 60000

    // Wallet: truncated proxy wallet
    const walletHash = trade.proxyWallet?.slice(0, 12) || `0x${seededRandom(seed + 2).toString(16).slice(2, 12)}`

    await sql`
      INSERT INTO pulse_trades (condition_id, side, amount_bucket, lat, lng, timestamp_bucket, wallet_hash, execution_mode)
      VALUES (${conditionId}, ${side}, ${bucket}, ${lat}, ${lng}, ${tsBucket}, ${walletHash}, ${'direct'})
    `
    totalInserted++
    realTradeCount++
  }

  // ─── PHASE 3: Synthetic trades to fill if API returned few ──
  // Also add hackathon venue ZK trades (always)
  const twoHoursMs = 2 * 60 * 60 * 1000

  // If we got < 50 real trades, add synthetic MSG trades
  const syntheticMsgCount = Math.max(0, 80 - realTradeCount)
  for (let i = 0; i < syntheticMsgCount; i++) {
    const seed = (realTradeCount + i) * 251 + 73
    const spread = seededRandom(seed + 10) < 0.3 ? 0.001 : 0.003

    const lat = MSG_CENTER.lat + (seededRandom(seed) - 0.5) * spread
    const lng = MSG_CENTER.lng + (seededRandom(seed + 1) - 0.5) * spread
    const side = seededRandom(seed + 2) < 0.55 ? 'Yes' : 'No'

    const bucketRoll = seededRandom(seed + 3)
    const bucket = bucketRoll < 0.25 ? '1-10' : bucketRoll < 0.55 ? '10-50' : bucketRoll < 0.8 ? '50-100' : '100+'

    const ageMs = Math.floor(seededRandom(seed + 5) * seededRandom(seed + 5) * twoHoursMs)
    const tsBucket = Math.floor((now - ageMs) / 60000) * 60000
    const walletHash = `0x${seededRandom(seed + 6).toString(16).slice(2, 12)}`

    await sql`
      INSERT INTO pulse_trades (condition_id, side, amount_bucket, lat, lng, timestamp_bucket, wallet_hash, execution_mode)
      VALUES (${conditionId}, ${side}, ${bucket}, ${lat}, ${lng}, ${tsBucket}, ${walletHash}, ${'direct'})
    `
    totalInserted++
    syntheticCount++
  }

  // ─── PHASE 4: Hackathon venue — ZK whales (always add) ──────
  const venueConfigs = [
    { lat: VENUE_CENTER.lat, lng: VENUE_CENTER.lng, count: 18, zkPct: 0.80, label: 'Venue Main' },
    { lat: 40.7423, lng: -73.9912, count: 7, zkPct: 0.75, label: 'Venue NE' },
    { lat: 40.7417, lng: -73.9924, count: 5, zkPct: 0.85, label: 'Venue SW' },
  ]

  for (const cfg of venueConfigs) {
    for (let i = 0; i < cfg.count; i++) {
      const seed = (totalInserted + i) * 317 + 99
      const lat = cfg.lat + (seededRandom(seed) - 0.5) * 0.003
      const lng = cfg.lng + (seededRandom(seed + 1) - 0.5) * 0.003
      const side = seededRandom(seed + 2) < 0.48 ? 'Yes' : 'No'

      const bucketRoll = seededRandom(seed + 3)
      const bucket = bucketRoll < 0.2 ? '1-10' : bucketRoll < 0.5 ? '10-50' : bucketRoll < 0.8 ? '50-100' : '100+'

      const isZk = seededRandom(seed + 4) < cfg.zkPct
      const executionMode = isZk ? 'unlink' : 'direct'
      if (isZk) totalZk++

      const ageMs = Math.floor(seededRandom(seed + 5) * seededRandom(seed + 5) * twoHoursMs)
      const tsBucket = Math.floor((now - ageMs) / 60000) * 60000
      const walletHash = `0x${seededRandom(seed + 6).toString(16).slice(2, 12)}`

      await sql`
        INSERT INTO pulse_trades (condition_id, side, amount_bucket, lat, lng, timestamp_bucket, wallet_hash, execution_mode)
        VALUES (${conditionId}, ${side}, ${bucket}, ${lat}, ${lng}, ${tsBucket}, ${walletHash}, ${executionMode})
      `
      totalInserted++
    }
  }

  // ─── PHASE 5: Scatter — surrounding neighborhoods ───────────
  const scatterPoints = [
    { lat: 40.7410, lng: -73.9897, label: 'Flatiron', count: 8 },
    { lat: 40.7440, lng: -73.9937, label: 'Chelsea', count: 6 },
    { lat: 40.7359, lng: -73.9911, label: 'Union Sq', count: 6 },
    { lat: 40.7580, lng: -73.9855, label: 'Times Sq', count: 8 },
    { lat: 40.7484, lng: -73.9857, label: 'Penn Station', count: 5 },
  ]

  for (const sp of scatterPoints) {
    for (let i = 0; i < sp.count; i++) {
      const seed = (totalInserted + i) * 431 + 17
      const lat = sp.lat + (seededRandom(seed) - 0.5) * 0.005
      const lng = sp.lng + (seededRandom(seed + 1) - 0.5) * 0.005
      const side = seededRandom(seed + 2) < 0.52 ? 'Yes' : 'No'
      const bucket = seededRandom(seed + 3) < 0.4 ? '1-10' : seededRandom(seed + 3) < 0.7 ? '10-50' : '50-100'
      const isZk = seededRandom(seed + 4) < 0.15
      if (isZk) totalZk++

      const ageMs = Math.floor(seededRandom(seed + 5) * seededRandom(seed + 5) * twoHoursMs)
      const tsBucket = Math.floor((now - ageMs) / 60000) * 60000
      const walletHash = `0x${seededRandom(seed + 6).toString(16).slice(2, 12)}`

      await sql`
        INSERT INTO pulse_trades (condition_id, side, amount_bucket, lat, lng, timestamp_bucket, wallet_hash, execution_mode)
        VALUES (${conditionId}, ${side}, ${bucket}, ${lat}, ${lng}, ${tsBucket}, ${walletHash}, ${isZk ? 'unlink' : 'direct'})
      `
      totalInserted++
    }
  }

  return NextResponse.json({
    success: true,
    totalInserted,
    realPolymarketTrades: realTradeCount,
    syntheticTrades: syntheticCount + 30 + 33, // venue + scatter
    totalZk,
    zkPct: totalInserted > 0 ? Math.round((totalZk / totalInserted) * 100) : 0,
    conditionId,
    market: 'Knicks NBA Finals 2026',
    polymarketConditionId: KNICKS_CONDITION_ID,
  })
}
