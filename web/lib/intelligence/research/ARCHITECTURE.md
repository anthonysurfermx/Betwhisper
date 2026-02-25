# Wallet Basket Consensus: Complete Architecture v2

## Post-Gemini Review: All gaps addressed

## 1. SYSTEM OVERVIEW

A system that aggregates signals from multiple "smart money" wallets on Polymarket,
groups them by topic, applies multi-attribute scoring, and only executes trades when
there is 80%+ consensus from the basket. Nobody has productized this yet.

Key differentiator vs 1:1 copy trading (Polycule, PolyCop): instead of blindly
copying one whale that could be a bot, decoy, or splitting across wallets, the
system filters noise and only acts when there is real smart money convergence.

## 2. ENTRY LOGIC

### 2.1 Data Pipeline

```
[CLOB WebSocket]        [Polygon RPC Events]     [Data API Polling]
  ~100ms latency           ~2s latency              ~30s batches
       |                        |                        |
       v                        v                        v
  ┌──────────────────────────────────────────────────────────┐
  │              TRADE DETECTION LAYER                        │
  │  CLOB: order book changes (fastest signal)                │
  │  On-chain: OrderFilled, OrdersMatched events              │
  │  Data API: /activity endpoint for enriched trade data     │
  └────────────────────────┬─────────────────────────────────┘
                           │
                           v
  ┌──────────────────────────────────────────────────────────┐
  │              WALLET SCORING ENGINE                        │
  │  12 attributes, recalculated every 6 hours                │
  │  Runs on dedicated worker (DigitalOcean droplet)          │
  │  NOT on Supabase Edge Functions (too heavy)               │
  └────────────────────────┬─────────────────────────────────┘
                           │
                           v
  ┌──────────────────────────────────────────────────────────┐
  │              BASKET CONSENSUS ENGINE                       │
  │  Topic baskets + Confidence-Weighted Quorum               │
  │  + Time Decay + Correlation Filter                        │
  └────────────────────────┬─────────────────────────────────┘
                           │
                           v
  ┌──────────────────────────────────────────────────────────┐
  │              PRE-EXECUTION CHECKS                         │
  │  Spread/Liquidity verification                            │
  │  Available order book depth check                         │
  └────────────────────────┬─────────────────────────────────┘
                           │
                           v
  ┌──────────────────────────────────────────────────────────┐
  │              EXECUTION / SIGNAL OUTPUT                    │
  │  Position sizing proportional to consensus strength       │
  └──────────────────────────────────────────────────────────┘
```

### 2.2 Wallet Scoring (12 attributes, 0-100 each)

Adapted from Darwinex DARWIN model.

| # | Attribute | What it measures | Weight | Data source |
|---|-----------|-----------------|--------|-------------|
| 1 | Win Rate | % of closed positions in profit | 15% | Data API /positions |
| 2 | ROI | Risk-adjusted return (Sharpe-like) | 15% | Data API /positions |
| 3 | Consistency | Return dispersion per position (low = good) | 10% | Data API /activity |
| 4 | Volume | Total capital traded (sample credibility) | 5% | Data API /activity |
| 5 | Experience | Number of distinct markets traded | 5% | Data API /activity |
| 6 | Timing Edge | Avg return in first 24h of each position | 10% | Data API + CLOB prices |
| 7 | Specialization | Concentration in 1-2 categories vs broad | 5% | Gamma API categories |
| 8 | Risk Stability | Position size variance (low CV = stable) | 10% | Data API /activity |
| 9 | Exit Quality | % of positions closed before resolution with profit | 10% | Data API /activity |
| 10 | Bot Score (inv) | 100 - Agent Radar bot score (low bot = good) | 5% | Our Agent Radar |
| 11 | Recency | Higher weight to last 30 days performance | 5% | Data API /activity |
| 12 | Capacity | Does performance degrade with larger positions | 5% | Data API /activity |

Wallet Score = weighted sum, normalized 0-100.
Threshold to enter basket: Score >= 60.
Per-basket scoring: A wallet can score 90 in crypto and 30 in politics.

