// Server-side Unlink wallet for receiving private transfers
// Uses memory storage (Vercel serverless has no persistent filesystem)
// Mnemonic stored in UNLINK_SERVER_MNEMONIC env var — wallet reconstructed on cold start

import { initWallet, type UnlinkWallet } from '@unlink-xyz/node'
import { MON_TOKEN } from './constants'

let serverWallet: UnlinkWallet | null = null

export async function getServerUnlinkWallet(): Promise<UnlinkWallet> {
  if (serverWallet) {
    console.log('[Unlink:Wallet] Returning cached wallet instance')
    return serverWallet
  }

  console.log('[Unlink:Wallet] === COLD START: Initializing server wallet ===')
  const mnemonic = process.env.UNLINK_SERVER_MNEMONIC
  if (!mnemonic) throw new Error('UNLINK_SERVER_MNEMONIC not set')

  // Memory storage is the default for @unlink-xyz/node — no SQLite needed
  console.log('[Unlink:Wallet] Calling initWallet(chain=monad-testnet)...')
  const wallet = await initWallet({
    chain: 'monad-testnet',
    setup: false,
    sync: false,
  })
  console.log('[Unlink:Wallet] initWallet done')

  // Import existing mnemonic and create account
  console.log('[Unlink:Wallet] Importing mnemonic...')
  await wallet.seed.importMnemonic(mnemonic)
  console.log('[Unlink:Wallet] Creating account...')
  await wallet.accounts.create()
  console.log('[Unlink:Wallet] Syncing from Gateway...')
  const syncStart = Date.now()
  await wallet.sync()
  console.log(`[Unlink:Wallet] Sync done in ${Date.now() - syncStart}ms`)

  serverWallet = wallet

  // Log wallet state
  try {
    const account = await wallet.accounts.getActive()
    const balance = await wallet.getBalance(MON_TOKEN)
    const notes = await wallet.getNotes()
    console.log('[Unlink:Wallet] Server wallet ready', {
      address: account?.address,
      balance: balance.toString(),
      noteCount: notes.length,
    })
  } catch (e) {
    console.warn('[Unlink:Wallet] Could not log wallet state:', e)
  }

  return wallet
}

// Get server's Unlink address (unlink1... format) for receiving private transfers
export async function getServerUnlinkAddress(): Promise<string> {
  const wallet = await getServerUnlinkWallet()
  const account = await wallet.accounts.getActive()
  if (!account) throw new Error('No active Unlink account')
  return account.address // Account type includes `address: string` (bech32m unlink1...)
}

// Verify a private transfer by checking received notes (getNotes)
// Ainur confirmed: relayId is internal and can't be used cross-wallet.
// Instead, the client sends txHash + amount + token, and the server
// syncs its wallet, lists received notes, and matches by those fields.
export async function verifyUnlinkTransfer(
  txHash: string,
  expectedAmount: bigint,
  token: string = MON_TOKEN,
): Promise<{ verified: boolean; note?: unknown }> {
  console.log(`[Unlink:Verify] === TRANSFER VERIFICATION START ===`)
  console.log(`[Unlink:Verify] txHash=${txHash}`)
  console.log(`[Unlink:Verify] expectedAmount=${expectedAmount.toString()}`)
  console.log(`[Unlink:Verify] token=${token}`)

  const wallet = await getServerUnlinkWallet()
  console.log('[Unlink:Verify] Syncing wallet before check...')
  const syncStart = Date.now()
  await wallet.sync()
  console.log(`[Unlink:Verify] Sync done in ${Date.now() - syncStart}ms`)

  const notes = await wallet.getNotes()
  console.log(`[Unlink:Verify] Got ${notes.length} notes in wallet`)

  // Log all notes for debugging
  notes.forEach((n: { txHash?: string; amount?: bigint; token?: string }, i: number) => {
    console.log(`[Unlink:Verify]   note[${i}]: txHash=${n.txHash?.slice(0, 16)}... amount=${n.amount?.toString()} token=${n.token}`)
  })

  // Find a note matching the txHash, amount, and token
  const match = notes.find((n: { txHash?: string; amount?: bigint; token?: string }) =>
    n.txHash === txHash &&
    n.amount === expectedAmount &&
    n.token?.toLowerCase() === token.toLowerCase()
  )

  if (match) {
    console.log(`[Unlink:Verify] MATCH FOUND on first attempt`)
    return { verified: true, note: match }
  }

  // Try matching just by txHash (amount might differ due to fees/rounding)
  const txMatch = notes.find((n: { txHash?: string }) => n.txHash === txHash)
  if (txMatch) {
    console.log(`[Unlink:Verify] txHash match found but amount/token mismatch:`, {
      noteAmount: (txMatch as { amount?: bigint }).amount?.toString(),
      expected: expectedAmount.toString(),
      noteToken: (txMatch as { token?: string }).token,
      expectedToken: token,
    })
  }

  // Retry once after a short delay (sync latency ~2s per Ainur)
  console.log('[Unlink:Verify] No match, retrying after 3s delay...')
  await new Promise(r => setTimeout(r, 3000))
  console.log('[Unlink:Verify] Re-syncing wallet...')
  await wallet.sync()

  const retryNotes = await wallet.getNotes()
  console.log(`[Unlink:Verify] Retry: got ${retryNotes.length} notes`)

  const retryMatch = retryNotes.find((n: { txHash?: string; amount?: bigint; token?: string }) =>
    n.txHash === txHash &&
    n.amount === expectedAmount &&
    n.token?.toLowerCase() === token.toLowerCase()
  )

  if (retryMatch) {
    console.log(`[Unlink:Verify] MATCH FOUND on retry`)
    return { verified: true, note: retryMatch }
  }

  console.warn(`[Unlink:Verify] TRANSFER NOT FOUND after retry`)
  console.warn(`[Unlink:Verify] Looking for txHash=${txHash} amount=${expectedAmount.toString()} token=${token}`)
  return { verified: false }
}

// Withdraw MON from privacy pool to server's public EOA
export async function withdrawFromPool(amountWei: bigint, recipientEOA: string) {
  const wallet = await getServerUnlinkWallet()
  return wallet.withdraw({
    withdrawals: [{
      token: MON_TOKEN,
      amount: amountWei,
      recipient: recipientEOA,
    }]
  })
}

// Get MON balance inside the Unlink privacy pool
export async function getPoolBalance(): Promise<bigint> {
  const wallet = await getServerUnlinkWallet()
  await wallet.sync()
  return wallet.getBalance(MON_TOKEN)
}
