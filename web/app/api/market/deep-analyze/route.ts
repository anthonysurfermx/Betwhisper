import { NextRequest, NextResponse } from 'next/server'
import { getMarketHolders } from '@/lib/polymarket'
import { detectBot } from '@/lib/polymarket-detector'
import type { BotDetectionResult, StrategyType } from '@/lib/polymarket-detector'

// Deep analysis: scan top N holders with full Agent Radar engine
// Returns market structure, agent classification, strategy distribution,
// capital flow by side, top holders with bot scores, and recommendation

const MAX_HOLDERS_TO_SCAN = 15 // scan top 15 holders (balance speed vs depth)

export interface DeepAnalysisResult {
  // Market structure
  totalHolders: number
  holdersScanned: number
  agentRate: number // 0-100 percentage
  classifications: {
    bot: number
    likelyBot: number
    mixed: number
    human: number
  }
  // Strategy distribution
  strategies: Record<StrategyType, number>
  dominantStrategy: { type: StrategyType; label: string; count: number } | null
  // Capital flow by side
  capitalByOutcome: {
    Yes: { total: number; agent: number; human: number }
    No: { total: number; agent: number; human: number }
  }
  // Top holders with full bot detection
  topHolders: {
    address: string
    pseudonym: string
    side: 'Yes' | 'No'
    positionSize: number
    botScore: number
    classification: string
    strategy: { type: StrategyType; label: string; confidence: number }
  }[]
  // Smart money consensus
  smartMoneyDirection: 'Yes' | 'No' | 'Divided' | 'No Signal'
  smartMoneyPct: number
  // Red flags
  redFlags: string[]
  // Recommendation
  recommendation: string
  // Tags
  tags: string[]
  // Signal hash
  signalHash: string
}

