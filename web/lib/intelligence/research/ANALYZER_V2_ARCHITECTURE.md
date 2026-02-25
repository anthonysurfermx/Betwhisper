# DeFi Mexico Analyzer V2: Architecture Document

## Context

We built a Polymarket wallet analyzer that runs client-side. The user flow:
1. User scans a market on Polymarket Agent Radar (top holders)
2. Clicks "ACTIVATE DeFi MEXICO ANALYZER" on a specific wallet
3. Gets an X-Ray view: behavioral signals, portfolio summary, positions table

**Current state works but has 3 gaps we need to solve.**

## Gap 1: Strengthen Agent Detection (Bot Detector)

### What we have today
7 signals scored 0-100 with weighted average:

| Signal | Weight | How it works | Weakness |
|--------|--------|-------------|----------|
| INTERVAL (S1) | 20% | CV of trade intervals, sub-30s avg = machine | Only uses last 500 trades. Misses bots that trade slowly |
| SPLIT/MERGE (S2) | 25% | Ratio of merges to trades | High false positives. Legitimate users redeem too |
| SIZING (S3) | 15% | CV of position sizes | Low CV doesn't always mean bot |
| 24/7 (S4) | 15% | Count unique UTC hours in trades | Only 500 trades may not cover enough days |
| WIN_RATE (S5) | 15% | Win % from open positions PnL | Uses OPEN positions only. Closed wins/losses invisible |
| FOCUS (S6) | 10% | Category concentration via slug keyword matching | Keyword matching is fragile. "btc" in slug != crypto trade |
| GHOST (S7) | 50% alt | No trades but large positions | Too binary. Needs gradation |

### Problems to solve
1. **Only 500 trades analyzed.** High-frequency bots have thousands. We see a slice.
2. **Win rate from open positions only.** Closed positions (where bots redeem profits) are invisible.
3. **Category detection is keyword-based.** Misses many categories, creates false "other".
4. **No temporal patterns.** We don't detect day-of-week patterns, session clustering, or burst-then-pause behavior.
5. **No cross-market correlation.** We don't check if this wallet trades the same markets as known bots.
6. **Both-sides bonus is coarse.** 3 tiers (10%, 30%, 50%) with fixed bonus. Needs continuous scoring.
7. **Ghost whale needs more context.** Should check if wallet interacts with proxy contracts, if positions were transferred (not traded), if address is a smart contract.

### Proposed new signals for V2

| New Signal | Weight | Logic |
|-----------|--------|-------|
| BURST_PATTERN (S8) | 10% | Detect burst trading: 50+ trades in 10 min then silence for hours. Calculate burst_ratio = trades_in_bursts / total_trades |
| ROUND_NUMBERS (S9) | 5% | Bots often use round amounts ($100, $500, $1000). Count % of trades with round USD values |
| SPEED_AFTER_EVENT (S10) | 10% | How fast does wallet react to market moves? Measure avg time between price shift >5% and wallet's next trade |
| PORTFOLIO_DIVERSITY (S11) | 5% | Replace FOCUS. Use actual market count, category spread, temporal spread of entries |

### Proposed weight redistribution V2

| Signal | V1 Weight | V2 Weight |
|--------|-----------|-----------|
| INTERVAL | 20% | 15% |
| SPLIT/MERGE | 25% | 20% |
| SIZING | 15% | 10% |
| 24/7 | 15% | 10% |
| WIN_RATE | 15% | 10% |
| FOCUS | 10% | removed (replaced by PORTFOLIO_DIVERSITY) |
| BURST_PATTERN | new | 10% |
| ROUND_NUMBERS | new | 5% |
| SPEED_AFTER_EVENT | new | 10% |
| PORTFOLIO_DIVERSITY | new | 10% |

Total: 100%

### Classification thresholds
- 0-29: HUMAN
- 30-49: MIXED
- 50-69: LIKELY AGENT
- 70-100: AGENT

(Lowered from 40/60/80 because new signals give more granularity)

