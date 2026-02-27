import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

// ─── Types ─────────────────────────────────────────────

interface HeatmapPoint {
  lng: number
  lat: number
  intensity: number
  side: string
  timestamp: number
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
}

// ─── Manhattan Clusters (for mock fallback) ─────────────

const MANHATTAN_CLUSTERS = [
  { lat: 40.8116, lng: -73.9465, label: 'Harlem' },
  { lat: 40.7870, lng: -73.9754, label: 'UWS' },
  { lat: 40.7736, lng: -73.9566, label: 'UES' },
  { lat: 40.7638, lng: -73.9918, label: "Hell's Kitchen" },
  { lat: 40.7549, lng: -73.9840, label: 'Midtown' },
  { lat: 40.7580, lng: -73.9855, label: 'Times Square' },
  { lat: 40.7484, lng: -73.9785, label: 'Murray Hill' },
  { lat: 40.7465, lng: -73.9979, label: 'Chelsea' },
  { lat: 40.7382, lng: -73.9860, label: 'Gramercy' },
  { lat: 40.7233, lng: -74.0030, label: 'SoHo' },
  { lat: 40.7163, lng: -74.0086, label: 'Tribeca' },
  { lat: 40.7075, lng: -74.0113, label: 'FiDi' },
  { lat: 40.7282, lng: -73.9942, label: 'East Village' },
  { lat: 40.7527, lng: -73.9772, label: 'Grand Central' },
  { lat: 40.7614, lng: -73.9776, label: 'Rockefeller' },
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
    const jitterLat = (seededRandom(seed) - 0.5) * 0.006
    const jitterLng = (seededRandom(seed + 1) - 0.5) * 0.006

    points.push({
      lat: cluster.lat + jitterLat,
      lng: cluster.lng + jitterLng,
      intensity: 0.3 + seededRandom(seed + 2) * 0.7,
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
    globalComparison: `Local crowd is 57% Lakers, global market is 48%. This venue is ${Math.round(57 / 48 * 100 - 100)}% more bullish.`,
  }
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
          SELECT lat, lng, side, amount_bucket, wallet_hash, timestamp_bucket, created_at
          FROM pulse_trades
          WHERE condition_id = ${conditionId} AND timestamp_bucket > ${cutoff}
          ORDER BY created_at DESC
          LIMIT 500
        `
      : await sql`
          SELECT lat, lng, side, amount_bucket, wallet_hash, timestamp_bucket, created_at
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
      // Intensity: $5 → 0.3, $30 → 0.5, $75 → 0.7, $150 → 1.0
      const intensity = Math.min(0.3 + (midpoint / 200), 1.0)
      return {
        lat: Number(r.lat),
        lng: Number(r.lng),
        intensity,
        side: String(r.side || 'Yes'),
        timestamp: Number(r.timestamp_bucket) || new Date(r.created_at).getTime(),
      }
    })

    // Compute stats
    const uniqueWallets = new Set(rows.map((r) => r.wallet_hash))
    const activeTraders = uniqueWallets.size

    let totalVolume = 0
    rows.forEach((r) => {
      totalVolume += AMOUNT_MIDPOINT[String(r.amount_bucket || '1-10')] || 5
    })

    // Side breakdown (K-anonymity: only reveal if >= 5 unique wallets)
    let teamAPct = 50
    let teamBPct = 50
    const sides = rows.map((r) => String(r.side))
    if (activeTraders >= 5) {
      const sideA = sides.filter((s) => s === 'Lakers' || s === 'Yes').length
      teamAPct = Math.round((sideA / sides.length) * 100)
      teamBPct = 100 - teamAPct
    }

    // Spike indicator: trades in last 5 min vs avg 5 min window over the 2h
    const fiveMinAgo = Date.now() - 5 * 60 * 1000
    const recentCount = rows.filter((r) => Number(r.timestamp_bucket) > fiveMinAgo).length
    const avgPer5Min = rows.length / 24 // 2h = 24 five-min windows
    const spike = avgPer5Min > 0 ? recentCount / avgPer5Min : 1.0

    const stats: PulseStats = {
      marketName: 'NBA: LAKERS vs SUNS',
      conditionId: conditionId || 'all',
      teamA: { name: 'LAKERS', pct: teamAPct, price: teamAPct / 100 },
      teamB: { name: 'SUNS', pct: teamBPct, price: teamBPct / 100 },
      activeTraders,
      totalVolume: Math.round(totalVolume),
      spikeIndicator: Math.round(spike * 10) / 10,
      globalComparison: activeTraders >= 5
        ? `Local crowd is ${teamAPct}% Lakers. ${teamAPct > 50 ? 'Bullish' : 'Bearish'} vs global.`
        : 'Not enough traders yet for sentiment breakdown.',
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

  // Try real DB data first
  const real = await fetchRealData(conditionId)

  if (real) {
    return NextResponse.json({
      points: real.points,
      stats: real.stats,
      source: 'db',
      ts: Date.now(),
    })
  }

  // Fallback: mock data that grows over time
  return NextResponse.json({
    points: generateMockPoints(),
    stats: generateMockStats(),
    source: 'mock',
    ts: Date.now(),
  })
}
