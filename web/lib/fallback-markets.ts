// Pre-cached market data for demo safety
// If Polymarket API is down during the hackathon demo, serve these
// Last updated: 2026-02-19
// Includes: trending markets + markets where tracked whales have active positions

import type { EventInfo, MarketInfo } from './polymarket'

// Markets where our tracked whales have confirmed active positions
// Best for demo: shows whale analysis panel with real data
export interface CachedWhaleMarket {
  conditionId: string
  question: string
  slug: string
  volume: number
  yesPrice: number
  noPrice: number
  image: string
  endDate: string
  outcomes: string[]
  whaleCount: number
  whalePositions: {
    pseudonym: string
    score: number
    side: string
    size: number
  }[]
}

export const WHALE_MARKETS: CachedWhaleMarket[] = [
  {
    conditionId: '0xf232b565995e4b3a3e7fa6cef775eeff1cecd20ad7c013cb9fc8dadabfe279a9',
    question: 'Will Alexandria Ocasio-Cortez win the 2028 US Presidential Election?',
    slug: 'will-alexandria-ocasio-cortez-win-the-2028-us-presidential-election',
    volume: 2669222,
    yesPrice: 0.051,
    noPrice: 0.949,
    image: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/will-alexandria-ocasio-cortez-win-the-2028-us-presidential-election-eX2nG09sPJUu.png',
    endDate: '2028-11-07T00:00:00Z',
    outcomes: ['Yes', 'No'],
    whaleCount: 1,
    whalePositions: [
      { pseudonym: 'gandalf', score: 78.7, side: 'Yes', size: 20000 },
      { pseudonym: 'gandalf', score: 78.7, side: 'No', size: 10000 },
    ],
  },
  {
    conditionId: '0x23481b811978194fa175143ed7cd8d0000878ca59c408fd552e33535f7aa771e',
    question: 'Will Donald Trump Jr. win the 2028 US Presidential Election?',
    slug: 'will-donald-trump-jr-win-the-2028-us-presidential-election',
    volume: 5782671,
    yesPrice: 0.012,
    noPrice: 0.988,
    image: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/will-donald-trump-jr-win-the-2028-us-presidential-election-DyQTRbm48dfH.png',
    endDate: '2028-11-07T00:00:00Z',
    outcomes: ['Yes', 'No'],
    whaleCount: 1,
    whalePositions: [
      { pseudonym: 'gandalf', score: 78.7, side: 'Yes', size: 100000 },
    ],
  },
  {
    conditionId: '0x74dba1ce1ae9dd535414e85f2d9ab5ea32c0fb1acc9b7130b67e6d91217e24e1',
    question: 'Will Jon Ossoff win the 2028 Democratic presidential nomination?',
    slug: 'will-jon-ossoff-win-the-2028-democratic-presidential-nomination-885',
    volume: 4329172,
    yesPrice: 0.045,
    noPrice: 0.955,
    image: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/Jon_Ossoff.png',
    endDate: '2028-11-07T00:00:00Z',
    outcomes: ['Yes', 'No'],
    whaleCount: 1,
    whalePositions: [
      { pseudonym: 'gandalf', score: 78.7, side: 'Yes', size: 20000 },
    ],
  },
  {
    conditionId: '0xd65891729ce093cc12236856837eba1a0872fc7998fd4294c21346f7db68079c',
    question: 'Will Josh Shapiro win the 2028 Democratic presidential nomination?',
    slug: 'will-josh-shapiro-win-the-2028-democratic-presidential-nomination-977',
    volume: 4553582,
    yesPrice: 0.044,
    noPrice: 0.956,
    image: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/will-josh-shapiro-win-the-2028-us-presidential-election-h3nL-gpVkam1.png',
    endDate: '2028-11-07T00:00:00Z',
    outcomes: ['Yes', 'No'],
    whaleCount: 1,
    whalePositions: [
      { pseudonym: 'gandalf', score: 78.7, side: 'Yes', size: 20000 },
    ],
  },
  {
    conditionId: '0xc8f1cf5d4f26e0fd9c8fe89f2a7b3263b902cf14fde7bfccef525753bb492e47',
    question: 'Will Stephen A. Smith win the 2028 Democratic presidential nomination?',
    slug: 'will-stephen-a-smith-win-the-2028-democratic-presidential-nomination-914',
    volume: 9349364,
    yesPrice: 0.013,
    noPrice: 0.987,
    image: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/will-stephen-smith-win-the-2028-us-presidential-election-TLNFUsNkT8yf.png',
    endDate: '2028-11-07T00:00:00Z',
    outcomes: ['Yes', 'No'],
    whaleCount: 1,
    whalePositions: [
      { pseudonym: 'gandalf', score: 78.7, side: 'Yes', size: 20000 },
    ],
  },
]

