// Smart money wallet scores from Polymarket Agent Radar
// 29 wallets with overall_score >= 60 (out of 196 analyzed)
// Scoring: 12 attributes weighted (win_rate, roi, consistency, volume, experience,
// timing_edge, specialization, risk_stability, exit_quality, bot_score_inv, recency, capacity)

export interface WalletScore {
  address: string
  pseudonym: string
  overall_score: number
  bot_score_inv: number // 100 = human, 0 = bot. Below 85 = likely agent
  total_trades: number
  unique_markets: number
  median_position_size: number
  total_volume: number
}

const ELIGIBLE_WALLETS: WalletScore[] = [
  { address: '0x21f90e5ff30c12f52fbb2fb220aa268f22faed12', pseudonym: 'gandalf', overall_score: 78.7, bot_score_inv: 100, total_trades: 738, unique_markets: 25, median_position_size: 0.26, total_volume: 2725.99 },
  { address: '0x1355fbfd5f3c3d8da9d8227964fc185f63686591', pseudonym: 'O.G.Degen', overall_score: 69.9, bot_score_inv: 100, total_trades: 3500, unique_markets: 372, median_position_size: 11.46, total_volume: 73496.03 },
  { address: '0x03d9b4b83a569f7428e002215949aacf1385e693', pseudonym: 'phantom_03', overall_score: 69.8, bot_score_inv: 100, total_trades: 2541, unique_markets: 561, median_position_size: 1.5, total_volume: 4067.44 },
  { address: '0xec6c700a00fa68a2823719c815b495fba66423c7', pseudonym: '879csd78', overall_score: 68.4, bot_score_inv: 100, total_trades: 3500, unique_markets: 579, median_position_size: 18.0, total_volume: 106000.49 },
  { address: '0x94d71d0d28709da91fd44c7d89da272fe86dbef5', pseudonym: 'JMMMMM', overall_score: 65.7, bot_score_inv: 100, total_trades: 3449, unique_markets: 214, median_position_size: 100.0, total_volume: 1258979.75 },
  { address: '0x914a702066270b8c9d07499efd829ce3eec0f967', pseudonym: 'stealth_914', overall_score: 65.6, bot_score_inv: 97.6, total_trades: 3500, unique_markets: 1633, median_position_size: 0.28, total_volume: 1536.62 },
  { address: '0x519d98cfe6eb112fdc8d5f8e5e2c900036c937a1', pseudonym: 'Usernombre', overall_score: 65.5, bot_score_inv: 100, total_trades: 3500, unique_markets: 818, median_position_size: 1.98, total_volume: 6048.87 },
  { address: '0xa4bd8f49695cf5d55924aca4cc2694952874e8a2', pseudonym: 'paas2', overall_score: 65.4, bot_score_inv: 100, total_trades: 3500, unique_markets: 253, median_position_size: 3.1, total_volume: 6111.38 },
  { address: '0x54c07612771e38ccd18810bf0a925637b392a338', pseudonym: 'runzero', overall_score: 65.4, bot_score_inv: 100, total_trades: 1543, unique_markets: 373, median_position_size: 6.0, total_volume: 14900.89 },
  { address: '0x35c0732e069faea97c11aa9cab045562eaab81d6', pseudonym: 'stealth_35c', overall_score: 64.6, bot_score_inv: 100, total_trades: 3500, unique_markets: 638, median_position_size: 0.03, total_volume: 912.76 },
  { address: '0x6a72f61820b26b1fe4d956e17b6dc2a1ea3033ee', pseudonym: 'kch123', overall_score: 64.2, bot_score_inv: 100, total_trades: 3500, unique_markets: 62, median_position_size: 92.34, total_volume: 1961760.96 },
  { address: '0x44725c4dfdcb50e91188285029580086d08ba648', pseudonym: 'macrobody', overall_score: 64.0, bot_score_inv: 100, total_trades: 445, unique_markets: 440, median_position_size: 106.0, total_volume: 52790.9 },
  { address: '0xf527ee7ce26ea1b3725129fbf0049f5fec08366b', pseudonym: 'jibikiru', overall_score: 64.0, bot_score_inv: 100, total_trades: 926, unique_markets: 358, median_position_size: 35.49, total_volume: 28449.87 },
  { address: '0x21235341b4eba62c8807ec3ddfbda02b6ba28d70', pseudonym: 'okben', overall_score: 63.9, bot_score_inv: 100, total_trades: 727, unique_markets: 299, median_position_size: 54.12, total_volume: 92425.25 },
  { address: '0x987069e3ba77f73bc43fcad0dd43fa3eced7b9d3', pseudonym: 'NoMMS111', overall_score: 63.7, bot_score_inv: 100, total_trades: 778, unique_markets: 631, median_position_size: 1500.0, total_volume: 1124110.51 },
  { address: '0x4018f2f161d54790cdb00e4257494d68d37dd14a', pseudonym: 'stealth_401', overall_score: 63.4, bot_score_inv: 81.1, total_trades: 3500, unique_markets: 2974, median_position_size: 0.01, total_volume: 19.51 },
  { address: '0x161f2db0e40c59b2f29e898efb63cc415228b075', pseudonym: 'stealth_161', overall_score: 63.3, bot_score_inv: 83.5, total_trades: 3500, unique_markets: 2680, median_position_size: 0.01, total_volume: 17.97 },
  { address: '0xef2a2e5397a610a01040212974b53cff7799bd7e', pseudonym: 'stealth_ef2', overall_score: 63.2, bot_score_inv: 77.7, total_trades: 3500, unique_markets: 2896, median_position_size: 0.01, total_volume: 20.97 },
  { address: '0xe9b42acb8cf9b3ce94d70c7400acabcbb942f03a', pseudonym: 'stealth_e9b', overall_score: 63.2, bot_score_inv: 78.9, total_trades: 3500, unique_markets: 2953, median_position_size: 0.01, total_volume: 21.73 },
  { address: '0xcacf2bf1906bb3c74a0e0453bfb91f1374e335ff', pseudonym: 'WizzleGizzle', overall_score: 63.1, bot_score_inv: 100, total_trades: 3500, unique_markets: 251, median_position_size: 0.04, total_volume: 1645.87 },
  { address: '0x5482e3563af2e7ab2a3ecae3ebb6fe5b6d7cb6ee', pseudonym: 'ElectroEater', overall_score: 63.0, bot_score_inv: 100, total_trades: 3500, unique_markets: 663, median_position_size: 1.41, total_volume: 4830.44 },
  { address: '0x51393c00184b39182f09a8a62b8549642e69a8db', pseudonym: '4-seas', overall_score: 62.0, bot_score_inv: 100, total_trades: 3500, unique_markets: 432, median_position_size: 69.41, total_volume: 3063863.32 },
  { address: '0xd28e601c31f3291f14c2a0adbe30326fd6a3aae3', pseudonym: 'iamgoodddddddddd', overall_score: 61.4, bot_score_inv: 100, total_trades: 368, unique_markets: 130, median_position_size: 33.99, total_volume: 30694.8 },
  { address: '0x7ab6ac0f0d6ca5a15ec57abeaf413d31c8cdfa77', pseudonym: 'ACara', overall_score: 61.1, bot_score_inv: 100, total_trades: 3500, unique_markets: 128, median_position_size: 2.12, total_volume: 8387.7 },
  { address: '0x36901eb0f21519cc9055662a6d2483e96da1e16f', pseudonym: 'melchior1248', overall_score: 60.8, bot_score_inv: 100, total_trades: 3500, unique_markets: 236, median_position_size: 8.38, total_volume: 21818.83 },
  { address: '0xbfc6a1cde68eadddbf4812f7d6e637e16ce8ce6b', pseudonym: 'annoyinglowie', overall_score: 60.5, bot_score_inv: 100, total_trades: 3385, unique_markets: 249, median_position_size: 1.12, total_volume: 54392.24 },
  { address: '0x97e12cc7391a50e49042b44a2d4a0cef54c8017b', pseudonym: 'BigBlackGorilla', overall_score: 60.2, bot_score_inv: 100, total_trades: 3500, unique_markets: 145, median_position_size: 8.1, total_volume: 51062.63 },
  { address: '0x1117eade222413335b7ec959e5b48c1d3dbc3532', pseudonym: 'benwyatt', overall_score: 60.1, bot_score_inv: 100, total_trades: 3500, unique_markets: 234, median_position_size: 40.0, total_volume: 3091495.91 },
  { address: '0xc52c1facd881f01286c60fcdd5b72e5b57f16732', pseudonym: 'NPCtrader', overall_score: 60.0, bot_score_inv: 100, total_trades: 1502, unique_markets: 321, median_position_size: 50.0, total_volume: 116182.94 },
]

// O(1) lookup by address (lowercased)
export const walletScoresMap = new Map<string, WalletScore>(
  ELIGIBLE_WALLETS.map(w => [w.address.toLowerCase(), w])
)

export const SMART_WALLET_COUNT = ELIGIBLE_WALLETS.length

export function getWalletScore(address: string): WalletScore | undefined {
  return walletScoresMap.get(address.toLowerCase())
}

export function getAllSmartWallets(): WalletScore[] {
  return ELIGIBLE_WALLETS
}
