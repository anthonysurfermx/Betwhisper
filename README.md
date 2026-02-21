# BetWhisper

Your AI assistant for prediction markets. Ask about any market, get whale intelligence, and execute bets cross-chain: pay with MON on Monad, settle on Polymarket CLOB.

**Built at Monad Blitz CDMX 2026**

## What it does

BetWhisper is a conversational AI that sits between you and Polymarket. Instead of browsing dashboards, you talk to your named assistant and it handles everything:

1. **Search markets** by topic (F1, NBA, Liga MX, crypto, politics) with smart tag-based search
2. **Agent Radar** scans token holders to detect bots and classify wallet strategies
3. **AI Explanation** breaks down market data into a clear thesis with confidence signals
4. **Cross-chain execution**: pay with MON on Monad, execute on Polymarket CLOB, cash out back to MON
5. **Portfolio + Sell**: live P&L tracking, sell positions with proceeds auto-converted to MON
6. **Transaction history**: dual explorer links (MonadScan + PolygonScan) for every trade
7. **Group Drafts**: create groups with friends, share QR invite codes, compete on P&L
8. **AI Gate**: invite 1 friend to unlock "Explain with AI" (drives organic growth)

## Cross-Chain Flow

```
User pays MON on Monad
        |
  Intent signal recorded (Monad tx)
        |
  CLOB order executed on Polymarket (Polygon tx)
        |
  Position tracked with dual tx hashes
        |
  Sell: proceeds auto-convert to MON on Monad
```

Every trade produces two transaction hashes: one on Monad (intent/payment) and one on Polygon (CLOB execution).

## Channels

| Channel | Status | How it works |
|---------|--------|-------------|
| Text chat | Live | Type in the web app or iOS app |
| Voice message | Live | Hold to record, Gemini Live processes speech |
| Smart glasses | Live | Meta Ray-Ban with SFSpeechRecognizer on-device transcription |

## Architecture

```
User (text / voice / glasses)
        |
   BetWhisper AI
        |
   +----+----+
   |         |
Agent     Polymarket
Radar       CLOB
   |         |
 29 whale   Fill-or-kill
 wallets    execution
   |         |
   +----+----+
        |
  Monad (intent + cashout)
  Polygon (CLOB execution)
```

### Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS
- **iOS**: SwiftUI, SFSpeechRecognizer, Meta Wearables SDK, Face ID
- **AI**: Gemini Live (voice), Google AI (market analysis)
- **Execution**: Polymarket CLOB API (fill-or-kill on Polygon)
- **On-chain**: Monad (intent layer, MON payments, chain ID 143)
- **Database**: Neon Postgres (positions, orders, groups, leaderboards)
- **Auth**: 4-digit PIN (web), Face ID (iOS), JWT tokens
- **Hosting**: Vercel (betwhisper.ai)

## Group Drafts

Social betting with two modes:

**Leaderboard**: Free competition. Each member picks their own markets. Ranked by total P&L.

**Draft Pool**: Creator picks one market. Everyone bets the same question. Pure conviction test.

### QR Invite Flow

1. Creator makes a group and sees a QR code with invite link
2. Friend scans QR with phone, opens betwhisper.ai/predict?join=CODE
3. Friend connects wallet, auto-joins the group
4. Creator's AI features unlock automatically (polling detects new member)
5. Toast notification: "AI UNLOCKED"

### AI Gate
"Explain with AI" is locked until you create a group and invite at least 1 friend. This drives organic growth through the invite code system (format: `BW-XXXXXX`).

### API

```
POST /api/groups              Create a group
GET  /api/groups?wallet=      List my groups
GET  /api/groups/[code]       Group detail + members
POST /api/groups/[code]/join  Join by invite code
GET  /api/groups/[code]/leaderboard  P&L rankings
GET  /api/groups/check?wallet=       AI Gate eligibility
```

## Betting API

```
POST /api/bet/execute         Execute bet (MON payment + CLOB)
POST /api/bet                 Record position
POST /api/bet/sell            Sell position + MON cashout
GET  /api/user/balance        Portfolio with live prices
GET  /api/user/history        Transaction history
POST /api/user/pin/setup      Set 4-digit PIN
POST /api/user/pin/verify     Verify PIN (returns JWT)
```

## Agent Radar

Scans up to 196 token holder wallets and classifies each one:

- **12 on-chain attributes** analyzed per wallet
- **7 behavioral signals** for bot detection
- Strategy classification: accumulator, flipper, whale, sniper, mixed, human
- Smart money direction indicator (which side are the whales on?)

Results feed into the AI explanation and win probability calculation.

## Smart Market Search

Three-tier search system:
1. **Sports tags**: F1, NBA, Liga MX, UFC, tennis, esports mapped to Gamma API tag_slug
2. **Team detection**: "Pumas", "Lakers", "Real Madrid" resolve to league + local filtering
3. **General search**: fetch top 200 events by volume, score locally with word matching

Fixes Gamma API's broken title search which returns garbage for short queries.

## Bilingual

Full EN/ES/PT support across all UI components. 80+ translation keys covering chat messages, error states, PIN flow, groups, Agent Radar labels, and transaction status.

## How to run

### Web

```bash
git clone https://github.com/anthonysurfermx/Betwhisper.git
cd Betwhisper
npm install
cp .env.example .env.local  # Add your API keys
npm run dev
```

### iOS

Open the iOS project in Xcode 16+ and run on simulator or device.

### Environment variables

```
POSTGRES_URL=            # Neon Postgres connection string
POLYGON_RPC_URL=         # Polygon RPC for CLOB execution
POLY_API_KEY=            # Polymarket CLOB API key
POLY_API_SECRET=         # Polymarket CLOB API secret
POLY_PASSPHRASE=         # Polymarket CLOB passphrase
WALLET_PRIVATE_KEY=      # Server wallet for CLOB execution
MONAD_PRIVATE_KEY=       # Server wallet for MON transfers
JWT_SECRET=              # JWT signing secret for PIN auth
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=  # WalletConnect v2
```

## Team

Built by Anthony Chavez at Monad Blitz CDMX, February 2026.

## License

MIT