### 2.3 Conviction Calculation (FIXED per Gemini feedback)

OLD (wrong): conviction = position_size / liquid_balance
Problem: DeFi wallets rarely hold idle USDC. Balance fluctuates with open positions.

NEW (correct):
```
conviction = position_size / avg_historical_position_size

Where avg_historical_position_size = median of last 50 position sizes for that wallet.

This measures: "Is this trade unusually large for this wallet?"
conviction > 2.0 = very high conviction (whale is going big)
conviction ~ 1.0 = normal size
conviction < 0.5 = small/testing position
```

### 2.4 Time Decay (NEW per Gemini feedback)

Signals from 5 days ago are not worth the same as signals from 2 hours ago.

```
time_weight = e^(-lambda * hours_since_trade)

Where lambda = ln(2) / half_life_hours

Default half_life_hours by market duration:
  - Markets resolving in < 7 days:  half_life = 6 hours
  - Markets resolving in 7-30 days: half_life = 24 hours
  - Markets resolving in 30+ days:  half_life = 72 hours

Example (24h half-life):
  Trade 2 hours ago:  weight = e^(-0.029 * 2)  = 0.94 (almost full)
  Trade 24 hours ago: weight = e^(-0.029 * 24) = 0.50 (half weight)
  Trade 48 hours ago: weight = e^(-0.029 * 48) = 0.25 (quarter weight)
  Trade 96 hours ago: weight = e^(-0.029 * 96) = 0.06 (effectively dead)
```

### 2.5 Correlation Filter (NEW per Gemini feedback)

Problem: 4 wallets following the same Telegram group != 4 independent signals.

Detection method: Pairwise trade correlation analysis.
```
For each pair of wallets (A, B) in a basket:
  1. Get all markets where both A and B took positions
  2. Calculate:
     - direction_agreement = % of shared markets where both went same direction
     - timing_correlation = avg |timestamp_A - timestamp_B| in shared markets
     - size_correlation = correlation coefficient of position sizes

  3. If direction_agreement > 90% AND timing_correlation < 300 seconds:
     Flag as "correlated pair"

  4. Correlated wallets get their combined weight capped:
     Instead of weight_A + weight_B, use max(weight_A, weight_B) * 1.2
     This prevents herding from inflating consensus
```

### 2.6 Consensus Algorithm (updated with all fixes)

```python
def evaluate_consensus(market_id, basket_wallets, market_duration_days):
    # 1. Get positions for all basket wallets in this market
    positions = get_positions(market_id, basket_wallets)

    if len(positions) < min_quorum:
        return Signal(strength="NO_ACTION", reason="insufficient_wallets")

    # 2. Calculate half-life based on market duration
    if market_duration_days < 7:
        half_life = 6
    elif market_duration_days < 30:
        half_life = 24
    else:
        half_life = 72

    lam = math.log(2) / half_life

    # 3. For each position, calculate weighted contribution
    yes_score = 0
    no_score = 0

    for pos in positions:
        wallet_score = get_wallet_score(pos.address, basket_topic) / 100

        # Conviction: relative to wallet's historical median
        median_size = get_median_position_size(pos.address)
        conviction = min(pos.size / median_size, 3.0)  # cap at 3x

        # Time decay
        hours_ago = (now() - pos.detected_at).total_seconds() / 3600
        time_weight = math.exp(-lam * hours_ago)

        # Correlation adjustment
        corr_multiplier = get_correlation_multiplier(pos.address, basket_wallets)

        weighted = wallet_score * conviction * time_weight * corr_multiplier

        if pos.direction == "YES":
            yes_score += weighted
        else:
            no_score += weighted

    total = yes_score + no_score
    consensus_pct = max(yes_score, no_score) / total * 100
    direction = "YES" if yes_score > no_score else "NO"
    wallets_agreeing = count_direction(positions, direction)

    # 4. Pre-execution check: verify spread
    spread = get_current_spread(market_id, direction)
    if spread > 0.10:  # 10% spread = too expensive
        return Signal(strength="ALERT", reason="spread_too_wide", spread=spread)

    # 5. Decision
    if consensus_pct >= 80 and wallets_agreeing >= min_quorum:
        return Signal(strength="EXECUTE", consensus=consensus_pct, direction=direction)
    elif consensus_pct >= 65:
        return Signal(strength="ALERT", consensus=consensus_pct, direction=direction)
    else:
        return Signal(strength="NO_ACTION", reason="basket_divided")
```