// Trending events for the search/explore functionality
// These are the highest-volume active events as of 2026-02-19
export const FALLBACK_EVENTS: EventInfo[] = [
  {
    title: 'What price will Bitcoin hit in February?',
    slug: 'what-price-will-bitcoin-hit-in-february-2026',
    image: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/BTC+fullsize.png',
    volume: 83130920,
    liquidity: 0,
    endDate: '2026-03-01T05:00:00Z',
    markets: [
      {
        conditionId: '0x5e5c9dfaf695371a0cc321b47b35f66a6dbd1482f0503526603d2bd2a91bfdc7',
        question: 'Will Bitcoin reach $150,000 in February?',
        slug: 'will-bitcoin-reach-150k-in-february-2026',
        volume: 20909497,
        yesPrice: 0.002,
        noPrice: 0.998,
        image: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/BTC+fullsize.png',
        endDate: '2026-03-01T05:00:00Z',
        outcomes: ['Yes', 'No'],
      },
    ],
  },
  {
    title: 'Fed decision in March?',
    slug: 'fed-decision-in-march-885',
    image: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/jerome+powell+glasses1.png',
    volume: 142305817,
    liquidity: 0,
    endDate: '2026-03-18T00:00:00Z',
    markets: [
      {
        conditionId: '0xdeb615a52cd114e5aa27d8344ae506a72bea81f6ed13f5915f050b615a193c20',
        question: 'Will the Fed decrease interest rates by 50+ bps after the March 2026 meeting?',
        slug: 'will-the-fed-decrease-interest-rates-by-50-bps-after-the-march-2026-meeting',
        volume: 58643848,
        yesPrice: 0.008,
        noPrice: 0.992,
        image: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/jerome+powell+glasses1.png',
        endDate: '2026-03-18T00:00:00Z',
        outcomes: ['Yes', 'No'],
      },
    ],
  },
  {
    title: 'Which company has the best AI model end of February?',
    slug: 'which-company-has-the-best-ai-model-end-of-february',
    image: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/which-company-has-best-ai-model-end-of-september-MmASwbTkwKHi.jpg',
    volume: 17350209,
    liquidity: 0,
    endDate: '2026-02-28T00:00:00Z',
    markets: [
      {
        conditionId: '0x6a0e818ffb431a5ea38af7d2b99c4ce2a1a3f51d83a1ff69a3b85d0471c3bdba',
        question: 'Will Moonshot have the best AI model at the end of February 2026?',
        slug: 'will-moonshot-have-the-best-ai-model-at-the-end-of-february-2026',
        volume: 987811,
        yesPrice: 0.001,
        noPrice: 0.999,
        image: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/which-company-has-best-ai-model-end-of-september-MmASwbTkwKHi.jpg',
        endDate: '2026-02-28T00:00:00Z',
        outcomes: ['Yes', 'No'],
      },
    ],
  },
  {
    title: 'Who will Trump nominate as Fed Chair?',
    slug: 'who-will-trump-nominate-as-fed-chair',
    image: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/who-will-trump-nominate-as-fed-chair-9p19ttRwsbKL.png',
    volume: 497638472,
    liquidity: 0,
    endDate: '2026-12-31T00:00:00Z',
    markets: [
      {
        conditionId: '0x61b66d02793b4a68ab0cc25be60d65f517fe18c7d654041281bb130341244fcc',
        question: 'Will Trump nominate Kevin Warsh as the next Fed chair?',
        slug: 'will-trump-nominate-kevin-warsh-as-the-next-fed-chair',
        volume: 41176470,
        yesPrice: 0.943,
        noPrice: 0.057,
        image: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/who-will-trump-nominate-as-fed-chair-9p19ttRwsbKL.png',
        endDate: '2026-12-31T00:00:00Z',
        outcomes: ['Yes', 'No'],
      },
    ],
  },
  {
    title: '2026 FIFA World Cup Winner',
    slug: '2026-fifa-world-cup-winner-595',
    image: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/2026-fifa-world-cup-winner-595-8rgoVIZnbKgL.png',
    volume: 164641285,
    liquidity: 0,
    endDate: '2026-07-20T00:00:00Z',
    markets: [
      {
        conditionId: '0x7976b8dbacf9077eb1453a62bcefd6ab2df199acd28aad276ff0d920d6992892',
        question: 'Will Spain win the 2026 FIFA World Cup?',
        slug: 'will-spain-win-the-2026-fifa-world-cup-963',
        volume: 2118927,
        yesPrice: 0.163,
        noPrice: 0.837,
        image: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/2026-fifa-world-cup-winner-595-8rgoVIZnbKgL.png',
        endDate: '2026-07-20T00:00:00Z',
        outcomes: ['Yes', 'No'],
      },
    ],
  },
  {
    title: 'UEFA Champions League Winner',
    slug: 'uefa-champions-league-winner',
    image: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/uefa-champions-league-2025-26-which-teams-qualify-StbSIjaEx2St.png',
    volume: 232240206,
    liquidity: 0,
    endDate: '2026-05-31T00:00:00Z',
    markets: [
      {
        conditionId: '0x52a5ce595e0f0816e17e5f40dbd5967c88beb4b9f21000bfdd9a1ff26c281fdd',
        question: 'Will Real Madrid win the 2025-26 Champions League?',
        slug: 'will-real-madrid-win-the-202526-champions-league',
        volume: 1607507,
        yesPrice: 0.085,
        noPrice: 0.915,
        image: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/uefa-champions-league-2025-26-which-teams-qualify-StbSIjaEx2St.png',
        endDate: '2026-05-31T00:00:00Z',
        outcomes: ['Yes', 'No'],
      },
    ],
  },
  {
    title: 'English Premier League Winner',
    slug: 'english-premier-league-winner',
    image: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/english-premier-league-winner-VFcNkpZeA9Sz.jpg',
    volume: 242645018,
    liquidity: 0,
    endDate: '2026-05-27T00:00:00Z',
    markets: [
      {
        conditionId: '0x29eafc104d7824c838e194766074f50b352f866abd9bc2fe536b1cdf93e3663f',
        question: 'Will Brentford win the 2025-26 English Premier League?',
        slug: 'will-brentford-win-the-202526-english-premier-league',
        volume: 13074650,
        yesPrice: 0.002,
        noPrice: 0.998,
        image: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/english-premier-league-winner-VFcNkpZeA9Sz.jpg',
        endDate: '2026-05-27T00:00:00Z',
        outcomes: ['Yes', 'No'],
      },
    ],
  },
  {
    title: 'What price will Ethereum hit in February?',
    slug: 'what-price-will-ethereum-hit-in-february-2026',
    image: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/ETH+fullsize.jpg',
    volume: 26730023,
    liquidity: 0,
    endDate: '2026-03-01T05:00:00Z',
    markets: [
      {
        conditionId: '0x113263410d37b2256691b62d76b09a97d4ecd75bdcb0df37ff14a7adf53039bb',
        question: 'Will Ethereum reach $5,000 in February?',
        slug: 'will-ethereum-reach-5000-in-february-2026',
        volume: 5069887,
        yesPrice: 0.002,
        noPrice: 0.998,
        image: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/ETH+fullsize.jpg',
        endDate: '2026-03-01T05:00:00Z',
        outcomes: ['Yes', 'No'],
      },
    ],
  },
]

// Demo-ready conditionIds that are confirmed to have whale positions
// Use these to pre-test the analyze endpoint
export const DEMO_CONDITION_IDS = WHALE_MARKETS.map(m => m.conditionId)
