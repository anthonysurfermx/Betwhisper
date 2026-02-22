/**
 * One-time Polymarket setup script
 * Run with: npx tsx scripts/setup-polymarket.ts
 *
 * Prerequisites:
 * - POLYMARKET_PRIVATE_KEY env var set (Polygon wallet with USDC.e + POL)
 *
 * This script:
 * 1. Derives API credentials from the wallet
 * 2. Approves USDC.e for 3 Polymarket exchange contracts
 * 3. Approves CTF (ERC-1155) for 3 Polymarket exchange contracts
 * 4. Prints wallet balance and confirmation
 */

import { Wallet } from '@ethersproject/wallet'
import { JsonRpcProvider } from '@ethersproject/providers'
import { Contract } from '@ethersproject/contracts'
import { ClobClient } from '@polymarket/clob-client'

const POLYGON_RPC = 'https://polygon-rpc.com'
const CHAIN_ID = 137

// Polymarket contracts on Polygon
const USDC = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
const CTF = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045'
const EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E'
const NEG_RISK_EXCHANGE = '0xC5d563A36AE78145C45a50134d48A1215220f80a'
const NEG_RISK_ADAPTER = '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296'

const MAX_UINT256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
const TARGETS = [EXCHANGE, NEG_RISK_EXCHANGE, NEG_RISK_ADAPTER]

async function main() {
  const pk = process.env.POLYMARKET_PRIVATE_KEY
  if (!pk) {
    console.error('Set POLYMARKET_PRIVATE_KEY env var first')
    process.exit(1)
  }

  const provider = new JsonRpcProvider(POLYGON_RPC)
  const wallet = new Wallet(pk, provider)
  console.log(`Wallet: ${wallet.address}`)

  // Check balances
  const polBalance = await provider.getBalance(wallet.address)
  console.log(`POL balance: ${(parseFloat(polBalance.toString()) / 1e18).toFixed(4)} POL`)

  const usdc = new Contract(USDC, [
    'function balanceOf(address) view returns (uint256)',
    'function approve(address,uint256) returns (bool)',
    'function allowance(address,address) view returns (uint256)',
  ], wallet)

  const usdcBalance = await usdc.balanceOf(wallet.address)
  console.log(`USDC.e balance: $${(parseFloat(usdcBalance.toString()) / 1e6).toFixed(2)}`)

  if (parseFloat(polBalance.toString()) < 1e16) {
    console.error('Need at least 0.01 POL for gas')
    process.exit(1)
  }

  // Step 1: Derive API credentials
  console.log('\n--- Step 1: Derive API Credentials ---')
  const signer = new Wallet(pk)
  const client = new ClobClient('https://clob.polymarket.com', CHAIN_ID, signer)
  const creds = await client.createOrDeriveApiKey()
  console.log(`API Key: ${creds.key.substring(0, 12)}...`)
  console.log(`Passphrase: ${creds.passphrase.substring(0, 8)}...`)
  console.log('Credentials derived successfully')

  // Step 2: Approve USDC.e for exchange contracts
  console.log('\n--- Step 2: Approve USDC.e ---')
  const gasOptions = { gasPrice: 50_000_000_000, gasLimit: 100_000 }

  for (const target of TARGETS) {
    const allowance = await usdc.allowance(wallet.address, target)
    if (allowance.gt(0)) {
      console.log(`USDC already approved for ${target.substring(0, 10)}...`)
    } else {
      console.log(`Approving USDC for ${target.substring(0, 10)}...`)
      const tx = await usdc.approve(target, MAX_UINT256, gasOptions)
      await tx.wait()
      console.log(`  tx: ${tx.hash}`)
    }
  }

  // Step 3: Approve CTF (ERC-1155) for exchange contracts
  console.log('\n--- Step 3: Approve CTF (Conditional Tokens) ---')
  const ctf = new Contract(CTF, [
    'function isApprovedForAll(address,address) view returns (bool)',
    'function setApprovalForAll(address,bool)',
  ], wallet)

  for (const target of TARGETS) {
    const approved = await ctf.isApprovedForAll(wallet.address, target)
    if (approved) {
      console.log(`CTF already approved for ${target.substring(0, 10)}...`)
    } else {
      console.log(`Approving CTF for ${target.substring(0, 10)}...`)
      const tx = await ctf.setApprovalForAll(target, true, gasOptions)
      await tx.wait()
      console.log(`  tx: ${tx.hash}`)
    }
  }

  // Step 4: Verify setup
  console.log('\n--- Setup Complete ---')
  console.log(`Wallet: ${wallet.address}`)
  console.log(`USDC.e: $${(parseFloat(usdcBalance.toString()) / 1e6).toFixed(2)}`)
  console.log(`API Key: ${creds.key.substring(0, 12)}...`)
  console.log('\nAdd to Vercel:')
  console.log(`  POLYMARKET_PRIVATE_KEY=${pk}`)
  console.log('  POLYGON_RPC_URL=https://polygon-rpc.com')
  console.log('\nReady to execute real Polymarket orders!')
}

main().catch(console.error)
