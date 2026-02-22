// Polymarket CLOB execution layer
// Server-side market order execution with slippage protection
// Uses a pre-funded Polygon wallet to place FOK orders

import { ClobClient, Side, OrderType } from '@polymarket/clob-client'
import { Wallet } from '@ethersproject/wallet'
import { JsonRpcProvider } from '@ethersproject/providers'
import { Contract } from '@ethersproject/contracts'
import { GAMMA_API, POLYGON_RPC, USDC_POLYGON, SLIPPAGE_PCT, MAX_BET_USD } from './constants'

// Singleton CLOB client (lazy init)
let clientInstance: ClobClient | null = null
let walletAddress: string = ''

export interface ClobBetResult {
  success: boolean
  orderID: string
  transactionHashes: string[]
  price: number        // actual fill price
  shares: number       // shares received
  amountUSD: number    // USDC spent
  explorerUrl: string  // polygonscan link
  tokenId: string      // resolved token ID
  tickSize: string     // tick size used
  negRisk: boolean     // neg risk flag
}

export interface ClobTokenIds {
  yes: string
  no: string
  tickSize: string
  negRisk: boolean
}

export async function getClient(): Promise<ClobClient> {
  if (clientInstance) return clientInstance

  const pk = process.env.POLYMARKET_PRIVATE_KEY
  if (!pk) throw new Error('POLYMARKET_PRIVATE_KEY not set')

  const signer = new Wallet(pk)
  walletAddress = await signer.getAddress()

  // Derive or create API credentials
  const temp = new ClobClient('https://clob.polymarket.com', 137, signer)
  const creds = await temp.createOrDeriveApiKey()

  clientInstance = new ClobClient(
    'https://clob.polymarket.com',
    137,
    signer,
    creds,
    0,                // signatureType: EOA
    walletAddress,    // funder address
  )

  console.log(`[CLOB] Initialized for wallet: ${walletAddress}`)
  return clientInstance
}

// Fetch clobTokenIds from Gamma API (try slug first, fall back to conditionId)
export async function getTokenIds(conditionId: string, slug?: string): Promise<ClobTokenIds | null> {
  try {
    // Try slug first (more reliable, condition_id search can return stale results)
    const queries = slug
      ? [`${GAMMA_API}/markets?slug=${slug}&limit=1`, `${GAMMA_API}/markets?condition_id=${conditionId}&limit=1`]
      : [`${GAMMA_API}/markets?condition_id=${conditionId}&limit=1`]

    for (const url of queries) {
      const res = await fetch(url)
      if (!res.ok) continue
      const data = await res.json()
      if (!Array.isArray(data) || data.length === 0) continue

      const market = data[0]
      const tokenIds = JSON.parse(market.clobTokenIds || '[]')
      if (tokenIds.length < 2) continue

      console.log(`[CLOB] Resolved market via ${url.includes('slug=') ? 'slug' : 'conditionId'}: ${market.question}`)
      return {
        yes: tokenIds[0],
        no: tokenIds[1],
        tickSize: market.orderPriceMinTickSize?.toString() || '0.01',
        negRisk: market.negRisk === true,
      }
    }
    return null
  } catch (e) {
    console.error('[CLOB] Failed to fetch token IDs:', e)
    return null
  }
}

// Get current best price for a token (for slippage calculation)
export async function getBestPrice(client: ClobClient, tokenID: string, side: Side): Promise<number> {
  try {
    const book = await client.getOrderBook(tokenID)
    if (side === Side.BUY) {
      // For buying, we need the lowest ask
      const asks = book.asks || []
      if (asks.length > 0) return parseFloat(asks[0].price)
    } else {
      // For selling, we need the highest bid
      const bids = book.bids || []
      if (bids.length > 0) return parseFloat(bids[0].price)
    }
    // Fallback: get last trade price
    const lastTrade = await client.getLastTradePrice(tokenID)
    return parseFloat(lastTrade?.price || '0.5')
  } catch {
    return 0.5 // Safe default
  }
}