### 2.7 Position Sizing

```python
def calculate_position_size(signal, user_balance, max_per_trade=0.05):
    base_size = user_balance * max_per_trade

    # Scale by consensus strength (0.0 at 65%, 1.0 at 100%)
    consensus_mult = (signal.consensus - 65) / 35

    # Scale by average conviction of agreeing wallets
    avg_conviction = signal.avg_conviction
    conviction_mult = min(avg_conviction / 2.0, 1.0)  # normalize to 0-1

    final_size = base_size * consensus_mult * conviction_mult

    # Verify against available liquidity
    available_depth = get_order_book_depth(signal.market_id, signal.direction)
    max_executable = available_depth * 0.20  # don't take more than 20% of book

    return min(final_size, max_executable)
```

### 2.8 Spread/Liquidity Check (NEW per Gemini feedback)

```python
def get_current_spread(market_id, direction):
    """Check if we can actually execute at a reasonable price."""
    book = fetch_order_book(market_id)

    if direction == "YES":
        best_ask = book.asks[0].price if book.asks else 1.0
        best_bid = book.bids[0].price if book.bids else 0.0
    else:
        best_ask = 1 - book.bids[0].price if book.bids else 1.0
        best_bid = 1 - book.asks[0].price if book.asks else 0.0

    spread = best_ask - best_bid
    return spread

def get_order_book_depth(market_id, direction, price_tolerance=0.05):
    """How much USDC can we deploy within 5% of best price."""
    book = fetch_order_book(market_id)
    depth = 0

    if direction == "YES":
        best_ask = book.asks[0].price
        for ask in book.asks:
            if ask.price <= best_ask + price_tolerance:
                depth += ask.size * ask.price
    else:
        best_bid = book.bids[0].price
        for bid in book.bids:
            if bid.price >= best_bid - price_tolerance:
                depth += bid.size * (1 - bid.price)

    return depth
```

## 3. EXIT STRATEGY (NEW: Gemini's critical gap)

This was the biggest gap in v1. The system needs to know when and how to exit.

### 3.1 Exit Triggers (3 independent triggers, any one fires)

```
TRIGGER 1: REVERSE CONSENSUS
  When consensus drops below 50% in the original direction.
  Meaning: the smart money is now divided or reversing.

  Check frequency: Every 30 minutes
  Action: Close 100% of position at market price

TRIGGER 2: WHALE EXIT CASCADE
  When 50%+ of the wallets that agreed on entry have closed/reduced
  their positions by 50%+ from peak size.

  Check frequency: Every 15 minutes (via Data API /activity)
  Action: Close proportionally to how much the basket has exited
    If 60% of basket exited: close 60%
    If 80% of basket exited: close 100%

TRIGGER 3: PROFIT/LOSS THRESHOLDS
  Hard limits regardless of consensus state.

  Take Profit: When position is +40% (price moved from 0.50 to 0.70)
    Action: Close 50% (lock profit, let rest ride)

  Stop Loss: When position is -25% (price moved from 0.50 to 0.375)
    Action: Close 100% (protect capital)

  Time Stop: If position held > 80% of market duration with < 5% move
    Action: Close 100% (capital is trapped in a dead market)
```

### 3.2 Exit Algorithm

