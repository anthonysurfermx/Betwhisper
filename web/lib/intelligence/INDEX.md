# Polymarket Intelligence System

Complete Polymarket analysis engine. Copied from defi-mexico-hub for preservation.
These files are NOT imported by the active BetWhisper app. They are reference/archive
for when we build the API layer.

## Active BetWhisper files (in ../lib/)
- `polymarket.ts` - Search engine (league/team detection, scoring, 30 NBA teams)
- `polymarket-clob.ts` - CLOB order execution (FOK, slippage, sell)
- `polymarket-detector.ts` - Bot detection (7 signals, 364 lines, lite version)
- `constants.ts` - API endpoints, contract addresses, config
- `fallback-markets.ts` - Cached whale markets for demo safety

## Intelligence files (this folder)

### Core Services
- `polymarket-service-full.ts` (916 lines) - Full API client with:
  - Agent registry (localStorage)
  - Agent metrics (positions, trades, PnL)
  - Market/Event by slug
  - Market holders
  - Agent positions
  - Event price history (CLOB)
  - Recent trades for wallet
  - Bond scanner (high-probability yield markets)
  - Leaderboard (top traders by PnL)
  - Order book depth (bids/asks/spread/midpoint)
  - Batch spreads and midpoints
  - Open interest (single + batch)
  - Closed positions (resolved bets, win/loss)
  - Reward rates and APY

- `polymarket-detector-full.ts` (491 lines) - Enhanced bot detection with:
  - Same 7 signals (S1-S7) as lite version
  - Additional edge cases and refined thresholds
  - More strategy classification logic

### UI Pages
- `PolymarketTrackerPage.tsx` (3,482 lines) - Full tracker UI with 4 modes:
  - MODE 1: Market Scanner (cyan) - Scan individual markets, bot detection
  - MODE 2: Wallet Analyzer (green) - Analyze any Polymarket wallet
  - MODE 3: Smart Money Intelligence (green terminal) - Track top traders
    - 5 panels: Flow, Whale Signals, Edge Tracker, Portfolios, Alpha
  - MODE 4: Bond Scanner (violet) - Find yield opportunities

- `ConsensusPage.tsx` (945 lines) - Wallet X-Ray with:
  - Position breakdown by outcome
  - PnL analysis, trade timeline
  - Conviction metrics, smart money tracker

### Charts
- `PolymarketFlowChart.tsx` (155 lines) - Order flow decomposition (Recharts)
- `SmartMoneyFlowChart.tsx` - Capital flow Sankey visualization

### API
- `explain-api.ts` (462 lines) - AI Explain engine with 10 prompt builders:
  - wallet, market, exchange-metrics, latam-exchanges
  - smartmoney, smartmoney-signals, smartmoney-edge
  - smartmoney-portfolios, smartmoney-bonds, smartmoney-alpha
  - Uses Claude Haiku via streaming SSE

### Research
- `research/ARCHITECTURE.md` - V1 system design
- `research/ANALYZER_V2_ARCHITECTURE.md` - V2 with signals S8-S12
- `research/backtest.py` - Backtesting framework
- `research/backtest_data/` - Historical test data

## Vercel Proxy Rules (needed when consuming)
```json
{ "source": "/api/polymarket-gamma/:path*", "destination": "https://gamma-api.polymarket.com/:path*" }
{ "source": "/api/polymarket-data/:path*", "destination": "https://data-api.polymarket.com/:path*" }
{ "source": "/api/polymarket-clob/:path*", "destination": "https://clob.polymarket.com/:path*" }
```

## Scores
- AI Convergence Score (0-100): Consensus/25 + Edge/20 + Momentum/20 + Validation/15 + Quality/20
- Trader Reliability Score (0-100): WinRate/40 + PnL/25 + Diversification/20 + DataConfidence/15
