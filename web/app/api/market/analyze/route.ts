import { NextRequest, NextResponse } from 'next/server'
import { getMarketHolders } from '@/lib/polymarket'
import { getWalletScore, SMART_WALLET_COUNT } from '@/lib/wallet-scores'
import { CONVICTION_CAP, MIN_SMART_WALLETS_FOR_SIGNAL } from '@/lib/constants'

const AGENT_THRESHOLD = 85 // bot_score_inv below this = likely agent

export interface SmartWalletPosition {
  address: string
  pseudonym: string
  score: number
  side: 'Yes' | 'No'
  positionSize: number
  conviction: number
  weight: number
  isAgent: boolean
}

export interface AgentShield {
  agentCount: number
  humanCount: number
  warning: string | null
  riskLevel: 'low' | 'medium' | 'high'
}

export interface AnalysisResult {
  smartWallets: SmartWalletPosition[]
  consensus: {
    direction: 'Yes' | 'No' | 'Neutral'
    pct: number
    yesWeight: number
    noWeight: number
    count: number
  }
  agentShield: AgentShield
  totalHolders: number
  trackedWalletCount: number
  signalHash: string
}

function computeSignalHash(smartWallets: SmartWalletPosition[], conditionId: string): string {
  const payload = smartWallets
    .map(w => `${w.address}:${w.side}:${w.weight.toFixed(2)}`)
    .sort()
    .join('|')
  const raw = `${conditionId}|${payload}|${Date.now()}`

  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }
  return '0x' + Math.abs(hash).toString(16).padStart(16, '0')
}

export async function POST(request: NextRequest) {
  const { conditionId } = await request.json()

  if (!conditionId) {
    return NextResponse.json({ error: 'conditionId required' }, { status: 400 })
  }

  try {
    const holders = await getMarketHolders(conditionId)

    const smartWallets: SmartWalletPosition[] = []
    for (const holder of holders) {
      const score = getWalletScore(holder.address)
      if (!score) continue

      const conviction = score.median_position_size > 0
        ? Math.min(holder.amount / score.median_position_size, CONVICTION_CAP)
        : 1.0

      const weight = score.overall_score * conviction
      const isAgent = score.bot_score_inv < AGENT_THRESHOLD

      smartWallets.push({
        address: holder.address,
        pseudonym: score.pseudonym,
        score: score.overall_score,
        side: holder.outcome,
        positionSize: holder.amount,
        conviction: Math.round(conviction * 100) / 100,
        weight: Math.round(weight * 100) / 100,
        isAgent,
      })
    }

    smartWallets.sort((a, b) => b.weight - a.weight)

    // Weighted consensus
    let yesWeight = 0
    let noWeight = 0
    for (const w of smartWallets) {
      if (w.side === 'Yes') yesWeight += w.weight
      else noWeight += w.weight
    }

    const totalWeight = yesWeight + noWeight
    let direction: 'Yes' | 'No' | 'Neutral' = 'Neutral'
    let pct = 0

    if (smartWallets.length >= MIN_SMART_WALLETS_FOR_SIGNAL && totalWeight > 0) {
      if (yesWeight > noWeight) {
        direction = 'Yes'
        pct = Math.round((yesWeight / totalWeight) * 100)
      } else {
        direction = 'No'
        pct = Math.round((noWeight / totalWeight) * 100)
      }
    }

    // Agent Shield analysis
    const agentCount = smartWallets.filter(w => w.isAgent).length
    const humanCount = smartWallets.length - agentCount

    let riskLevel: 'low' | 'medium' | 'high' = 'low'
    let warning: string | null = null

    if (agentCount >= 3) {
      riskLevel = 'high'
      warning = `High AI activity: ${agentCount} agents detected. Consensus may be artificially inflated.`
    } else if (agentCount >= 1) {
      riskLevel = 'medium'
      warning = `Caution: ${agentCount} AI agent${agentCount > 1 ? 's' : ''} active in this market.`
    }

    const agentShield: AgentShield = { agentCount, humanCount, warning, riskLevel }
    const signalHash = computeSignalHash(smartWallets, conditionId)

    const result: AnalysisResult = {
      smartWallets,
      consensus: {
        direction,
        pct,
        yesWeight: Math.round(yesWeight),
        noWeight: Math.round(noWeight),
        count: smartWallets.length,
      },
      agentShield,
      totalHolders: holders.length,
      trackedWalletCount: SMART_WALLET_COUNT,
      signalHash,
    }

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to analyze market', detail: String(error) },
      { status: 500 }
    )
  }
}