### Decisions (validated with Gemini review)
1. **FUNDING_SOURCE (S12): YES, add it.** Trace first MATIC/POL gas deposit. If funded by a dispersion contract (bot factory), Tornado Cash, or a CEX hot wallet that funded 50+ wallets in the same block, it's 99% Sybil/bot. Highest signal-to-noise ratio of all signals.
2. **500 trades is enough.** Polymarket rate limits (200 req/10s) make client-side pagination dangerous. Reframe as "Recent Tactical Window" analyzing current aggressiveness, not lifetime history.
3. **GHOST becomes its own classification: PROXY/VAULT.** Wallets with 0 trades but $5M+ in static positions are not bots or humans. Separate category eliminates the 50% weight distortion.

## Gap 2: Deeper Wallet Analysis (Analyzer Page)

### What we show today
- Portfolio value, total P&L, win rate, position count
- Behavioral signals (7 pixel bars from bot detector)
- Open positions table with P&L

### What's missing
1. **Trade history timeline.** We don't show WHEN the wallet traded. A timeline of entries/exits per market would reveal strategy.
2. **Market-specific analysis.** When user comes from a specific market, show THIS wallet's history in THAT market: entry price, timing, size progression, current position.
3. **Conviction metric.** Is this a whale playing with pocket change or going all-in? Show position_size / median_historical_size.
4. **Category breakdown.** Pie/bar chart of where this wallet trades: crypto, politics, sports, etc.
5. **Similar wallets.** "Wallets that trade the same markets" could reveal copy-trading rings.
6. **Performance metrics.** ROI, Sharpe ratio equivalent, max drawdown, avg hold time.

### Proposed new data fetches

| Data | API Endpoint | Purpose |
|------|-------------|---------|
| Full trade history | `data-api/activity?user=X&type=TRADE&limit=500` | Timeline, entry/exit analysis |
| Closed positions | `data-api/positions?user=X&sizeThreshold=0.01` | Include resolved markets for true win rate |
| Merge/redeem activity | `data-api/activity?user=X&type=MERGE&limit=500` | Profit-taking behavior |
| Market details | `gamma-api/markets?conditionId=Y` | Market context for the specific market |

### Proposed UI sections for V2

1. **Header**: Wallet address, pseudonym, classification badge, polymarket link (DONE)
2. **Stats grid**: Portfolio, P&L, Win Rate, Positions (DONE)
3. **Behavioral analysis terminal**: 7-11 signal bars (DONE, expand to V2 signals)
4. **Market context panel** (NEW): If `?market=` param exists, show this wallet's position in that specific market, entry timing, size, and how it compares to other holders
5. **Trade timeline** (NEW): Scrollable list of last 50 trades with timestamp, market, side, size, price
6. **Category breakdown** (NEW): Visual bar showing % of volume per category
7. **AI Explanation terminal** (NEW): See Gap 3

## Gap 3: "Explain with AI" as Reusable Insights Engine

### Concept
Not just a wallet explanation button. A **reusable AI insights component** that transforms any data context into natural language analysis. The same component powers:

1. **Wallet X-Ray** (ConsensusPage): "Explain this wallet's behavior"
2. **LATAM Exchange Metrics** (MetricsPage): "Explain these exchange volumes and trends"
3. **Market Analysis** (future): "Explain this prediction market's dynamics"
4. **Any future data page**: Drop in the component, pass it data, get AI insights

This shifts defimexico.org from an **information hub** (raw data, charts) to an **insights hub** (data + interpretation).

### Architecture: Generic Insights Engine

```
[Any Page Component]
       |
       | <AIInsightsTerminal
       |    context="wallet" | "exchange-metrics" | "market" | ...
       |    data={{ ...structured data for that context }}
       |    commandLabel="openclaw --explain 0xa5ef..."
       | />
       |
       | POST /api/explain
       | Body: { context, data, language? }
       |
[Single Vercel Edge Function: /api/explain]
       |
       | Selects system prompt based on context type
       | Serializes data into structured prompt
       |
       | Claude API (streaming)
       | Model: claude-haiku-4-5-20251001 (fast, cheap, perfect for structured terminal output)
       |
       | Stream response back via ReadableStream
       |
[AIInsightsTerminal: render character by character]
```

### Generic API Route: `/api/explain`

```typescript
// Single endpoint handles all context types
export async function POST(req) {
  const { context, data, language = 'en' } = await req.json()

  // Context-specific prompt builders
  const promptBuilders: Record<string, (data: any) => string> = {
    'wallet': buildWalletPrompt,
    'exchange-metrics': buildExchangeMetricsPrompt,
    'market': buildMarketPrompt,
  }

  const builder = promptBuilders[context]
  if (!builder) return new Response('Invalid context', { status: 400 })

  const systemPrompt = `You are an analyst at DeFi Mexico.
