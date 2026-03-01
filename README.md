# BetWhisper

A self-custodial AI agent for prediction markets with privacy by default. Trade on Polymarket through natural language — via web chat, iOS app, or voice on Meta Ray-Ban glasses. Every trade goes through a ZK privacy pool: deposits are shielded, transfers are unlinkable, and positions are provably private.

Polymarket tells you the price. BetWhisper tells you if people actually believe it.

**Live:** [betwhisper.ai](https://betwhisper.ai)

---

## v0.2 — Foundry NYC (March 2026) · Privacy Release

Built at Unlink Privacy Hackathon, Foundry NYC.

### What's new

**ZK Privacy Pool (Unlink SDK)**
- Client-side ZK proofs via Unlink on Monad Testnet
- USDC deposits into a shielded pool → unlinkable private transfers to the server
- Server verifies received notes via `getNotes()` without knowing sender identity
- Two execution paths: Unlink (USDC/ZK) or Direct (MON), auto-detected per session

**Social Pulse Map**
- Real-time heatmap of trading activity on Mapbox GL
- GPS-fuzzed by ~80m server-side (never stores exact location)
- Clickable points colored by side (green = YES, red = NO, purple = ZK)
- Compass/recenter button and trade info popups
- Twitch-style live overlay showing truncated wallets during demo

**Probability Intelligence**
- AI-powered YES/NO recommendation with expandable explanation (info icon)
- Kelly Criterion smart money sizing from Agent Radar signal
- Manual override: both YES and NO buttons always visible
- Smart wallet consensus from 29+ tracked wallets

**Protocol Architecture**
- 3-layer design: Monad (settlement) → Unlink (privacy) → Social (conviction)
- SSE broadcast for real-time trade propagation to all connected clients
- Server-side Unlink wallet with mnemonic recovery for note verification

### Privacy flow

```
User deposits USDC → Unlink Privacy Pool (Monad Testnet)
        |
   ZK proof generated (client-side)
        |
   Private transfer to server's Unlink wallet
        |
   Server verifies via getNotes() (unlinkable)
        |
   CLOB order executed on Polymarket (Polygon)
        |
   Position confirmed — no link between deposit and trade
```

### New endpoints (v0.2)

```
GET  /api/pulse/stream          SSE stream for real-time heatmap updates
GET  /api/pulse/heatmap         Geo-tagged trade points (fuzzed)
GET  /api/unlink/address        Server's Unlink bech32 address
GET  /api/unlink/status         Unlink wallet sync status
POST /api/market/deep-analyze   Deep analysis with Agent Radar + probability
POST /api/market/explain        AI explanation of market thesis
```

---

## v0.1 — Monad Blitz CDMX (February 21, 2026)

Built at Monad Blitz CDMX hackathon. The foundation: cross-chain execution, voice trading, and social features.

### Core features

**Conversational AI Trading**
- Search any market by topic (F1, NBA, Liga MX, crypto, politics)
- AI explanation with confidence signals from whale wallets
- Cross-chain execution: pay MON on Monad → execute on Polymarket CLOB
- Portfolio tracking with live P&L, sell positions with MON cashout

**Agent Radar**
- Scans up to 196 token holder wallets per market
- 12 on-chain attributes analyzed, 7 behavioral signals for bot detection
- Strategy classification: accumulator, flipper, whale, sniper, mixed, human
- Smart money direction feeds into AI recommendation

**Voice & Wearables**
- iOS app with Gemini 2.5 Flash native audio
- Meta Ray-Ban smart glasses with voice-first trading
- On-device speech recognition, auto-confirm 3s after intent

**Group Trading**
- Create groups with QR invite codes (format: `BW-XXXXXX`)
- Leaderboard mode: everyone picks markets, ranked by P&L
- Draft Pool mode: creator picks one market, pure conviction test
- AI Gate: invite 1 friend to unlock "Explain with AI"

**Bilingual**
- Full EN/ES/PT support across 80+ translation keys

### Cross-chain flow (v0.1)

```
User pays MON on Monad
        |
   Intent signal recorded (Monad tx)
        |
   CLOB order executed on Polymarket (Polygon tx)
        |
   Position tracked with dual tx hashes (MonadScan + PolygonScan)
        |
   Sell: proceeds auto-convert to MON on Monad
```

### API (v0.1)

```
POST /api/bet/execute           Execute trade (MON payment + CLOB)
POST /api/bet                   Record position
POST /api/bet/sell              Sell position + MON cashout
GET  /api/user/balance          Portfolio with live prices
GET  /api/user/history          Transaction history
GET  /api/markets               Search markets (smart tag matching)
POST /api/groups                Create a group
GET  /api/groups/[code]         Group detail + members
POST /api/groups/[code]/join    Join by invite code
GET  /api/groups/[code]/leaderboard  P&L rankings
```

---

## Architecture

```
User (web chat / iOS voice / Meta Ray-Ban glasses)
        |
   BetWhisper AI (Gemini 2.5 Flash)
        |
   +--------+---------+----------+
   |        |         |          |
 Agent   Unlink     Polymarket  Social
 Radar   ZK Pool    CLOB        Pulse
   |        |         |          |
 29+      Client    Fill-or-    Real-time
 whale    side ZK    kill on     geo-tagged
 wallets  proofs    Polygon     heatmap
   |        |         |          |
   +--------+---------+----------+
                  |
        Monad (settlement + privacy)
        Polygon (CLOB execution)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS, Mapbox GL |
| iOS | SwiftUI, Gemini Live Audio, Meta Wearables DAT SDK |
| AI | Gemini 2.5 Flash (voice + analysis), Anthropic Claude (market context) |
| Privacy | Unlink SDK (`@unlink-xyz/react`, `@unlink-xyz/node`), ZK proofs, shielded USDC |
| Execution | Polymarket CLOB API (fill-or-kill on Polygon) |
| On-chain | Monad Testnet (privacy pool, chain 10143), Monad Mainnet (MON payments, chain 143) |
| Database | Neon Postgres (orders, positions, groups, pulse trades) |
| Real-time | Server-Sent Events (SSE) for Pulse Map broadcast |
| Auth | WalletConnect v2, 4-digit PIN (web), Face ID (iOS) |
| Hosting | Vercel ([betwhisper.ai](https://betwhisper.ai)) |

## How to run

### Web

```bash
git clone https://github.com/anthonysurfermx/Betwhisper.git
cd Betwhisper/web
npm install
cp .env.example .env.local  # Add your API keys
npm run dev
```

### iOS

Open `ios/` in Xcode 16+ and run on device (simulator doesn't support Gemini Live audio).

### Environment variables

```
POSTGRES_URL=                          # Neon Postgres
POLYGON_RPC_URL=                       # Polygon RPC for CLOB
POLYMARKET_PRIVATE_KEY=                # Server wallet (Polygon CLOB + Monad deposits)
POLY_API_KEY=                          # Polymarket CLOB API key
POLY_API_SECRET=                       # Polymarket CLOB API secret
POLY_PASSPHRASE=                       # Polymarket CLOB passphrase
UNLINK_SERVER_MNEMONIC=                # Server Unlink wallet mnemonic
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=  # WalletConnect v2
NEXT_PUBLIC_MAPBOX_TOKEN=              # Mapbox GL for Pulse Map
JWT_SECRET=                            # JWT signing secret
DEFILLAMA_API_KEY=                     # DeFi Llama Pro (MON price oracle)
```

## Team

Built by Anthony Chavez.

- **v0.1**: Monad Blitz CDMX, February 21, 2026
- **v0.2**: Unlink Privacy Hackathon, Foundry NYC, March 1-2, 2026

## License

MIT