// Apply slippage to price (round to tick size)
function applySlippage(price: number, slippage: number, tickSize: string): number {
  const withSlippage = Math.min(price * (1 + slippage), 0.99)
  const tick = parseFloat(tickSize)
  return Math.ceil(withSlippage / tick) * tick
}

// Execute a market order on Polymarket CLOB
export async function executeClobBet(params: {
  conditionId: string
  outcomeIndex: number  // 0 = Yes, 1 = No
  amountUSD: number
  signalHash: string
  tokenId?: string       // Direct token ID (skips Gamma lookup)
  tickSize?: string      // Tick size when using direct tokenId
  negRisk?: boolean      // Neg risk flag when using direct tokenId
  marketSlug?: string    // Slug for reliable Gamma lookup
}): Promise<ClobBetResult> {
  const { conditionId, outcomeIndex, amountUSD } = params

  // Safety cap
  if (amountUSD > MAX_BET_USD) {
    throw new Error(`Bet amount $${amountUSD} exceeds max $${MAX_BET_USD}`)
  }
  if (amountUSD <= 0) {
    throw new Error('Bet amount must be positive')
  }

  // Resolve token ID: use direct tokenId if provided, otherwise look up via Gamma
  let tokenID: string
  let tickSize: string
  let negRisk: boolean

  if (params.tokenId) {
    tokenID = params.tokenId
    tickSize = params.tickSize || '0.01'
    negRisk = params.negRisk ?? false
  } else {
    const tokens = await getTokenIds(conditionId, params.marketSlug)
    if (!tokens) throw new Error('market not found')
    tokenID = outcomeIndex === 0 ? tokens.yes : tokens.no
    tickSize = tokens.tickSize
    negRisk = tokens.negRisk
  }

  const client = await getClient()

  console.log(`[CLOB] Executing: $${amountUSD} on ${outcomeIndex === 0 ? 'YES' : 'NO'}`)
  console.log(`[CLOB] Token: ${tokenID.substring(0, 20)}...`)
  console.log(`[CLOB] negRisk: ${negRisk}, tickSize: ${tickSize}`)

  // Build order params: let CLOB client calculate price for neg-risk markets
  // For standard markets, manually compute price with slippage protection
  const orderParams: { tokenID: string; amount: number; side: Side; price?: number } = {
    tokenID,
    amount: amountUSD,
    side: Side.BUY,
  }

  if (!negRisk) {
    const bestPrice = await getBestPrice(client, tokenID, Side.BUY)
    const priceWithSlippage = applySlippage(bestPrice, SLIPPAGE_PCT, tickSize)
    orderParams.price = priceWithSlippage
    console.log(`[CLOB] Best price: ${bestPrice}, with slippage: ${priceWithSlippage}`)
  } else {
    console.log(`[CLOB] Neg-risk market: letting CLOB client calculate price`)
  }

  // Place FOK market order
  const response = await client.createAndPostMarketOrder(
    orderParams,
    {
      tickSize: tickSize as '0.1' | '0.01' | '0.001' | '0.0001',
      negRisk: negRisk,
    },
    OrderType.FOK,
  )

  console.log(`[CLOB] Order response:`, JSON.stringify(response))

  // Check for errors (CLOB uses both 'errorMsg' and 'error' fields)
  const errorMessage = response.errorMsg || response.error
  if (errorMessage) {
    throw new Error(`CLOB order failed: ${errorMessage}`)
  }
  if (response.status === 'error' || (response.status && response.status !== 'matched' && response.status !== 'delayed')) {
    throw new Error(`CLOB order status: ${response.status}`)
  }

  const txHashes: string[] = response.transactionsHashes || []
  const makingAmount = parseFloat(response.makingAmount || '0')
  const takingAmount = parseFloat(response.takingAmount || '0')
  const fillPrice = takingAmount > 0 ? makingAmount / takingAmount : (orderParams.price || 0.5)

  return {
    success: true,
    orderID: response.orderID || '',
    transactionHashes: txHashes,
    price: fillPrice,
    shares: takingAmount,
    amountUSD: makingAmount || amountUSD,
    explorerUrl: txHashes.length > 0
      ? `https://polygonscan.com/tx/${txHashes[0]}`
      : '',
    tokenId: tokenID,
    tickSize,
    negRisk,
  }
}