Write in short terminal-style lines, each starting with ">".
Be direct, use data points, identify patterns. 3-5 paragraphs max.
${language === 'es' ? 'Respond in Spanish.' : 'Respond in English.'}
Never speculate beyond the data provided. Never hallucinate numbers.`

  const userPrompt = builder(data)

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    stream: true,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })
}
```

### Prompt Builders (per context)

```typescript
function buildWalletPrompt(data: WalletInsightData): string {
  return `Analyze this Polymarket wallet behavior.

WALLET: ${data.wallet}
PORTFOLIO: $${data.metrics.portfolioValue}
P&L: $${data.metrics.profitPnL}
POSITIONS: ${data.positions.length} open
WIN RATE: ${data.winRate}%
BOT SCORE: ${data.botSignals.botScore} (${data.botSignals.classification})

SIGNALS:
${Object.entries(data.botSignals.signals)
  .map(([k, v]) => `- ${k}: ${v}/100`)
  .join('\n')}

TOP POSITIONS:
${data.positions.slice(0, 10).map(p =>
  `${p.outcome} | ${p.title} | $${p.currentValue} | PnL: $${p.cashPnl}`
).join('\n')}

${data.marketContext ? `ANALYZING IN CONTEXT OF MARKET: ${data.marketContext}` : ''}`
}

function buildExchangeMetricsPrompt(data: ExchangeInsightData): string {
  return `Analyze LATAM crypto exchange data.

REGION: ${data.region}
PERIOD: ${data.period}
TOTAL VOLUME: $${data.totalVolume}

EXCHANGES:
${data.exchanges.map(e =>
  `${e.name} | Vol: $${e.volume} | Users: ${e.users} | Growth: ${e.growth}%`
).join('\n')}

KEY TRENDS:
${data.trends.map(t => `- ${t}`).join('\n')}

Identify which exchanges are growing fastest, what's driving adoption,
and what this means for the LATAM DeFi landscape.`
}

function buildMarketPrompt(data: MarketInsightData): string {
  return `Analyze this Polymarket prediction market.

MARKET: ${data.title}
VOLUME: $${data.volume}
LIQUIDITY: $${data.liquidity}
TOP OUTCOME: ${data.topOutcome} at ${data.topPrice}%

HOLDER DISTRIBUTION:
- Agents: ${data.agentPercent}%
- Humans: ${data.humanPercent}%
- Top 10 holders control: ${data.top10Percent}% of volume

Recent price movement: ${data.priceHistory}

Explain what the smart money is doing and what the holder composition tells us.`
}
```

### Reusable Frontend Component: `<AIInsightsTerminal />`

```typescript
// src/components/shared/AIInsightsTerminal.tsx

interface AIInsightsTerminalProps {
  context: string                    // 'wallet' | 'exchange-metrics' | 'market'
  data: Record<string, any>         // structured data for the prompt builder
  commandLabel?: string             // e.g. "openclaw --explain 0xa5ef..."
  buttonLabel?: string              // e.g. "EXPLAIN WITH AI"
  className?: string
}

// Component renders:
// 1. A button to trigger the explanation
// 2. On click: terminal window opens with streaming text
// 3. Terminal has header, green pulsing dot, line-by-line animation
// 4. Each line starts with ">" in cyan
// 5. Key data points auto-highlighted in amber/green/red
// 6. Can be dropped into ANY page
```

### Usage Examples

```tsx
// In ConsensusPage (Wallet X-Ray)
<AIInsightsTerminal
  context="wallet"
  data={{ wallet: address, metrics, positions, botSignals, marketContext }}
  commandLabel={`openclaw --explain ${address.slice(0,6)}...`}
  buttonLabel="EXPLAIN WALLET WITH AI"
/>

// In MetricsPage (LATAM Exchange Data)
<AIInsightsTerminal
  context="exchange-metrics"
  data={{ region: 'LATAM', period: 'Q1 2026', exchanges: exchangeData, trends }}
  commandLabel="openclaw --analyze latam-exchanges"
  buttonLabel="ANALYZE TRENDS WITH AI"
/>

// In PolymarketTrackerPage (Market Analysis)
<AIInsightsTerminal
  context="market"
  data={{ title: market.title, volume, liquidity, holderDistribution }}
  commandLabel={`openclaw --market "${market.title.slice(0,30)}..."`}
  buttonLabel="EXPLAIN MARKET WITH AI"
/>
```

