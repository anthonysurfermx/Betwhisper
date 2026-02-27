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