```python
def check_exit_conditions(position, basket_wallets, market_info):
    """Called every 15 minutes for each open position."""

    # TRIGGER 1: Reverse Consensus
    current_consensus = evaluate_consensus(
        position.market_id, basket_wallets, market_info.duration_days
    )
    if current_consensus.direction != position.direction:
        if current_consensus.consensus >= 50:
            return ExitSignal(
                action="CLOSE_ALL",
                reason="reverse_consensus",
                urgency="HIGH"
            )
    elif current_consensus.consensus < 50:
        return ExitSignal(
            action="CLOSE_ALL",
            reason="consensus_collapsed",
            urgency="HIGH"
        )

    # TRIGGER 2: Whale Exit Cascade
    original_wallets = position.entry_wallets  # wallets that agreed on entry
    current_positions = get_current_positions(position.market_id, original_wallets)

    exited_count = 0
    for wallet in original_wallets:
        wallet_pos = current_positions.get(wallet)
        if wallet_pos is None or wallet_pos.size < position.entry_sizes[wallet] * 0.5:
            exited_count += 1

    exit_ratio = exited_count / len(original_wallets)

    if exit_ratio >= 0.80:
        return ExitSignal(action="CLOSE_ALL", reason="whale_cascade_80pct", urgency="HIGH")
    elif exit_ratio >= 0.50:
        return ExitSignal(
            action="CLOSE_PARTIAL",
            close_pct=exit_ratio,
            reason=f"whale_cascade_{int(exit_ratio*100)}pct",
            urgency="MEDIUM"
        )

    # TRIGGER 3: Profit/Loss Thresholds
    current_price = get_current_price(position.market_id, position.direction)
    pnl_pct = (current_price - position.entry_price) / position.entry_price

    if pnl_pct >= 0.40:
        return ExitSignal(
            action="CLOSE_PARTIAL",
            close_pct=0.50,
            reason="take_profit_40pct",
            urgency="LOW"
        )

    if pnl_pct <= -0.25:
        return ExitSignal(action="CLOSE_ALL", reason="stop_loss_25pct", urgency="HIGH")

    # Time stop
    elapsed = (now() - position.entry_time).total_seconds()
    market_duration = (market_info.end_date - market_info.start_date).total_seconds()
    time_elapsed_pct = elapsed / market_duration

    if time_elapsed_pct > 0.80 and abs(pnl_pct) < 0.05:
        return ExitSignal(action="CLOSE_ALL", reason="time_stop_dead_market", urgency="LOW")

    return None  # No exit needed

```

### 3.3 Exit Execution

```python
def execute_exit(exit_signal, position):
    """Execute the exit with spread protection."""

    # Check spread before executing
    spread = get_current_spread(position.market_id, position.direction)

    if spread > 0.15 and exit_signal.urgency != "HIGH":
        # Wide spread on non-urgent exit: use limit order instead
        limit_price = get_best_bid(position.market_id, position.direction)
        place_limit_sell(position, limit_price, ttl_minutes=30)
        return

    # For urgent exits or reasonable spreads: market order
    if exit_signal.action == "CLOSE_ALL":
        place_market_sell(position, position.size)
    elif exit_signal.action == "CLOSE_PARTIAL":
        sell_size = position.size * exit_signal.close_pct
        place_market_sell(position, sell_size)
```

## 4. TOPIC BASKETS

| Basket | Market categories | Min wallets | Min score |
|--------|------------------|-------------|-----------|
| crypto-short | BTC/ETH price, 15-min, crypto prices | 5 | 60 |
| politics-us | Elections, Trump, Congress, policy | 5 | 60 |
| geopolitics | Conflicts, treaties, sanctions | 3 | 55 |
| sports | NBA, NFL, soccer, UFC | 5 | 60 |
| weather-science | Temperature, climate, NASA | 3 | 55 |
| culture | Oscars, Billboard, tech launches | 3 | 55 |
| economics | Fed rates, GDP, inflation, jobs | 3 | 60 |

A wallet can be in multiple baskets. Score is per-basket, not global.

## 5. DATA MODEL (Supabase)

