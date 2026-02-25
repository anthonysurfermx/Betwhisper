#!/usr/bin/env python3
"""
Wallet Basket Consensus Backtester
Phase 0: Validate the consensus model with historical Polymarket data.

Usage:
  1. pip install requests pandas numpy
  2. python backtest.py --seed-wallets     # Step 1: find wallets
  3. python backtest.py --pull-trades      # Step 2: pull trade history
  4. python backtest.py --score-wallets    # Step 3: calculate scores
  5. python backtest.py --run-backtest     # Step 4: simulate consensus
  6. python backtest.py --full-pipeline    # Run all steps

Data is stored in ./backtest_data/ as JSON and CSV files.
"""

import argparse
import json
import math
import os
import sys
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import requests

# ── Config ──────────────────────────────────────────────────────────

DATA_DIR = Path(__file__).parent / "backtest_data"
DATA_DIR.mkdir(exist_ok=True)

DATA_API = "https://data-api.polymarket.com"
GAMMA_API = "https://gamma-api.polymarket.com"
CLOB_API = "https://clob.polymarket.com"

# Rate limiting
REQUEST_DELAY = 0.15  # seconds between API calls

# Scoring weights (sum = 1.0)
SCORE_WEIGHTS = {
    "win_rate": 0.15,
    "roi": 0.15,
    "consistency": 0.10,
    "volume": 0.05,
    "experience": 0.05,
    "timing_edge": 0.10,
    "specialization": 0.05,
    "risk_stability": 0.10,
    "exit_quality": 0.10,
    "bot_score_inv": 0.05,
    "recency": 0.05,
    "capacity": 0.05,
}

# Consensus parameters to test
CONSENSUS_THRESHOLDS = [0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90]
MIN_QUORUM = 3
TIME_DECAY_HALF_LIFE_HOURS = 24

# Exit parameters
TAKE_PROFIT_PCT = 0.40
STOP_LOSS_PCT = -0.25
TIME_STOP_ELAPSED_PCT = 0.80
TIME_STOP_MIN_MOVE = 0.05


# ── API Helpers ─────────────────────────────────────────────────────

def api_get(url, params=None, retries=3):
    """GET with retry and rate limiting."""
    for attempt in range(retries):
        try:
            time.sleep(REQUEST_DELAY)
            resp = requests.get(url, params=params, timeout=30)
            if resp.status_code == 429:
                wait = 2 ** attempt * 5
                print(f"  Rate limited, waiting {wait}s...")
                time.sleep(wait)
                continue
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.RequestException as e:
            if attempt == retries - 1:
                print(f"  API error after {retries} retries: {e}")
                return None
            time.sleep(2 ** attempt)
    return None


# ── Step 1: Seed Wallets ────────────────────────────────────────────

