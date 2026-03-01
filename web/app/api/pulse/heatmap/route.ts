import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

// ─── Types ─────────────────────────────────────────────

interface HeatmapPoint {
  lng: number
  lat: number
  intensity: number
  side: string
  timestamp: number
  executionMode: 'direct' | 'unlink'
  marketName?: string
  walletHash?: string
}

interface PulseStats {
  marketName: string
  conditionId: string
  teamA: { name: string; pct: number; price: number }
  teamB: { name: string; pct: number; price: number }
  activeTraders: number
  totalVolume: number
  spikeIndicator: number
  globalComparison: string
  zkPrivateCount: number
  zkPrivatePct: number
}

// ─── Clusters near hackathon venue: 50 W 23rd St, Flatiron ─────────────

const MANHATTAN_CLUSTERS = [
  // 🔥 MSG Hotspot — Madison Square Garden (dense, high intensity)
  { lat: 40.7505, lng: -73.9934, label: 'MSG Center' },
  { lat: 40.7508, lng: -73.9929, label: 'MSG NE' },
  { lat: 40.7502, lng: -73.9939, label: 'MSG SW' },
  { lat: 40.7506, lng: -73.9925, label: 'MSG E' },
  { lat: 40.7504, lng: -73.9942, label: 'MSG W' },
  { lat: 40.7510, lng: -73.9934, label: 'MSG N' },
  { lat: 40.7500, lng: -73.9934, label: 'MSG S' },
  { lat: 40.7507, lng: -73.9920, label: 'MSG Gate' },
  // Hackathon venue: 50 W 23rd St
  { lat: 40.7420, lng: -73.9918, label: 'Venue' },
  { lat: 40.7423, lng: -73.9912, label: 'Venue NE' },
  // Nearby neighborhoods (lighter activity)
  { lat: 40.7410, lng: -73.9897, label: 'Flatiron' },
  { lat: 40.7440, lng: -73.9937, label: 'Chelsea' },
  { lat: 40.7359, lng: -73.9911, label: 'Union Square' },
  { lat: 40.7450, lng: -73.9880, label: 'Koreatown' },
  { lat: 40.7484, lng: -73.9857, label: 'Penn Station' },
]

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297
  return x - Math.floor(x)
}

const startTime = Date.now()

// ─── Mock Generators (fallback when DB is empty) ────────

function generateMockPoints(): HeatmapPoint[] {
  const elapsed = (Date.now() - startTime) / 1000
  const pointCount = Math.min(Math.floor(elapsed / 2.5) + 5, 120)

  const points: HeatmapPoint[] = []
  for (let i = 0; i < pointCount; i++) {
    const cluster = MANHATTAN_CLUSTERS[i % MANHATTAN_CLUSTERS.length]
    const seed = i * 137 + Math.floor(elapsed / 10)
    const isMSG = i % MANHATTAN_CLUSTERS.length < 8 // First 8 = MSG hotspot

    // MSG: tight cluster (0.001) + high intensity | Others: wider spread + variable
    const jitterLat = (seededRandom(seed) - 0.5) * (isMSG ? 0.0015 : 0.005)
    const jitterLng = (seededRandom(seed + 1) - 0.5) * (isMSG ? 0.0015 : 0.005)

    points.push({
      lat: cluster.lat + jitterLat,
      lng: cluster.lng + jitterLng,
      intensity: isMSG ? 0.85 + seededRandom(seed + 2) * 0.15 : 0.3 + seededRandom(seed + 2) * 0.5,
      side: seededRandom(seed + 3) > 0.43 ? 'Lakers' : 'Suns',
      timestamp: Date.now() - Math.floor(seededRandom(seed + 4) * 90000),
    })
  }
  return points
}

function generateMockStats(): PulseStats {
  const elapsed = (Date.now() - startTime) / 1000
  const baseTraders = Math.min(Math.floor(elapsed / 4) + 5, 340)
  const baseVolume = Math.min(Math.floor(elapsed * 15) + 500, 47000)
  const jitter = Math.floor(seededRandom(Math.floor(elapsed / 5)) * 8)

  return {
    marketName: 'NBA: LAKERS vs SUNS',
    conditionId: 'demo-lakers-suns-2026',
    teamA: { name: 'LAKERS', pct: 57, price: 0.57 },
    teamB: { name: 'SUNS', pct: 43, price: 0.43 },
    activeTraders: baseTraders + jitter,
    totalVolume: baseVolume + Math.floor(seededRandom(Math.floor(elapsed / 3)) * 300),
    spikeIndicator: elapsed > 30 ? 1.0 + seededRandom(Math.floor(elapsed / 8)) * 2.5 : 0.8,
    globalComparison: `MSG is on fire — 57% Lakers. Global market sits at 48%. Crowd is ${Math.round(57 / 48 * 100 - 100)}% more bullish than the world.`,
  }
}

// ─── Ensure table exists ─────────────────────────────────

let tableReady = false
async function ensurePulseTable() {
  if (tableReady) return
  await sql`
    CREATE TABLE IF NOT EXISTS pulse_trades (
      id SERIAL PRIMARY KEY,
      condition_id TEXT NOT NULL,
      side TEXT NOT NULL,
      amount_bucket TEXT NOT NULL,
      lat NUMERIC NOT NULL,
      lng NUMERIC NOT NULL,
      timestamp_bucket BIGINT NOT NULL,
      wallet_hash TEXT NOT NULL DEFAULT 'anon',
      execution_mode TEXT NOT NULL DEFAULT 'direct',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_pulse_condition_ts ON pulse_trades(condition_id, timestamp_bucket)`.catch(() => {})
  // Add columns if missing (existing tables)
  await sql`ALTER TABLE pulse_trades ADD COLUMN IF NOT EXISTS execution_mode TEXT NOT NULL DEFAULT 'direct'`.catch(() => {})
  await sql`ALTER TABLE pulse_trades ADD COLUMN IF NOT EXISTS market_name TEXT NOT NULL DEFAULT ''`.catch(() => {})
  tableReady = true
}