```sql
CREATE TABLE wallet_scores (
  address TEXT PRIMARY KEY,
  pseudonym TEXT,
  overall_score NUMERIC,
  win_rate NUMERIC,
  roi NUMERIC,
  consistency NUMERIC,
  volume_score NUMERIC,
  experience NUMERIC,
  timing_edge NUMERIC,
  specialization NUMERIC,
  risk_stability NUMERIC,
  exit_quality NUMERIC,
  bot_score_inv NUMERIC,
  recency NUMERIC,
  capacity NUMERIC,
  baskets TEXT[],
  basket_scores JSONB,           -- {"crypto-short": 85, "politics-us": 42}
  total_positions INT,
  median_position_size NUMERIC,  -- for conviction calc
  last_scored_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE consensus_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  basket TEXT NOT NULL,
  market_slug TEXT NOT NULL,
  market_question TEXT,
  condition_id TEXT,
  direction TEXT NOT NULL,        -- 'YES' | 'NO'
  consensus_pct NUMERIC,
  wallets_agreeing INT,
  wallets_total INT,
  avg_conviction NUMERIC,
  avg_wallet_score NUMERIC,
  signal_strength TEXT,           -- 'EXECUTE' | 'ALERT' | 'CONFLICT'
  suggested_size_pct NUMERIC,
  outcome_price NUMERIC,
  spread_at_signal NUMERIC,
  book_depth_usdc NUMERIC,
  time_decay_applied BOOLEAN DEFAULT true,
  correlation_filtered BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE basket_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL,
  market_slug TEXT NOT NULL,
  condition_id TEXT,
  direction TEXT,
  size NUMERIC,
  avg_price NUMERIC,
  conviction NUMERIC,              -- size / median_historical_size
  time_weight NUMERIC DEFAULT 1.0, -- exponential decay applied
  detected_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE open_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  market_slug TEXT NOT NULL,
  condition_id TEXT,
  direction TEXT NOT NULL,
  size NUMERIC NOT NULL,
  entry_price NUMERIC NOT NULL,
  current_price NUMERIC,
  pnl_pct NUMERIC,
  entry_consensus_pct NUMERIC,
  entry_wallets TEXT[],            -- wallets that agreed on entry
  entry_sizes JSONB,               -- {"0xABC": 500, "0xDEF": 200}
  basket TEXT NOT NULL,
  exit_signal TEXT,
  exit_price NUMERIC,
  exit_reason TEXT,
  status TEXT DEFAULT 'OPEN',      -- OPEN | PARTIAL_EXIT | CLOSED
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ
);

CREATE TABLE wallet_correlations (
  wallet_a TEXT NOT NULL,
  wallet_b TEXT NOT NULL,
  direction_agreement NUMERIC,     -- 0.0 to 1.0
  avg_timing_diff_seconds NUMERIC,
  size_correlation NUMERIC,        -- -1.0 to 1.0
  is_correlated BOOLEAN DEFAULT false,
  shared_markets INT,
  last_calculated_at TIMESTAMPTZ,
  PRIMARY KEY (wallet_a, wallet_b)
);
```

## 6. IMPLEMENTATION PHASES

| Phase | What | Timeline | Revenue |
|-------|------|----------|---------|
| **0: Backtest** | Simulate with 6 months historical data. Validate 80% threshold, attribute weights, exit triggers. NO CODE in production. | 1-2 weeks | None |
| **1: Signal Dashboard** | Wallet scoring + basket construction + consensus alerts in UI. Read-only, 0 execution. User sees signals and decides manually | 2-3 weeks | Free tier |
| **2: Telegram Alerts + API** | Bot sends consensus signals. Premium API for quants. Monetization starts here | +1 week | $29-99/mo subscription |
| **3: One-Click Execute** | py-clob-client integration. User connects wallet, sees signal, clicks "Execute" with recommended sizing | +2-3 weeks | Transaction fee 0.5% |
| **4: Vault (maybe never)** | Auto-execute vault with deposited USDC. Requires audit ($30-50K), CPO legal review. Only if V1-V3 validate the model | +4-6 weeks | 10% performance fee |

