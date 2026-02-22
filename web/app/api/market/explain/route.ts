import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { DeepAnalysisResult } from '../deep-analyze/route'

interface ExplainRequest {
  analysis: DeepAnalysisResult
  market: {
    question: string
    yesPrice: number
    noPrice: number
    volume: number
    endDate: string
  }
  language: 'en' | 'es' | 'pt'
}

function buildSystemPrompt(lang: string): string {
  const langInstr = lang === 'es'
    ? 'Responde en espanol. Tutea al usuario.'
    : lang === 'pt'
    ? 'Responda em portugues.'
    : 'Respond in English.'

  return `You are a betting analyst explaining market data to a casual bettor.
Write in short terminal-style lines, each starting with ">".
Be direct but friendly. Explain technical data in simple terms a sports fan understands.
Keep it to 5-6 lines max. Under 90 characters per line.
${langInstr}
Never speculate beyond the data. Never hallucinate numbers.
Focus on: what the bots are doing, whether smart money agrees, and a simple verdict.
Do NOT include "TAGS:" at the end. Just the analysis.`
}

function buildMarketPrompt(analysis: DeepAnalysisResult, market: ExplainRequest['market']): string {
  const { classifications, strategies, capitalByOutcome, topHolders } = analysis

  const strategyLines = Object.entries(strategies)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ')

  const top5 = topHolders.slice(0, 5)
    .map(h => `${h.pseudonym} | ${h.side} | $${h.positionSize} | ${h.classification} | ${h.strategy.label}`)
    .join('\n')

  return `Market: "${market.question}"
Current odds: YES ${Math.round(market.yesPrice * 100)}% / NO ${Math.round(market.noPrice * 100)}%
Volume: $${market.volume > 1000000 ? (market.volume / 1000000).toFixed(1) + 'M' : Math.round(market.volume / 1000) + 'K'}

Agent scan: ${analysis.holdersScanned} of ${analysis.totalHolders} holders scanned
Agent rate: ${analysis.agentRate}% automated
Classifications: Bot=${classifications.bot}, Likely Bot=${classifications.likelyBot}, Mixed=${classifications.mixed}, Human=${classifications.human}

Smart money direction: ${analysis.smartMoneyDirection} (${analysis.smartMoneyPct}% of agent capital)
Strategy distribution: ${strategyLines || 'None classified'}

Agent capital YES: $${Math.round(capitalByOutcome.Yes.agent)} agent / $${Math.round(capitalByOutcome.Yes.human)} human
Agent capital NO: $${Math.round(capitalByOutcome.No.agent)} agent / $${Math.round(capitalByOutcome.No.human)} human

Red flags: ${analysis.redFlags.length > 0 ? analysis.redFlags.join('; ') : 'None'}

Top 5 holders:
${top5 || 'N/A'}

Explain in simple terms what this means for someone deciding whether to bet on this market. What should they watch out for? End with a one-line verdict.`
}

function buildTemplateFallback(analysis: DeepAnalysisResult, market: ExplainRequest['market'], lang: string): string[] {
  const lines: string[] = []

  // Agent distribution
  if (analysis.agentRate >= 50) {
    lines.push(lang === 'es'
      ? `> Mercado dominado por bots: ${analysis.agentRate}% de los top holders son agentes.`
      : lang === 'pt'
      ? `> Mercado dominado por bots: ${analysis.agentRate}% dos top holders sao agentes.`
      : `> Bot-heavy market: ${analysis.agentRate}% of top holders are agents.`)
  } else if (analysis.agentRate >= 20) {
    lines.push(lang === 'es'
      ? `> Actividad moderada de bots: ${analysis.agentRate}% agentes entre los principales holders.`
      : lang === 'pt'
      ? `> Atividade moderada de bots: ${analysis.agentRate}% agentes entre os principais holders.`
      : `> Moderate bot activity: ${analysis.agentRate}% agents among top holders.`)
  } else {
    lines.push(lang === 'es'
      ? `> Mercado movido por humanos. Solo ${analysis.agentRate}% de actividad automatizada.`
      : lang === 'pt'
      ? `> Mercado movido por humanos. Apenas ${analysis.agentRate}% de atividade automatizada.`
      : `> Human-driven market. Only ${analysis.agentRate}% automated activity.`)
  }

  // Smart money
  if (analysis.smartMoneyDirection === 'Yes' || analysis.smartMoneyDirection === 'No') {
    lines.push(lang === 'es'
      ? `> Smart money apunta a ${analysis.smartMoneyDirection}: ${analysis.smartMoneyPct}% del capital de agentes.`
      : lang === 'pt'
      ? `> Smart money aponta para ${analysis.smartMoneyDirection}: ${analysis.smartMoneyPct}% do capital de agentes.`
      : `> Smart money favors ${analysis.smartMoneyDirection}: ${analysis.smartMoneyPct}% of agent capital.`)
  } else if (analysis.smartMoneyDirection === 'Divided') {
    lines.push(lang === 'es'
      ? '> Smart money dividido. Los bots no se ponen de acuerdo.'
      : lang === 'pt'
      ? '> Smart money dividido. Os bots nao concordam entre si.'
      : '> Smart money is split. Bots disagree with each other.')
  }

  // Red flags
  if (analysis.redFlags.length > 0) {
    lines.push(lang === 'es'
      ? `> Cuidado: ${analysis.redFlags[0]}`
      : lang === 'pt'
      ? `> Cuidado: ${analysis.redFlags[0]}`
      : `> Watch out: ${analysis.redFlags[0]}`)
  }

  // Verdict
  const yesOdds = Math.round(market.yesPrice * 100)
  const noOdds = Math.round(market.noPrice * 100)
  if (analysis.smartMoneyDirection === 'Yes' || analysis.smartMoneyDirection === 'No') {
    const side = analysis.smartMoneyDirection
    const odds = side === 'Yes' ? yesOdds : noOdds
    lines.push(lang === 'es'
      ? `> Veredicto: Los datos favorecen ${side} a ${odds}%. Procede con confianza moderada.`
      : lang === 'pt'
      ? `> Veredito: Os dados favorecem ${side} a ${odds}%. Proceda com confianca moderada.`
      : `> Verdict: Data favors ${side} at ${odds}%. Proceed with moderate confidence.`)
  } else {
    lines.push(lang === 'es'
      ? `> Veredicto: Sin senal clara. YES ${yesOdds}% vs NO ${noOdds}%. Apuesta con precaucion.`
      : lang === 'pt'
      ? `> Veredito: Sem sinal claro. YES ${yesOdds}% vs NO ${noOdds}%. Aposte com precaucao.`
      : `> Verdict: No clear signal. YES ${yesOdds}% vs NO ${noOdds}%. Bet with caution.`)
  }

  return lines
}

export async function POST(request: NextRequest) {
  const body: ExplainRequest = await request.json()
  const { analysis, market, language } = body

  if (!analysis || !market) {
    return NextResponse.json({ error: 'Missing analysis or market data' }, { status: 400 })
  }

  // Fallback if no API key
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      fallback: buildTemplateFallback(analysis, market, language || 'en'),
    })
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          const messageStream = anthropic.messages.stream({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 400,
            system: buildSystemPrompt(language || 'en'),
            messages: [{ role: 'user', content: buildMarketPrompt(analysis, market) }],
          })

          const response = await messageStream.finalMessage()
          for (const block of response.content) {
            if (block.type === 'text') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: block.text })}\n\n`))
            }
          }
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`))
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    // If SDK fails to initialize, use fallback
    return NextResponse.json({
      fallback: buildTemplateFallback(analysis, market, language || 'en'),
    })
  }
}
