// BetWhisper constants

// Monad (Intent Layer + Data Provenance)
export const MONAD_CHAIN_ID = 143
export const MONAD_RPC = 'https://rpc.monad.xyz'
export const MONAD_EXPLORER = 'https://monadscan.com'

// Polygon (Polymarket CLOB execution)
export const POLYGON_CHAIN_ID = 137
export const POLYGON_RPC = process.env.POLYGON_RPC_URL || 'https://polygon-bor-rpc.publicnode.com'
export const POLYGON_EXPLORER = 'https://polygonscan.com'

// Polymarket contracts (Polygon)
export const USDC_POLYGON = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
export const CTF_CONTRACT = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045'
export const CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E'
export const NEG_RISK_CTF_EXCHANGE = '0xC5d563A36AE78145C45a50134d48A1215220f80a'
export const NEG_RISK_ADAPTER = '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296'

// Polymarket APIs (server-side, called directly)
export const GAMMA_API = 'https://gamma-api.polymarket.com'
export const DATA_API = 'https://data-api.polymarket.com'
export const CLOB_API = 'https://clob.polymarket.com'

// BetWhisper deposit (users send MON here before CLOB execution)
export const BETWHISPER_DEPOSIT_ADDRESS = '0x530aBd0674982BAf1D16fd7A52E2ea510E74C8c3'
export const MON_PRICE_API = 'https://api.coingecko.com/api/v3/simple/price?ids=monad&vs_currencies=usd'

// CLOB execution config
export const MAX_BET_USD = 100       // Safety cap per order
export const SLIPPAGE_PCT = 0.05     // 5% slippage tolerance for FOK orders

// Payment verification & safety
export const PAYMENT_TOLERANCE = 0.05        // Max 5% underpayment allowed
export const RPC_TIMEOUT_MS = 6_000          // Timeout for Monad RPC calls
export const PRICE_FETCH_TIMEOUT_MS = 4_000  // Timeout for price oracle calls
export const DAILY_SPEND_LIMIT_USD = 500     // Server-side daily spending cap
export const RATE_LIMIT_PER_MINUTE = 5       // Max trades per wallet per minute
export const REFUND_GAS_BUFFER_MON = 0.1     // Gas buffer deducted from refunds

// Consensus thresholds
export const MIN_SMART_WALLETS_FOR_SIGNAL = 2
export const CONVICTION_CAP = 3.0