// ─── DB → Real Data ─────────────────────────────────────

const AMOUNT_MIDPOINT: Record<string, number> = {
  '1-10': 5,
  '10-50': 30,
  '50-100': 75,
  '100+': 150,
}

async function fetchRealData(conditionId?: string): Promise<{
  points: HeatmapPoint[]
  stats: PulseStats
  source: 'db' | 'mock'
} | null> {
  try {
    // Trades in the last 2 hours
    const cutoff = Date.now() - 2 * 60 * 60 * 1000

    const rows = conditionId
      ? await sql`
          SELECT lat, lng, side, amount_bucket, wallet_hash, timestamp_bucket, execution_mode, market_name, created_at
          FROM pulse_trades
          WHERE condition_id = ${conditionId} AND timestamp_bucket > ${cutoff}
          ORDER BY created_at DESC
          LIMIT 500
        `
      : await sql`
          SELECT lat, lng, side, amount_bucket, wallet_hash, timestamp_bucket, execution_mode, market_name, created_at
          FROM pulse_trades
          WHERE timestamp_bucket > ${cutoff}
          ORDER BY created_at DESC
          LIMIT 500
        `

    if (!rows || rows.length === 0) return null

    // Build points
    const points: HeatmapPoint[] = rows.map((r) => {
      const bucket = String(r.amount_bucket || '1-10')
      const midpoint = AMOUNT_MIDPOINT[bucket] || 5
      const intensity = Math.min(0.3 + (midpoint / 200), 1.0)
      return {
        lat: Number(r.lat),
        lng: Number(r.lng),
        intensity,
        side: String(r.side || 'Yes'),
        timestamp: Number(r.timestamp_bucket) || new Date(r.created_at).getTime(),
        executionMode: (r.execution_mode === 'unlink' ? 'unlink' : 'direct') as 'direct' | 'unlink',
        marketName: String(r.market_name || ''),
        walletHash: String(r.wallet_hash || 'anon'),
      }
    })

    // Compute stats
    const uniqueWallets = new Set(rows.map((r) => r.wallet_hash))
    const activeTraders = uniqueWallets.size

    let totalVolume = 0
    rows.forEach((r) => {
      totalVolume += AMOUNT_MIDPOINT[String(r.amount_bucket || '1-10')] || 5
    })

    // Derive market name from most recent trade with a name
    const recentMarketName = rows.find((r) => r.market_name && r.market_name !== '')?.market_name || 'Live Market'

    // Side breakdown (K-anonymity: only reveal if >= 5 unique wallets)
    let teamAPct = 50
    let teamBPct = 50
    const sides = rows.map((r) => String(r.side))
    if (activeTraders >= 5) {
      const sideA = sides.filter((s) => s === 'Yes').length
      teamAPct = Math.round((sideA / sides.length) * 100)
      teamBPct = 100 - teamAPct
    }

    // Spike indicator: trades in last 5 min vs avg 5 min window over the 2h
    const fiveMinAgo = Date.now() - 5 * 60 * 1000
    const recentCount = rows.filter((r) => Number(r.timestamp_bucket) > fiveMinAgo).length
    const avgPer5Min = rows.length / 24 // 2h = 24 five-min windows
    const spike = avgPer5Min > 0 ? recentCount / avgPer5Min : 1.0

    // ZK privacy stats
    const zkCount = rows.filter((r) => r.execution_mode === 'unlink').length
    const zkPct = rows.length > 0 ? Math.round((zkCount / rows.length) * 100) : 0

    const stats: PulseStats = {
      marketName: recentMarketName,
      conditionId: conditionId || 'all',
      teamA: { name: 'YES', pct: teamAPct, price: teamAPct / 100 },
      teamB: { name: 'NO', pct: teamBPct, price: teamBPct / 100 },
      activeTraders,
      totalVolume: Math.round(totalVolume),
      spikeIndicator: Math.round(spike * 10) / 10,
      globalComparison: activeTraders >= 5
        ? `Crowd is ${teamAPct}% YES. ${teamAPct > 50 ? 'Bullish' : 'Bearish'} sentiment.`
        : 'Not enough traders yet for sentiment breakdown.',
      zkPrivateCount: zkCount,
      zkPrivatePct: zkPct,
    }

    return { points, stats, source: 'db' }
  } catch (e) {
    console.error('[Pulse Heatmap] DB error, falling back to mock:', e instanceof Error ? e.message : e)
    return null
  }
}

// ─── Route Handler ─────────────────────────────────────

export async function GET(request: NextRequest) {
  const conditionId = request.nextUrl.searchParams.get('conditionId') || undefined

  // Ensure table exists, then try real DB data
  await ensurePulseTable()
  const real = await fetchRealData(conditionId)

  if (real) {
    return NextResponse.json({
      points: real.points,
      stats: real.stats,
      source: 'db',
      ts: Date.now(),
    })
  }

  // No mock data — return empty state with real zeros
  return NextResponse.json({
    points: [],
    stats: {
      marketName: conditionId ? 'Loading...' : 'No active market',
      conditionId: conditionId || 'none',
      teamA: { name: 'YES', pct: 0, price: 0 },
      teamB: { name: 'NO', pct: 0, price: 0 },
      activeTraders: 0,
      totalVolume: 0,
      spikeIndicator: 0,
      globalComparison: 'No trades yet. Be the first to share your sentiment.',
      zkPrivateCount: 0,
      zkPrivatePct: 0,
    },
    source: 'live',
    ts: Date.now(),
  })
}
