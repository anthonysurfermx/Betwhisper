// Server-side Unlink wallet for receiving private transfers
// Uses memory storage (Vercel serverless has no persistent filesystem)
// Mnemonic stored in UNLINK_SERVER_MNEMONIC env var — wallet reconstructed on cold start

import { initWallet, waitForConfirmation, type TxStatus, type UnlinkWallet } from '@unlink-xyz/node'
import { MON_TOKEN, UNLINK_TRANSFER_TIMEOUT_MS } from './constants'

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

// Verify a specific relay transaction by ID — NOT balance check (prevents race conditions)
// Returns TxStatus with state 'succeeded' on success, throws on failure/timeout
export async function verifyUnlinkTransfer(relayId: string): Promise<TxStatus> {
  const wallet = await getServerUnlinkWallet()
  await wallet.sync()

  // Quick check: RelayStatusResponse { id, state, txHash, receipt, error }
  const status = await wallet.getTxStatus(relayId)
  if (status.state === 'succeeded') {
    return {
      txId: relayId,
      state: status.state,
      txHash: status.txHash ?? undefined,
    }
  }

  // Not yet confirmed — poll until terminal state (throws TimeoutError or TransactionFailedError)
  return waitForConfirmation(wallet, relayId, {
    timeout: UNLINK_TRANSFER_TIMEOUT_MS,
    pollInterval: 2000,
  })
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