Per Gemini: monetize at V2, not V4. Signals are the product. Custody is a trap.

## 7. BACKTESTING FRAMEWORK (Fase 0)

### 7.1 Data Sources

| Source | What we get | How |
|--------|------------|-----|
| HuggingFace SII-WANGZJ/Polymarket_data | 1.1B trades, users.parquet has per-wallet history | Download 107GB parquet |
| Data API /activity | Recent trades per wallet, enriched | REST API, 1000 req/10s |
| Gamma API /markets?closed=true | All resolved markets with outcomes | REST API, 300 req/10s |
| CLOB /prices-history | Price timeseries per token | REST API, 1000 req/10s |

### 7.2 Backtest Pipeline

```
Step 1: Seed wallets
  - Top 100 holders from 20 most active markets (our Agent Radar)
  - Top 50 from Polymarket leaderboard
  - Deduplicate -> ~200-300 unique wallets

Step 2: Pull trade history
  - Data API /activity for each wallet, last 6 months
  - Store in local SQLite or Parquet

Step 3: Score wallets
  - Calculate 12 attributes for each wallet
  - Assign to baskets based on market categories

Step 4: Replay timeline
  - Sort all trades chronologically
  - For each trade, update basket state
  - Check consensus at each timestamp
  - When consensus >= 80%: record "entry signal"
  - Track position from entry to market resolution

Step 5: Simulate exits
  - Apply 3 exit triggers at each check interval
  - Record actual exit vs hold-to-resolution

Step 6: Calculate metrics
  - Signal accuracy (did consensus direction win?)
  - ROI per signal
  - Sharpe ratio of the strategy
  - Max drawdown
  - Compare: consensus vs random wallet copy vs top-1 wallet copy
```

### 7.3 Key Questions Backtest Must Answer

1. Does 80% threshold outperform 60% or 90%?
2. Which attribute weights matter most? (sensitivity analysis)
3. Does time decay improve or hurt accuracy?
4. Does correlation filter reduce false signals?
5. Does the exit strategy improve ROI vs hold-to-resolution?
6. Which baskets have strongest consensus alpha?
7. What is the optimal min_quorum per basket?
8. How much does slippage eat into theoretical returns?

## 8. RISKS AND MITIGATIONS

| Risk | Severity | Mitigation |
|------|----------|------------|
| Whale evasion (multi-wallet) | HIGH | Consensus is inherently robust to splitting. Wallet clustering detects linked accounts |
| Latency vs consensus | MEDIUM | Accept tradeoff. Target markets > 7 days duration. Not competing on speed |
| Cold start (no scores) | MEDIUM | Bootstrap with Agent Radar holders + leaderboard + subgraph history |
| Scoring overfitting | MEDIUM | Per-basket scores, 30-day recency weight, min 20 closed positions |
| Consensus manipulation | LOW | 90-day history + 20 trades minimum. Gradual weight ramp for new wallets |
| False consensus (herding) | HIGH | Correlation filter caps combined weight of correlated pairs |
| Liquidity exhaustion | HIGH | Pre-execution spread check. Don't take > 20% of order book |
| UMA Oracle disputes | MEDIUM | Time stop exits trapped capital. Vault (V4) limits per-market exposure to 10% |
| Regulatory (CTA/CPO) | LOW for V1-V2 | Signal-only = analytics product. No custody, no execution |

## 9. COMPETITIVE ADVANTAGE

Already built:
1. Agent Radar with bot detection (feeds attribute #10)
2. Holder scanner for top 100 holders per market
3. Position viewer showing what each wallet is buying
4. Event price charts with Recharts
5. Supabase + Vercel infrastructure in production
6. LATAM DeFi audience (no Spanish-language competitor exists)

What remains to build:
- Scoring engine (Python worker)
- Consensus algorithm (Node.js)
- Signal dashboard (React, extends existing UI)
- Backtesting framework (Python, local)

Estimated total: the detection and analysis layer is ~60% done.
