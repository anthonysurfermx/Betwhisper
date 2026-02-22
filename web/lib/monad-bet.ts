// On-chain bet payment on Monad
// User sends MON equivalent to their USD bet amount to BetWhisper deposit address
// Bet metadata in calldata provides on-chain data provenance

import { JsonRpcSigner, JsonRpcProvider, Wallet, parseEther, hexlify, toUtf8Bytes, formatEther } from 'ethers'
import { MONAD_EXPLORER, MONAD_RPC, BETWHISPER_DEPOSIT_ADDRESS } from './constants'

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
// Returns computedUSD: the server-side USD calculation from on-chain MON value
export async function verifyMonadPayment(txHash: string, expectedAmountUSD: number, monPriceUSD: number): Promise<{
  verified: boolean
  error?: string
  from?: string
  value?: string
  computedUSD?: number
}> {
  try {
    const res = await fetch('https://rpc.monad.xyz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', method: 'eth_getTransactionReceipt', params: [txHash], id: 1,
      }),
    })
    const data = await res.json()
    const receipt = data.result
    if (!receipt) return { verified: false, error: 'Transaction not found' }
    if (receipt.status !== '0x1') return { verified: false, error: 'Transaction failed' }

    // Get full tx for value and to
    const txRes = await fetch('https://rpc.monad.xyz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', method: 'eth_getTransactionByHash', params: [txHash], id: 2,
      }),
    })
    const txData = await txRes.json()
    const tx = txData.result
    if (!tx) return { verified: false, error: 'Transaction data not found' }

    // Verify recipient is deposit address
    if (tx.to?.toLowerCase() !== BETWHISPER_DEPOSIT_ADDRESS.toLowerCase()) {
      return { verified: false, error: 'Wrong recipient' }
    }

    // Read on-chain MON value
    const valueMON = parseFloat(formatEther(BigInt(tx.value)))

    // Server-side price verification: fetch MON price independently
    let serverMonPrice = monPriceUSD
    try {
      const priceRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=monad&vs_currencies=usd')
      if (priceRes.ok) {
        const priceData = await priceRes.json()
        if (priceData?.monad?.usd > 0) serverMonPrice = priceData.monad.usd
      }
    } catch { /* use client-provided price as fallback */ }

    // Compute USD from on-chain MON amount using server-fetched price
    const computedUSD = valueMON * serverMonPrice

    // Verify amount: on-chain MON must cover at least 85% of expected USD
    // (accounts for price movement between client fetch and server verification)
    const minUSD = expectedAmountUSD * 0.85
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
