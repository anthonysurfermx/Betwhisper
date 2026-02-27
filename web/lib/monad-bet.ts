// On-chain bet payment on Monad — v3 (retry loop for tx confirmation)
// User sends MON equivalent to their USD bet amount to BetWhisper deposit address
// Bet metadata in calldata provides on-chain data provenance

import { JsonRpcSigner, JsonRpcProvider, Wallet, parseEther, hexlify, toUtf8Bytes, formatEther } from 'ethers'
import { MONAD_EXPLORER, MONAD_RPC, BETWHISPER_DEPOSIT_ADDRESS, RPC_TIMEOUT_MS, PAYMENT_TOLERANCE } from './constants'
import { getMonPriceOrThrow } from './mon-price'

// Fetch with AbortController timeout for RPC calls
async function fetchRpcWithTimeout(url: string, body: unknown, timeoutMs: number = RPC_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

export interface BetParams {
  marketSlug: string
  side: 'Yes' | 'No'
  amountUSD: number
  monPriceUSD: number
  signalHash: string
}

export interface BetResult {
  txHash: string
  blockNumber: number
  explorerUrl: string
  monAmount: string
}

export async function executeBet(
  signer: JsonRpcSigner,
  params: BetParams
): Promise<BetResult> {
  const { marketSlug, side, amountUSD, monPriceUSD, signalHash } = params

  // Calculate MON equivalent (add 1% buffer for price movement)
  const monAmount = (amountUSD / monPriceUSD) * 1.01
  const monAmountStr = monAmount.toFixed(6)

  // Encode bet metadata as calldata for on-chain data provenance
  const metadata = JSON.stringify({
    protocol: 'betwhisper',
    market: marketSlug,
    side,
    signal: signalHash,
    amount_usd: amountUSD,
    mon_price: monPriceUSD,
    ts: Math.floor(Date.now() / 1000),
  })

  const tx = await signer.sendTransaction({
    to: BETWHISPER_DEPOSIT_ADDRESS,
    value: parseEther(monAmountStr),
    data: hexlify(toUtf8Bytes(metadata)),
  })

  const receipt = await tx.wait()

  return {
    txHash: tx.hash,
    blockNumber: receipt?.blockNumber ?? 0,
    explorerUrl: `${MONAD_EXPLORER}/tx/${tx.hash}`,
    monAmount: monAmountStr,
  }
}

// Verify a MON payment transaction on Monad RPC (server-side)
// Uses batch JSON-RPC (1 request instead of 2) + AbortController timeout
// Price from multi-source oracle (never hardcoded fallback)
// Tolerance: 5% max underpayment (was 15%)
export async function verifyMonadPayment(txHash: string, expectedAmountUSD: number, _monPriceUSD: number): Promise<{
  verified: boolean
  error?: string
  from?: string
  value?: string
  computedUSD?: number
}> {
  try {
    console.log(`[Payment v3] Verifying tx ${txHash.slice(0, 12)}... (retry loop active)`)
    // Retry loop: wait for Monad to confirm the transaction (up to ~10s)
    let receipt: Record<string, string> | null = null
    let tx: Record<string, string> | null = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const batchRes = await fetchRpcWithTimeout(MONAD_RPC, [
        { jsonrpc: '2.0', method: 'eth_getTransactionReceipt', params: [txHash], id: 1 },
        { jsonrpc: '2.0', method: 'eth_getTransactionByHash', params: [txHash], id: 2 },
      ])
      const batchData = await batchRes.json() as Array<{ id: number; result: Record<string, string> | null }>

      receipt = batchData.find(r => r.id === 1)?.result ?? null
      tx = batchData.find(r => r.id === 2)?.result ?? null

      if (receipt) break // Transaction confirmed
      // Wait before retrying (1s, 2s, 2s, 3s)
      const delay = [1000, 2000, 2000, 3000, 3000][attempt]
      console.log(`[Payment] Tx not confirmed yet, retry ${attempt + 1}/5 in ${delay}ms...`)
      await new Promise(r => setTimeout(r, delay))
    }

    if (!receipt) return { verified: false, error: 'Transaction not confirmed after 10s' }
    if (receipt.status !== '0x1') return { verified: false, error: 'Transaction failed' }
    if (!tx) return { verified: false, error: 'Transaction data not found' }

    // Verify recipient is deposit address
    if (tx.to?.toLowerCase() !== BETWHISPER_DEPOSIT_ADDRESS.toLowerCase()) {
      return { verified: false, error: 'Wrong recipient' }
    }

    // Read on-chain MON value
    const valueMON = parseFloat(formatEther(BigInt(tx.value)))

    // Server-side price from multi-source oracle (throws if all sources fail)
    const serverMonPrice = await getMonPriceOrThrow()

    // Compute USD from on-chain MON amount
    const computedUSD = valueMON * serverMonPrice

    // Verify amount: max 5% underpayment tolerance
    const minUSD = expectedAmountUSD * (1 - PAYMENT_TOLERANCE)
    if (computedUSD < minUSD) {
      return {
        verified: false,
        error: `Insufficient payment: ${valueMON.toFixed(2)} MON (~$${computedUSD.toFixed(2)}) < $${minUSD.toFixed(2)} required`,
        computedUSD,
      }
    }

    return { verified: true, from: tx.from, value: valueMON.toFixed(6), computedUSD }
  } catch (err) {
    return { verified: false, error: err instanceof Error ? err.message : 'Verification failed' }
  }
}

// Server-side: send MON to user wallet (cashout after sell)
export async function sendMON(toAddress: string, amountMON: number): Promise<{
  txHash: string
  explorerUrl: string
}> {
  const pk = process.env.POLYMARKET_PRIVATE_KEY
  if (!pk) throw new Error('POLYMARKET_PRIVATE_KEY not set')

  const provider = new JsonRpcProvider(MONAD_RPC)
  const wallet = new Wallet(pk, provider)

  // Explicit nonce to avoid race conditions with concurrent cashouts
  const nonce = await provider.getTransactionCount(wallet.address, 'pending')

  const tx = await wallet.sendTransaction({
    to: toAddress,
    value: parseEther(amountMON.toFixed(6)),
    nonce,
  })

  const receipt = await tx.wait()
  if (!receipt || receipt.status === 0) {
    throw new Error('MON transfer failed on-chain')
  }

  return {
    txHash: tx.hash,
    explorerUrl: `${MONAD_EXPLORER}/tx/${tx.hash}`,
  }
}

// Server-side: check MON balance of server wallet on Monad
export async function getServerMONBalance(): Promise<number> {
  const pk = process.env.POLYMARKET_PRIVATE_KEY
  if (!pk) return 0

  try {
    const provider = new JsonRpcProvider(MONAD_RPC)
    const wallet = new Wallet(pk, provider)
    const balance = await provider.getBalance(wallet.address)
    return parseFloat(formatEther(balance))
  } catch (err) {
    console.error('[Monad] Balance check failed:', err instanceof Error ? err.message : err)
    return -1
  }
}