function computeSignalHash(holders: BotDetectionResult[], conditionId: string): string {
  const payload = holders
    .map(h => `${h.address}:${h.side}:${h.botScore}`)
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
    // 1. Fetch all holders
    const holders = await getMarketHolders(conditionId)
    if (holders.length === 0) {
      return NextResponse.json({ error: 'No holders found' }, { status: 404 })
    }

    // 2. Scan top N holders with full bot detection
    const topN = holders.slice(0, MAX_HOLDERS_TO_SCAN)
    const scanResults: BotDetectionResult[] = await Promise.all(
      topN.map(h => detectBot(h.address, h.pseudonym, h.outcome, h.amount))
    )

    // 3. Compute classifications
    const classifications = { bot: 0, likelyBot: 0, mixed: 0, human: 0 }
    for (const r of scanResults) {
      if (r.classification === 'bot') classifications.bot++
      else if (r.classification === 'likely-bot') classifications.likelyBot++
      else if (r.classification === 'mixed') classifications.mixed++
      else classifications.human++
    }
    const totalScanned = scanResults.length
    const agentCount = classifications.bot + classifications.likelyBot
    const agentRate = totalScanned > 0 ? Math.round((agentCount / totalScanned) * 100) : 0

    // 4. Strategy distribution
    const strategies: Record<StrategyType, number> = {
      MARKET_MAKER: 0, HYBRID: 0, SNIPER: 0, MOMENTUM: 0, UNCLASSIFIED: 0
    }
    for (const r of scanResults) {
      strategies[r.strategy.type]++
    }
    const strategyEntries = Object.entries(strategies)
      .filter(([k]) => k !== 'UNCLASSIFIED')
      .sort((a, b) => b[1] - a[1])
    const dominantStrategy = strategyEntries.length > 0 && strategyEntries[0][1] > 0
      ? {
          type: strategyEntries[0][0] as StrategyType,
          label: scanResults.find(r => r.strategy.type === strategyEntries[0][0])?.strategy.label || strategyEntries[0][0],
          count: strategyEntries[0][1]
        }
      : null

    // 5. Capital flow by side
    const capitalByOutcome = {
      Yes: { total: 0, agent: 0, human: 0 },
      No: { total: 0, agent: 0, human: 0 },
    }
    for (const r of scanResults) {
      const isAgent = r.classification === 'bot' || r.classification === 'likely-bot'
      capitalByOutcome[r.side].total += r.positionSize
      if (isAgent) capitalByOutcome[r.side].agent += r.positionSize
      else capitalByOutcome[r.side].human += r.positionSize
    }

    // 6. Smart money direction (agents favor which side?)
    let smartMoneyDirection: 'Yes' | 'No' | 'Divided' | 'No Signal' = 'No Signal'
    let smartMoneyPct = 0
    const agentResults = scanResults.filter(r => r.classification === 'bot' || r.classification === 'likely-bot')
    if (agentResults.length > 0) {
      const yesAgentCap = capitalByOutcome.Yes.agent
      const noAgentCap = capitalByOutcome.No.agent
      const totalAgentCap = yesAgentCap + noAgentCap
      if (totalAgentCap > 0) {
        if (yesAgentCap > noAgentCap * 1.5) {
          smartMoneyDirection = 'Yes'
          smartMoneyPct = Math.round((yesAgentCap / totalAgentCap) * 100)
        } else if (noAgentCap > yesAgentCap * 1.5) {
          smartMoneyDirection = 'No'
          smartMoneyPct = Math.round((noAgentCap / totalAgentCap) * 100)
        } else {
          smartMoneyDirection = 'Divided'
          smartMoneyPct = Math.round((Math.max(yesAgentCap, noAgentCap) / totalAgentCap) * 100)
        }
      }
    }

    // 7. Red flags
    const redFlags: string[] = []
    if (agentRate >= 60) redFlags.push(`High agent concentration: ${agentRate}% of top holders are bots`)
    if (agentRate >= 30 && agentRate < 60) redFlags.push(`Moderate agent activity: ${agentRate}% automated`)
    if (smartMoneyDirection === 'Divided') redFlags.push('Smart money is divided. No clear agent consensus.')
    if (classifications.bot >= 3) redFlags.push(`${classifications.bot} confirmed bots among top holders`)
    const ghostWhales = scanResults.filter(r => r.signals.ghostWhale > 60)
    if (ghostWhales.length > 0) redFlags.push(`${ghostWhales.length} ghost whale(s) detected (large positions, minimal trade history)`)
    if (dominantStrategy?.type === 'SNIPER' && dominantStrategy.count >= 2) {
      redFlags.push(`${dominantStrategy.count} snipers detected. Possible latency arbitrage activity.`)
    }

    // 8. Recommendation
    let recommendation = ''
    if (agentRate < 20 && redFlags.length === 0) {
      recommendation = 'Low agent activity. Market appears driven by human conviction. Standard risk.'
    } else if (agentRate < 40) {
      recommendation = 'Moderate agent presence. Check if agent capital aligns with your thesis before entering.'
    } else if (smartMoneyDirection === 'Divided') {
      recommendation = 'Smart money is split. High uncertainty. Consider waiting for clearer signal.'
    } else if (smartMoneyDirection !== 'No Signal') {
      recommendation = `Agents favor ${smartMoneyDirection} (${smartMoneyPct}% of agent capital). Proceed with awareness of bot-driven momentum.`
    } else {
      recommendation = 'High agent concentration. Exercise caution. Bots may exit quickly if conditions change.'
    }

    // 9. Tags
    const tags: string[] = []
    if (agentRate >= 50) tags.push('Bot-Heavy')
    else if (agentRate >= 20) tags.push('Mixed Participation')
    else tags.push('Human-Driven')
    if (dominantStrategy) tags.push(dominantStrategy.label)
    if (smartMoneyDirection === 'Yes' || smartMoneyDirection === 'No') tags.push(`Smart Money: ${smartMoneyDirection}`)
    if (ghostWhales.length > 0) tags.push('Ghost Whales')

    // 10. Top holders for display
    const topHolders = scanResults.map(r => ({
      address: r.address,
      pseudonym: r.pseudonym || `${r.address.slice(0, 6)}...${r.address.slice(-4)}`,
      side: r.side,
      positionSize: Math.round(r.positionSize),
      botScore: r.botScore,
      classification: r.classification,
      strategy: {
        type: r.strategy.type,
        label: r.strategy.label,
        confidence: r.strategy.confidence,
      },
    }))

    const signalHash = computeSignalHash(scanResults, conditionId)

    const result: DeepAnalysisResult = {
      totalHolders: holders.length,
      holdersScanned: totalScanned,
      agentRate,
      classifications,
      strategies,
      dominantStrategy,
      capitalByOutcome,
      topHolders,
      smartMoneyDirection,
      smartMoneyPct,
      redFlags,
      recommendation,
      tags,
      signalHash,
    }

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to deep-analyze market', detail: String(error) },
      { status: 500 }
    )
  }
}
