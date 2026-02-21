# BetWhisper

Your AI assistant for prediction markets. Ask about any market, get whale intelligence, and execute bets on Polymarket CLOB through voice or text.

**Built at Monad Blitz CDMX 2026**

## What it does

BetWhisper is a conversational AI that sits between you and Polymarket. Instead of browsing dashboards, you talk to your named assistant and it handles everything:

1. **Search markets** by topic (politics, sports, crypto, entertainment)
2. **Agent Radar** scans token holders to detect bots and classify wallet strategies (accumulator, flipper, whale, sniper)
3. **AI Explanation** breaks down the market data into a clear thesis with confidence signals
4. **Execute bets** on Polymarket CLOB with fill-or-kill execution and slippage protection
5. **Group Drafts** create groups with friends, compete on P&L, and unlock AI features together

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
  Signal hash → Monad
```

### Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS
- **iOS**: SwiftUI, SFSpeechRecognizer, Meta Wearables SDK
- **AI**: Gemini Live (voice), Claude (market analysis)
- **Execution**: Polymarket CLOB API (real orderbook execution)
- **On-chain**: Monad (signal hash recording, chain ID 143)
- **Database**: Neon Postgres (serverless, groups/leaderboard)
- **Hosting**: Vercel (betwhisper.ai)

## Group Drafts

Social betting with two modes:

**Leaderboard**: Free competition. Each member picks their own markets. Ranked by total P&L.

**Draft Pool**: Creator picks one market. Everyone bets the same question. Pure conviction test.

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

## Agent Radar

Scans up to 196 token holder wallets and classifies each one:

- **12 on-chain attributes** analyzed per wallet
- **7 behavioral signals** for bot detection
- Strategy classification: accumulator, flipper, whale, sniper, mixed, human
- Smart money direction indicator (which side are the whales on?)

Results feed into the AI explanation and win probability calculation.

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

Open `ios/VoiceSwap.xcodeproj` in Xcode 16+ and run on simulator or device.

### Environment variables

```
POSTGRES_URL=            # Neon Postgres connection string
ANTHROPIC_API_KEY=       # Claude API for market explanations
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=  # WalletConnect v2
```

## Team

Built by Anthony Chavez at Monad Blitz CDMX, February 2026.

## License

MIT