def get_top_markets(limit=20):
    """Get the most active markets (resolved + active) from Gamma API."""
    print(f"Fetching top {limit} high-volume markets...")
    markets = []

    # Resolved high-volume markets (for backtesting)
    resolved = api_get(f"{GAMMA_API}/markets", params={
        "closed": "true",
        "limit": str(limit),
        "order": "volume",
        "ascending": "false",
        "volume_num_min": "100000",  # $100K+ volume only
    })
    if resolved:
        markets.extend(resolved)
        print(f"  Got {len(resolved)} resolved high-volume markets")

    # Active high-volume markets
    active = api_get(f"{GAMMA_API}/markets", params={
        "active": "true",
        "limit": str(limit // 2),
        "order": "volume",
        "ascending": "false",
        "volume_num_min": "500000",  # $500K+ volume
    })
    if active:
        markets.extend(active)
        print(f"  Got {len(active)} active high-volume markets")

    # Deduplicate by conditionId
    seen = set()
    unique = []
    for m in markets:
        cid = m.get("conditionId", "")
        if cid and cid not in seen:
            seen.add(cid)
            unique.append(m)

    return unique


def get_market_holders(condition_id, limit=100):
    """Get top holders for a specific market.
    Data API /holders returns nested structure:
    [{ token: "...", holders: [{ proxyWallet, amount, name, ... }] }]
    """
    data = api_get(f"{DATA_API}/holders", params={
        "market": condition_id,
        "limit": str(limit),
    })
    if not data:
        return []

    # Flatten the nested structure
    all_holders = []
    if isinstance(data, list):
        for token_group in data:
            if isinstance(token_group, dict) and "holders" in token_group:
                for holder in token_group["holders"]:
                    holder["_token"] = token_group.get("token", "")
                    all_holders.append(holder)
            elif isinstance(token_group, dict) and "proxyWallet" in token_group:
                # Sometimes returns flat list
                all_holders.append(token_group)

    return all_holders


def seed_wallets():
    """Step 1: Find seed wallets from top markets."""
    print("\n=== STEP 1: SEED WALLETS ===\n")

    markets = get_top_markets(200)
    if not markets:
        print("ERROR: Could not fetch markets")
        return

    # Save markets
    markets_file = DATA_DIR / "markets.json"
    with open(markets_file, "w") as f:
        json.dump(markets, f, indent=2)
    print(f"Saved {len(markets)} markets to {markets_file}")

    # Collect unique wallets from top holders
    all_wallets = {}
    for i, market in enumerate(markets):
        cid = market.get("conditionId") or market.get("condition_id")
        question = market.get("question", "Unknown")[:60]
        if not cid:
            continue

        print(f"  [{i+1}/{len(markets)}] Scanning holders: {question}...")
        holders = get_market_holders(cid)
        print(f"    -> {len(holders)} holders found")

        for holder in holders:
            addr = holder.get("proxyWallet") or holder.get("address") or holder.get("user")
            if not addr:
                continue
            if addr not in all_wallets:
                all_wallets[addr] = {
                    "address": addr,
                    "pseudonym": holder.get("name") or holder.get("pseudonym") or "",
                    "markets_seen_in": [],
                    "total_value_seen": 0,
                }
            all_wallets[addr]["markets_seen_in"].append(cid)
            val = float(holder.get("amount", 0) or holder.get("value", 0) or 0)
            all_wallets[addr]["total_value_seen"] += val

    # Sort by number of markets (more diverse = more interesting)
    wallets_list = sorted(
        all_wallets.values(),
        key=lambda w: (len(w["markets_seen_in"]), w["total_value_seen"]),
        reverse=True,
    )

    # Take top 200
    wallets_list = wallets_list[:200]

    wallets_file = DATA_DIR / "seed_wallets.json"
    with open(wallets_file, "w") as f:
        json.dump(wallets_list, f, indent=2)

    print(f"\nFound {len(all_wallets)} unique wallets, saved top {len(wallets_list)} to {wallets_file}")
    print(f"Top 10 wallets by diversity:")
    for w in wallets_list[:10]:
        print(f"  {w['address'][:12]}... | {w['pseudonym'][:20]:20s} | {len(w['markets_seen_in'])} markets | ${w['total_value_seen']:,.0f}")


# ── Step 2: Pull Trade History ──────────────────────────────────────

def pull_wallet_trades(address, months_back=6):
    """Pull all trades for a wallet from Data API."""
    start_ts = int((datetime.now(timezone.utc) - timedelta(days=months_back * 30)).timestamp())
    all_trades = []
    offset = 0
    limit = 500

    while True:
        data = api_get(f"{DATA_API}/activity", params={
            "user": address,
            "type": "TRADE",
            "limit": str(limit),
            "offset": str(offset),
            "sortBy": "TIMESTAMP",
            "sortDirection": "ASC",
            "start": str(start_ts),
        })

        if not data or len(data) == 0:
            break

        all_trades.extend(data)
        offset += limit

        if len(data) < limit:
            break

        # Safety: max 5000 trades per wallet
        if offset >= 5000:
            break

    return all_trades


def pull_trades():
    """Step 2: Pull trade history for all seed wallets."""
    print("\n=== STEP 2: PULL TRADE HISTORY ===\n")

    wallets_file = DATA_DIR / "seed_wallets.json"
    if not wallets_file.exists():
        print("ERROR: Run --seed-wallets first")
        return

    with open(wallets_file) as f:
        wallets = json.load(f)

    trades_dir = DATA_DIR / "trades"
    trades_dir.mkdir(exist_ok=True)

    total = len(wallets)
    for i, wallet in enumerate(wallets):
        addr = wallet["address"]
        trade_file = trades_dir / f"{addr}.json"

        # Skip if already fetched
        if trade_file.exists():
            print(f"  [{i+1}/{total}] SKIP {addr[:10]}... (cached)")
            continue

        print(f"  [{i+1}/{total}] Pulling trades for {addr[:10]}...")
        trades = pull_wallet_trades(addr)

        with open(trade_file, "w") as f:
            json.dump(trades, f)

        print(f"    -> {len(trades)} trades")

    print(f"\nDone. Trade data saved in {trades_dir}/")


# ── Step 3: Score Wallets ───────────────────────────────────────────

def load_wallet_trades(address):
    """Load cached trades for a wallet."""
    trade_file = DATA_DIR / "trades" / f"{address}.json"
    if not trade_file.exists():
        return []
    with open(trade_file) as f:
        return json.load(f)


def calculate_wallet_score(wallet, trades):
    """Calculate the 12-attribute score for a wallet."""
    if len(trades) < 10:
        return None  # Not enough data

    scores = {}

    # Parse trades into structured data
    positions = defaultdict(list)
    for t in trades:
        cid = t.get("conditionId", "")
        positions[cid].append({
            "side": t.get("side", ""),
            "price": float(t.get("price", 0) or 0),
            "size": float(t.get("size", 0) or 0),
            "usdc": float(t.get("usdcSize", 0) or 0),
            "timestamp": int(t.get("timestamp", 0) or 0),
            "outcome": t.get("outcome", ""),
            "slug": t.get("slug", ""),
        })

    # Position sizes for conviction baseline
    all_sizes = [float(t.get("usdcSize", 0) or 0) for t in trades if float(t.get("usdcSize", 0) or 0) > 0]
    if not all_sizes:
        return None
    median_size = float(np.median(all_sizes))

    # 1. Win Rate: estimate from buy/sell patterns
    # (simplified: count positions where last trade was SELL at higher price than avg BUY)
    wins = 0
    total_closed = 0
    for cid, pos_trades in positions.items():
        buys = [t for t in pos_trades if t["side"] == "BUY"]
        sells = [t for t in pos_trades if t["side"] == "SELL"]
        if buys and sells:
            avg_buy = np.mean([t["price"] for t in buys])
            avg_sell = np.mean([t["price"] for t in sells])
            total_closed += 1
            if avg_sell > avg_buy:
                wins += 1

    scores["win_rate"] = (wins / total_closed * 100) if total_closed > 0 else 50

    # 2. ROI: total P&L / total invested
    total_bought = sum(float(t.get("usdcSize", 0) or 0) for t in trades if t.get("side") == "BUY")
    total_sold = sum(float(t.get("usdcSize", 0) or 0) for t in trades if t.get("side") == "SELL")
    roi = ((total_sold - total_bought) / total_bought * 100) if total_bought > 0 else 0
    scores["roi"] = min(max(roi + 50, 0), 100)  # normalize: -50% -> 0, 0% -> 50, +50% -> 100

    # 3. Consistency: std of per-position returns (lower = better)
    position_returns = []
    for cid, pos_trades in positions.items():
        buys = [t for t in pos_trades if t["side"] == "BUY"]
        sells = [t for t in pos_trades if t["side"] == "SELL"]
        if buys and sells:
            avg_buy = np.mean([t["price"] for t in buys])
            avg_sell = np.mean([t["price"] for t in sells])
            ret = (avg_sell - avg_buy) / avg_buy if avg_buy > 0 else 0
            position_returns.append(ret)

    if position_returns:
        std = np.std(position_returns)
        scores["consistency"] = max(0, 100 - std * 200)  # lower std = higher score
    else:
        scores["consistency"] = 50

    # 4. Volume: log scale
    scores["volume"] = min(np.log10(max(total_bought, 1)) / 6 * 100, 100)  # $1M = 100

    # 5. Experience: number of unique markets
    unique_markets = len(positions)
    scores["experience"] = min(unique_markets / 50 * 100, 100)  # 50 markets = 100

    # 6. Timing Edge: simplified (avg first-trade return in position)
    first_returns = []
    for cid, pos_trades in positions.items():
        sorted_trades = sorted(pos_trades, key=lambda t: t["timestamp"])
        if len(sorted_trades) >= 2:
            first_price = sorted_trades[0]["price"]
            # Compare to last trade price
            last_price = sorted_trades[-1]["price"]
            if first_price > 0:
                first_returns.append((last_price - first_price) / first_price)

    if first_returns:
        avg_timing = np.mean(first_returns)
        scores["timing_edge"] = min(max(avg_timing * 200 + 50, 0), 100)
    else:
        scores["timing_edge"] = 50

    # 7. Specialization: concentration in categories
    slugs = [t.get("slug", "") for t in trades if t.get("slug")]
    # Simple heuristic: count unique slug prefixes
    if slugs:
        unique_slugs = len(set(slugs))
        concentration = len(trades) / max(unique_slugs, 1)
        scores["specialization"] = min(concentration / 20 * 100, 100)
    else:
        scores["specialization"] = 50

    # 8. Risk Stability: CV of position sizes
    if len(all_sizes) > 2:
        cv = np.std(all_sizes) / np.mean(all_sizes) if np.mean(all_sizes) > 0 else 1
        scores["risk_stability"] = max(0, 100 - cv * 50)
    else:
        scores["risk_stability"] = 50

    # 9. Exit Quality: % of closed positions with profit
    scores["exit_quality"] = scores["win_rate"]  # correlated with win rate for now

    # 10. Bot Score (inverse): placeholder (would come from Agent Radar)
    # For backtest, estimate based on timing patterns
    timestamps = [t["timestamp"] for t in trades if t.get("timestamp")]
    if len(timestamps) > 2:
        diffs = np.diff(sorted(timestamps))
        # Bots tend to have very regular intervals
        cv_timing = np.std(diffs) / np.mean(diffs) if np.mean(diffs) > 0 else 1
        scores["bot_score_inv"] = min(cv_timing * 50, 100)  # higher variance = more human
    else:
        scores["bot_score_inv"] = 50

    # 11. Recency: weight recent performance
    now_ts = datetime.now(timezone.utc).timestamp()
    thirty_days_ago = now_ts - 30 * 86400
    recent_trades = [t for t in trades if (t.get("timestamp") or 0) > thirty_days_ago]
    scores["recency"] = min(len(recent_trades) / 20 * 100, 100)

    # 12. Capacity: simplified (does ROI drop with larger trades?)
    if len(all_sizes) > 10:
        sorted_by_size = sorted(zip(all_sizes, position_returns[:len(all_sizes)]),
                                key=lambda x: x[0]) if position_returns else []
        if len(sorted_by_size) > 4:
            small_half = [r for _, r in sorted_by_size[:len(sorted_by_size)//2]]
            large_half = [r for _, r in sorted_by_size[len(sorted_by_size)//2:]]
            if small_half and large_half:
                small_avg = np.mean(small_half)
                large_avg = np.mean(large_half)
                # If large trades perform worse, capacity is limited
                if small_avg > 0:
                    capacity_ratio = large_avg / small_avg
                    scores["capacity"] = min(max(capacity_ratio * 50, 0), 100)
                else:
                    scores["capacity"] = 50
            else:
                scores["capacity"] = 50
        else:
            scores["capacity"] = 50
    else:
        scores["capacity"] = 50

    # Calculate weighted total
    total_score = sum(scores[attr] * weight for attr, weight in SCORE_WEIGHTS.items())

    return {
        "address": wallet["address"],
        "pseudonym": wallet.get("pseudonym", ""),
        "overall_score": round(total_score, 1),
        "scores": {k: round(v, 1) for k, v in scores.items()},
        "total_trades": len(trades),
        "unique_markets": unique_markets,
        "median_position_size": round(median_size, 2),
        "total_volume": round(total_bought, 2),
    }


def score_wallets():
    """Step 3: Score all wallets."""
    print("\n=== STEP 3: SCORE WALLETS ===\n")

    wallets_file = DATA_DIR / "seed_wallets.json"
    if not wallets_file.exists():
        print("ERROR: Run --seed-wallets first")
        return

    with open(wallets_file) as f:
        wallets = json.load(f)

    scored = []
    for i, wallet in enumerate(wallets):
        trades = load_wallet_trades(wallet["address"])
        if not trades:
            continue

        score = calculate_wallet_score(wallet, trades)
        if score:
            scored.append(score)
            if (i + 1) % 10 == 0:
                print(f"  Scored {i+1}/{len(wallets)} wallets...")

    # Sort by score
    scored.sort(key=lambda s: s["overall_score"], reverse=True)

    scores_file = DATA_DIR / "wallet_scores.json"
    with open(scores_file, "w") as f:
        json.dump(scored, f, indent=2)

    print(f"\nScored {len(scored)} wallets. Saved to {scores_file}")
    print(f"\nTop 10 wallets:")
    print(f"{'Score':>6} | {'Trades':>6} | {'Markets':>7} | {'Volume':>12} | {'Address'}")
    print("-" * 70)
    for s in scored[:10]:
        print(f"{s['overall_score']:6.1f} | {s['total_trades']:6d} | {s['unique_markets']:7d} | ${s['total_volume']:>10,.0f} | {s['address'][:16]}...")

    # Show score distribution
    all_scores = [s["overall_score"] for s in scored]
    print(f"\nScore distribution:")
    print(f"  Mean:   {np.mean(all_scores):.1f}")
    print(f"  Median: {np.median(all_scores):.1f}")
    print(f"  Std:    {np.std(all_scores):.1f}")
    print(f"  >= 60:  {sum(1 for s in all_scores if s >= 60)} wallets (basket eligible)")
    print(f"  >= 70:  {sum(1 for s in all_scores if s >= 70)} wallets")
    print(f"  >= 80:  {sum(1 for s in all_scores if s >= 80)} wallets")


# ── Step 4: Run Backtest ────────────────────────────────────────────

def build_timeline(wallets, trades_dir):
    """Build chronological timeline of all trades across all wallets."""
    timeline = []

    for wallet in wallets:
        addr = wallet["address"]
        trades = load_wallet_trades(addr)
        for t in trades:
            ts = t.get("timestamp")
            if not ts:
                continue
            timeline.append({
                "timestamp": int(ts),
                "address": addr,
                "conditionId": t.get("conditionId", ""),
                "side": t.get("side", ""),
                "price": float(t.get("price", 0) or 0),
                "usdc": float(t.get("usdcSize", 0) or 0),
                "size": float(t.get("size", 0) or 0),
                "outcome": t.get("outcome", ""),
                "slug": t.get("slug", ""),
                "title": t.get("title", ""),
            })

    timeline.sort(key=lambda t: t["timestamp"])
    return timeline


def evaluate_consensus_at(market_positions, wallet_scores, half_life_hours, now_ts):
    """Evaluate consensus for a specific market at a specific time."""
    if len(market_positions) < MIN_QUORUM:
        return None

    lam = math.log(2) / half_life_hours
    yes_weight = 0
    no_weight = 0
    wallets_yes = 0
    wallets_no = 0

    for pos in market_positions:
        addr = pos["address"]
        score_data = wallet_scores.get(addr)
        if not score_data or score_data["overall_score"] < 60:
            continue

        wallet_weight = score_data["overall_score"] / 100

        # Conviction: size relative to median
        median = score_data.get("median_position_size", 100)
        conviction = min(pos["usdc"] / max(median, 1), 3.0)

        # Time decay
        hours_ago = (now_ts - pos["timestamp"]) / 3600
        if hours_ago < 0:
            continue
        time_weight = math.exp(-lam * hours_ago)

        weighted = wallet_weight * conviction * time_weight

        if pos["side"] == "BUY":
            yes_weight += weighted
            wallets_yes += 1
        else:
            no_weight += weighted
            wallets_no += 1

    total = yes_weight + no_weight
    if total == 0:
        return None

    consensus_pct = max(yes_weight, no_weight) / total
    direction = "YES" if yes_weight > no_weight else "NO"
    agreeing = wallets_yes if direction == "YES" else wallets_no

    if agreeing < MIN_QUORUM:
        return None

    return {
        "consensus_pct": consensus_pct,
        "direction": direction,
        "wallets_agreeing": agreeing,
        "wallets_total": wallets_yes + wallets_no,
        "yes_weight": yes_weight,
        "no_weight": no_weight,
    }


def run_backtest():
    """Step 4: Simulate the consensus strategy."""
    print("\n=== STEP 4: RUN BACKTEST ===\n")

    # Load scores
    scores_file = DATA_DIR / "wallet_scores.json"
    if not scores_file.exists():
        print("ERROR: Run --score-wallets first")
        return

    with open(scores_file) as f:
        scored = json.load(f)

    wallet_scores = {s["address"]: s for s in scored}

    # Filter eligible wallets (score >= 60)
    eligible = [s for s in scored if s["overall_score"] >= 60]
    print(f"Eligible wallets (score >= 60): {len(eligible)}")

    # Load markets for resolution data
    # First try the comprehensive resolved_markets.json
    resolved_file = DATA_DIR / "resolved_markets.json"
    if resolved_file.exists():
        with open(resolved_file) as f:
            market_resolution = json.load(f)
        print(f"Loaded {len(market_resolution)} resolved market outcomes")
    else:
        # Fallback to markets.json
        markets_file = DATA_DIR / "markets.json"
        if markets_file.exists():
            with open(markets_file) as f:
                markets = json.load(f)
            market_resolution = {}
            for m in markets:
                cid = m.get("conditionId") or m.get("condition_id")
                if cid and m.get("closed"):
                    prices = m.get("outcomePrices", "")
                    if isinstance(prices, str):
                        try:
                            prices = json.loads(prices)
                        except (json.JSONDecodeError, TypeError):
                            prices = []
                    if prices and len(prices) >= 2:
                        yes_price = float(prices[0])
                        market_resolution[cid] = "YES" if yes_price > 0.5 else "NO"
        else:
            market_resolution = {}
            print("WARNING: No markets data. Cannot verify outcomes.")

    # Build timeline
    wallets_file = DATA_DIR / "seed_wallets.json"
    with open(wallets_file) as f:
        wallets = json.load(f)

    print("Building trade timeline...")
    timeline = build_timeline(wallets, DATA_DIR / "trades")
    print(f"Timeline: {len(timeline)} trades")

    if not timeline:
        print("ERROR: No trades found")
        return

    # Sliding window: track active positions per market
    # Window size varies by threshold test
    results_by_threshold = {}

    for threshold in CONSENSUS_THRESHOLDS:
        print(f"\n--- Testing threshold: {threshold:.0%} ---")

        # State: active positions per market
        active_positions = defaultdict(list)  # conditionId -> [positions]
        signals = []
        signal_markets = set()

        # Process timeline with sliding window
        window_seconds = TIME_DECAY_HALF_LIFE_HOURS * 3600 * 4  # 4 half-lives

        for trade in timeline:
            cid = trade["conditionId"]
            if not cid:
                continue

            # Add to active positions
            active_positions[cid].append(trade)

            # Prune old positions (beyond 4 half-lives)
            active_positions[cid] = [
                p for p in active_positions[cid]
                if trade["timestamp"] - p["timestamp"] < window_seconds
            ]

            # Check consensus for this market
            if len(active_positions[cid]) >= MIN_QUORUM:
                consensus = evaluate_consensus_at(
                    active_positions[cid],
                    wallet_scores,
                    TIME_DECAY_HALF_LIFE_HOURS,
                    trade["timestamp"],
                )

                if consensus and consensus["consensus_pct"] >= threshold:
                    signal_key = f"{cid}_{consensus['direction']}"
                    if signal_key not in signal_markets:
                        signal_markets.add(signal_key)

                        # Record signal
                        signal = {
                            "timestamp": trade["timestamp"],
                            "conditionId": cid,
                            "slug": trade.get("slug", ""),
                            "title": trade.get("title", ""),
                            "direction": consensus["direction"],
                            "consensus_pct": round(consensus["consensus_pct"], 3),
                            "wallets_agreeing": consensus["wallets_agreeing"],
                            "wallets_total": consensus["wallets_total"],
                            "entry_price": trade["price"],
                        }

                        # Check resolution
                        actual_outcome = market_resolution.get(cid)
                        if actual_outcome:
                            signal["actual_outcome"] = actual_outcome
                            signal["correct"] = (consensus["direction"] == actual_outcome)
                        else:
                            signal["actual_outcome"] = None
                            signal["correct"] = None

                        signals.append(signal)

        # Calculate results
        verified = [s for s in signals if s["correct"] is not None]
        correct = [s for s in verified if s["correct"]]

        results = {
            "threshold": threshold,
            "total_signals": len(signals),
            "verified_signals": len(verified),
            "correct_signals": len(correct),
            "accuracy": len(correct) / len(verified) if verified else 0,
            "avg_consensus": np.mean([s["consensus_pct"] for s in signals]) if signals else 0,
            "avg_wallets": np.mean([s["wallets_agreeing"] for s in signals]) if signals else 0,
        }

        results_by_threshold[threshold] = results

        print(f"  Signals: {results['total_signals']}")
        print(f"  Verified: {results['verified_signals']}")
        print(f"  Correct: {results['correct_signals']}")
        print(f"  Accuracy: {results['accuracy']:.1%}")
        print(f"  Avg consensus: {results['avg_consensus']:.1%}")
        print(f"  Avg wallets: {results['avg_wallets']:.1f}")

    # Save all results
    results_file = DATA_DIR / "backtest_results.json"
    with open(results_file, "w") as f:
        json.dump({
            "run_date": datetime.now(timezone.utc).isoformat(),
            "total_wallets_scored": len(scored),
            "eligible_wallets": len(eligible),
            "total_trades_in_timeline": len(timeline),
            "results_by_threshold": {
                str(k): v for k, v in results_by_threshold.items()
            },
        }, f, indent=2)

    # Summary table
    print(f"\n{'='*60}")
    print(f"BACKTEST SUMMARY")
    print(f"{'='*60}")
    print(f"{'Threshold':>10} | {'Signals':>8} | {'Verified':>9} | {'Correct':>8} | {'Accuracy':>9}")
    print(f"{'-'*10}-+-{'-'*8}-+-{'-'*9}-+-{'-'*8}-+-{'-'*9}")
    for threshold in CONSENSUS_THRESHOLDS:
        r = results_by_threshold[threshold]
        print(f"{threshold:>9.0%} | {r['total_signals']:>8} | {r['verified_signals']:>9} | {r['correct_signals']:>8} | {r['accuracy']:>8.1%}")

    print(f"\nResults saved to {results_file}")

    # Key insight
    best = max(results_by_threshold.values(), key=lambda r: r["accuracy"] if r["verified_signals"] > 5 else 0)
    print(f"\nBest threshold: {best['threshold']:.0%} with {best['accuracy']:.1%} accuracy on {best['verified_signals']} verified signals")


# ── Main ────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Wallet Basket Consensus Backtester")
    parser.add_argument("--seed-wallets", action="store_true", help="Step 1: Find seed wallets")
    parser.add_argument("--pull-trades", action="store_true", help="Step 2: Pull trade history")
    parser.add_argument("--score-wallets", action="store_true", help="Step 3: Score wallets")
    parser.add_argument("--run-backtest", action="store_true", help="Step 4: Run backtest")
    parser.add_argument("--full-pipeline", action="store_true", help="Run all steps")

    args = parser.parse_args()

    if args.full_pipeline:
        seed_wallets()
        pull_trades()
        score_wallets()
        run_backtest()
    elif args.seed_wallets:
        seed_wallets()
    elif args.pull_trades:
        pull_trades()
    elif args.score_wallets:
        score_wallets()
    elif args.run_backtest:
        run_backtest()
    else:
        parser.print_help()
        print("\nExample: python backtest.py --full-pipeline")


if __name__ == "__main__":
    main()