### Cost estimate (Haiku pricing)
- Claude Haiku input: ~300-800 tokens depending on context ($0.80/M)
- Claude Haiku output: ~400 tokens ($4.00/M)
- Cost per analysis: ~$0.002
- At 100 analyses/day across all contexts: ~$0.20/day
- With caching (estimated 80% hit rate): ~$0.04/day

### API key security
- Store ANTHROPIC_API_KEY in Vercel env vars
- Edge function acts as proxy, never expose key to frontend
- Rate limit: 10 analyses per IP per hour per context (prevent abuse)
- Context validation: only accept known context types

### Decisions (validated with Gemini review)
1. **Use Claude 3.5 Haiku.** $0.80/M input vs $3.00/M Sonnet. 4x cheaper, faster TTFT. Terminal-style structured output doesn't need Sonnet's depth. Reserve Sonnet for a future "Pro" tier.
2. **Cache is mandatory.** Hash `wallet_address + context + truncated_hour`. Store in Vercel KV or Supabase. 50 users scanning the same top holder = 1 API call + 49 cache hits (3s to 50ms).
3. **Return structured JSON.** Claude outputs `{ markdown: "...", tags: ["High Conviction", "Sniper", "24/7 Operator"] }`. Tags render as visual badges in the UI instantly.
4. **Auto-detect `navigator.language` + visible EN/ES toggle.** Reduces friction but gives control.
5. **"Share Insight" button = growth engine.** Export terminal as image with cyberpunk aesthetic (monospace green phosphor, dark bg). Each user-generated analysis becomes Twitter content and YouTube B-roll.

### Streaming Markdown handling
Use raw text streaming (not react-markdown) since terminal-style ">" lines don't need markdown parsing. Each chunk appended as plain text with CSS highlighting for numbers ($, %), keywords (AGENT, HUMAN), and sentiment (profit/loss). This avoids the incomplete-markdown rendering bug that react-markdown has with streaming LLM output.

## Implementation Order

1. **Phase A**: AI Insights Engine (highest user impact, most visible differentiator)
   - Build `<AIInsightsTerminal />` reusable component
   - Create `/api/explain` generic edge function with wallet prompt builder
   - Wire up in ConsensusPage (wallet X-Ray)
   - Add exchange-metrics prompt builder
   - Wire up in MetricsPage

2. **Phase B**: Deeper Wallet Analysis
   - Add trade history fetch
   - Build timeline component
   - Add market-context panel
   - Category breakdown visual

3. **Phase C**: Strengthen Bot Detector
   - Add BURST_PATTERN signal
   - Add ROUND_NUMBERS signal
   - Recalibrate weights
   - Lower classification thresholds

## Backtest V2 Results (context for prioritization)

Ran backtest on 196 wallets, 597K trades. Best accuracy: **34% at 70% consensus threshold**.
Below random chance (50%) for binary markets. This confirms:
- Broad consensus across wallets is not predictive
- The pivot to focused single-wallet X-Ray analysis is correct
- Phase C (bot detector improvements) matters for classification accuracy, not prediction
- The AI insights layer (Phase A) adds the most user value by making complex data digestible

## Risks

1. **API costs**: Claude API is cheap but could add up if product gets traffic. Mitigation: rate limiting + caching + Haiku for simple contexts.
2. **Polymarket API rate limits**: We already hit 400 errors on high-volume wallets (3500+ trades). More data fetches = more risk. Mitigation: client-side caching, progressive loading.
3. **LLM hallucination**: AI might make incorrect claims. Mitigation: structured prompt with only real data, strict "never speculate" instruction, no external knowledge allowed.
4. **Latency**: Streaming helps perceived performance but total response time is 3-5s for Claude. Acceptable for this use case.
5. **Prompt injection**: User-controlled data (wallet addresses, market titles) enters the prompt. Mitigation: sanitize inputs, use system prompt separation, validate data types.