// Sell shares on Polymarket CLOB
export async function executeClobSell(params: {
  tokenId: string
  shares: number
  tickSize?: string
  negRisk?: boolean
}): Promise<ClobBetResult> {
  const { tokenId, shares } = params
  const tickSize = params.tickSize || '0.01'
  const negRisk = params.negRisk ?? false

  if (shares <= 0) throw new Error('Shares must be positive')

  const client = await getClient()

  console.log(`[CLOB] Selling: ${shares} shares`)
  console.log(`[CLOB] Token: ${tokenId.substring(0, 20)}...`)
  console.log(`[CLOB] negRisk: ${negRisk}, tickSize: ${tickSize}`)

  // For SELL, amount = number of shares to sell
  const orderParams: { tokenID: string; amount: number; side: Side; price?: number } = {
    tokenID: tokenId,
    amount: shares,
    side: Side.SELL,
  }

  if (!negRisk) {
    const bestPrice = await getBestPrice(client, tokenId, Side.SELL)
    // For selling, apply slippage downward (accept lower price)
    const tick = parseFloat(tickSize)
    const priceWithSlippage = Math.max(Math.floor(bestPrice * (1 - SLIPPAGE_PCT) / tick) * tick, tick)
    orderParams.price = priceWithSlippage
    console.log(`[CLOB] Best bid: ${bestPrice}, with slippage: ${priceWithSlippage}`)
  } else {
    console.log(`[CLOB] Neg-risk market: letting CLOB client calculate price`)
  }

  const response = await client.createAndPostMarketOrder(
    orderParams,
    {
      tickSize: tickSize as '0.1' | '0.01' | '0.001' | '0.0001',
      negRisk: negRisk,
    },
    OrderType.FOK,
  )

  console.log(`[CLOB] Sell response:`, JSON.stringify(response))

  const errorMessage = response.errorMsg || response.error
  if (errorMessage) throw new Error(`CLOB sell failed: ${errorMessage}`)

  const txHashes: string[] = response.transactionsHashes || []
  const makingAmount = parseFloat(response.makingAmount || '0')
  const takingAmount = parseFloat(response.takingAmount || '0')
  // For SELL: makingAmount = shares sold, takingAmount = USDC received
  const fillPrice = makingAmount > 0 ? takingAmount / makingAmount : 0

  return {
    success: true,
    orderID: response.orderID || '',
    transactionHashes: txHashes,
    price: fillPrice,
    shares: makingAmount || shares,
    amountUSD: takingAmount,
    explorerUrl: txHashes.length > 0
      ? `https://polygonscan.com/tx/${txHashes[0]}`
      : '',
  }
}

// Check USDC balance on Polygon (with timeout for serverless)
export async function getUSDCBalance(): Promise<number> {
  const pk = process.env.POLYMARKET_PRIVATE_KEY
  if (!pk) { console.log('[CLOB] No POLYMARKET_PRIVATE_KEY'); return 0 }

  try {
    const provider = new JsonRpcProvider(POLYGON_RPC)
    const wallet = new Wallet(pk, provider)
    const usdc = new Contract(USDC_POLYGON, [
      'function balanceOf(address) view returns (uint256)',
    ], provider)

    // Race against 8s timeout for serverless environments
    const balance = await Promise.race([
      usdc.balanceOf(wallet.address),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('RPC timeout')), 8000)),
    ])

    const parsed = parseFloat(balance.toString()) / 1e6
    console.log(`[CLOB] USDC balance: $${parsed}`)
    return parsed
  } catch (err) {
    console.error('[CLOB] Balance check failed:', err instanceof Error ? err.message : err)
    return -1  // Return -1 to distinguish from "no key" (0)
  }
}

export function getWalletAddress(): string {
  return walletAddress
}
