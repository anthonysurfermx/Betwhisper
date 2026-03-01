# BetWhisper

A self-custodial AI agent for prediction markets with privacy by default. Trade on Polymarket through natural language — via web chat, iOS app, or voice on Meta Ray-Ban glasses. Every trade goes through a ZK privacy pool: deposits are shielded, transfers are unlinkable, and positions are provably private.

Polymarket tells you the price. BetWhisper tells you if people actually believe it.

**Live:** [betwhisper.ai](https://betwhisper.ai)

---

## What it does

BetWhisper is a conversational AI that sits between you and Polymarket. Instead of browsing dashboards, you talk to your AI agent and it handles everything — from market research to private execution.

### Privacy (Unlink SDK)

- Client-side ZK proofs via Unlink on Monad Testnet
- USDC deposits into a shielded pool → unlinkable private transfers to the server
- Server verifies received notes via `getNotes()` without knowing sender identity
- Two execution paths: Unlink (USDC/ZK) or Direct (MON), auto-detected per session

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

### AI Agent

- Search any market by topic (F1, NBA, politics, crypto)
- AI-powered YES/NO recommendation with expandable explanation
- Kelly Criterion smart money sizing from Agent Radar signal
- Agent Radar: scans 196 token holder wallets, 12 on-chain attributes, bot detection

### Social Pulse Map

- Real-time heatmap of trading activity on Mapbox GL
- GPS-fuzzed by ~80m server-side (never stores exact location)
- Clickable points colored by side (green = YES, red = NO, purple = ZK)
- Live overlay showing truncated wallets in real-time

### Voice & Wearables

- iOS app with Gemini 2.5 Flash native audio
- Meta Ray-Ban smart glasses with voice-first trading
- On-device speech recognition, auto-confirm 3s after intent

### Group Trading

- Create groups with QR invite codes (format: `BW-XXXXXX`)
- Leaderboard and Draft Pool modes
- AI Gate: invite 1 friend to unlock "Explain with AI"

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

[View full interactive architecture diagram →](https://betwhisper.ai/architecture.html)

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

## API

```
POST /api/bet/execute           Execute trade (payment + CLOB)
POST /api/bet/sell              Sell position + cashout
GET  /api/user/balance          Portfolio with live prices
GET  /api/user/history          Transaction history
GET  /api/markets               Search markets
GET  /api/pulse/stream          SSE stream for real-time heatmap
GET  /api/pulse/heatmap         Geo-tagged trade points
GET  /api/unlink/address        Server's Unlink bech32 address
POST /api/market/deep-analyze   Deep analysis with Agent Radar
POST /api/groups                Create a group
POST /api/groups/[code]/join    Join by invite code
GET  /api/groups/[code]/leaderboard  P&L rankings
```

## How to run

```bash
git clone https://github.com/anthonysurfermx/Betwhisper.git
cd Betwhisper/web
npm install
cp .env.example .env.local  # Add your API keys
npm run dev
```

iOS: Open `ios/` in Xcode 16+ and run on device.

## Team

Built by Anthony Chavez.

- **v0.1** — Monad Blitz CDMX, February 21, 2026
- **v0.2** — Ship Private, Ship Fast Hackathon (Unlink), March 1-2, 2026

## License

MIT
