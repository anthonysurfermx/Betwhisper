// Server-side Unlink wallet for receiving private transfers
// Uses memory storage (Vercel serverless has no persistent filesystem)
// Mnemonic stored in UNLINK_SERVER_MNEMONIC env var — wallet reconstructed on cold start

import { initWallet, type UnlinkWallet } from '@unlink-xyz/node'
import { MON_TOKEN } from './constants'

let serverWallet: UnlinkWallet | null = null

export async function getServerUnlinkWallet(): Promise<UnlinkWallet> {
  if (serverWallet) return serverWallet

  const mnemonic = process.env.UNLINK_SERVER_MNEMONIC
  if (!mnemonic) throw new Error('UNLINK_SERVER_MNEMONIC not set')

  // Memory storage is the default for @unlink-xyz/node — no SQLite needed
  const wallet = await initWallet({
    chain: 'monad-testnet',
    setup: false,
    sync: false,
  })

  // Import existing mnemonic and create account
  await wallet.seed.importMnemonic(mnemonic)
  await wallet.accounts.create()
  await wallet.sync()

  serverWallet = wallet
  console.log('[Unlink] Server wallet initialized')
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
  const wallet = await getServerUnlinkWallet()
  await wallet.sync()

  const notes = await wallet.getNotes()

  // Find a note matching the txHash, amount, and token
  const match = notes.find((n: { txHash?: string; amount?: bigint; token?: string }) =>
    n.txHash === txHash &&
    n.amount === expectedAmount &&
    n.token?.toLowerCase() === token.toLowerCase()
  )

  if (match) {
    console.log(`[Unlink] Transfer verified: txHash=${txHash}`)
    return { verified: true, note: match }
  }

  // Retry once after a short delay (sync latency ~2s per Ainur)
  await new Promise(r => setTimeout(r, 3000))
  await wallet.sync()

  const retryNotes = await wallet.getNotes()
  const retryMatch = retryNotes.find((n: { txHash?: string; amount?: bigint; token?: string }) =>
    n.txHash === txHash &&
    n.amount === expectedAmount &&
    n.token?.toLowerCase() === token.toLowerCase()
  )

  if (retryMatch) {
    console.log(`[Unlink] Transfer verified on retry: txHash=${txHash}`)
    return { verified: true, note: retryMatch }
  }

  console.warn(`[Unlink] Transfer NOT found: txHash=${txHash}`)
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
