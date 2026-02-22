// Win Probability + Smart Money Sizing (Kelly Criterion)
// Pure math, no API calls. Uses Agent Radar data + Polymarket prices.

import type { DeepAnalysisResult } from '@/app/api/market/deep-analyze/route'

export interface ProbabilityResult {
  winProbability: number          // 0-100 composite score
  recommendedSide: 'Yes' | 'No' | null
  confidence: 'high' | 'medium' | 'low'
  edge: number                    // positive = we have edge
  kellyFraction: number           // 0-1
  smartMoneySize: number          // in USD
  betAmount: number               // user's intended bet in USD
  breakdown: {
    marketImplied: number         // from Polymarket price
    agentAdjustment: number       // +/- up to 10%
    redFlagPenalty: number        // 0 to -15%
    marketImpact: number          // 0 to -20% penalty from size vs volume
  }
}

export function calculateWinProbability(
  analysis: DeepAnalysisResult,
  yesPrice: number,
  noPrice: number,
  betAmountUSD: number,
  marketVolumeUSD: number,
): ProbabilityResult {
  // 1. Determine which side to evaluate based on smart money
  let evaluatingSide: 'Yes' | 'No'
  if (analysis.smartMoneyDirection === 'Yes') evaluatingSide = 'Yes'
  else if (analysis.smartMoneyDirection === 'No') evaluatingSide = 'No'
  else evaluatingSide = yesPrice >= noPrice ? 'Yes' : 'No'

  // 2. Base: Polymarket price IS the implied probability
  const marketImplied = (evaluatingSide === 'Yes' ? yesPrice : noPrice) * 100

  // 3. Agent adjustment: smart money conviction, +/- up to 10%
  let agentAdjustment = 0
  if (analysis.smartMoneyDirection === evaluatingSide && analysis.smartMoneyPct > 50) {
    agentAdjustment = Math.min(10, ((analysis.smartMoneyPct - 50) / 50) * 10)
  } else if (
    analysis.smartMoneyDirection !== 'Divided' &&
    analysis.smartMoneyDirection !== 'No Signal' &&
    analysis.smartMoneyDirection !== evaluatingSide
  ) {
    agentAdjustment = -Math.min(10, ((analysis.smartMoneyPct - 50) / 50) * 10)
  }

  // 4. Red flag penalty
  let redFlagPenalty = 0
  if (analysis.agentRate >= 60) redFlagPenalty = -10
  else if (analysis.agentRate >= 40) redFlagPenalty = -5
  if (analysis.redFlags.length >= 3) redFlagPenalty -= 5
  redFlagPenalty = Math.max(-15, redFlagPenalty)

  // 5. Market impact penalty: your bet size relative to market volume
  //    If you're >5% of volume, your entry MOVES the market against you (slippage)
  //    Scale: 5% of volume -> -2%, 25% -> -10%, 50%+ -> -20%
  let marketImpact = 0
  if (marketVolumeUSD > 0 && betAmountUSD > 0) {
    const sizeRatio = betAmountUSD / marketVolumeUSD
    if (sizeRatio >= 0.50) marketImpact = -20
    else if (sizeRatio >= 0.25) marketImpact = -10 - ((sizeRatio - 0.25) / 0.25) * 10
    else if (sizeRatio >= 0.05) marketImpact = -2 - ((sizeRatio - 0.05) / 0.20) * 8
    // Below 5% of volume = negligible impact
    marketImpact = Math.round(marketImpact * 10) / 10
  }

  // 6. Composite win probability (capped 5-95)
  const winProbability = Math.max(5, Math.min(95,
    Math.round(marketImplied + agentAdjustment + redFlagPenalty + marketImpact)
  ))

  // 7. Edge calculation
  const marketPrice = evaluatingSide === 'Yes' ? yesPrice : noPrice
  const ourProbability = winProbability / 100
  const edge = marketPrice > 0 ? (ourProbability - marketPrice) / marketPrice : 0

  // 8. Simplified Kelly Criterion (half-Kelly, capped at 25% of bet amount)
  const b = marketPrice > 0 ? (1 / marketPrice) - 1 : 0
  const p = ourProbability
  const q = 1 - p
  const kellyRaw = b > 0 ? (b * p - q) / b : 0
  const kellyFraction = Math.max(0, Math.min(0.25, kellyRaw * 0.5))

  // 9. Smart Money Size: Kelly fraction applied to their stated amount
  const smartMoneySize = betAmountUSD > 0
    ? Math.max(1, Math.round(kellyFraction * betAmountUSD))
    : Math.max(0.01, Math.round(kellyFraction * 100) / 100)

  // 10. Confidence level (market impact degrades confidence)
  let confidence: 'high' | 'medium' | 'low'
  if (edge > 0.1 && analysis.redFlags.length === 0 && marketImpact > -5) confidence = 'high'
  else if (edge > 0 && marketImpact > -10) confidence = 'medium'
  else confidence = 'low'

  return {
    winProbability,
    recommendedSide: edge > 0 ? evaluatingSide : null,
    confidence,
    edge: Math.round(edge * 1000) / 1000,
    kellyFraction: Math.round(kellyFraction * 1000) / 1000,
    smartMoneySize,
    betAmount: betAmountUSD,
    breakdown: {
      marketImplied: Math.round(marketImplied),
      agentAdjustment: Math.round(agentAdjustment * 10) / 10,
      redFlagPenalty: Math.round(redFlagPenalty * 10) / 10,
      marketImpact,
    },
  }
}
