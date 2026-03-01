'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { BrowserProvider, JsonRpcSigner, Network } from 'ethers'
import EthereumProvider from '@walletconnect/ethereum-provider'

// Monad Testnet configuration (Unlink privacy pool is on testnet)
const MONAD_CONFIG = {
  chainId: 10143,
  chainName: 'Monad Testnet',
  rpcUrl: 'https://testnet-rpc.monad.xyz',
  blockExplorer: 'https://testnet.monadscan.com',
  nativeCurrency: {
    name: 'MON',
    symbol: 'MON',
    decimals: 18,
  },
}

// WalletConnect Project ID (same as iOS app)
const PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '0c9c91473cd01a94bd2417f6fb1d5c9d'

// Wallet IDs from WalletConnect Explorer
const RECOMMENDED_WALLETS = [
  'c03dfee351b6fcc421b4494ea33b9d4b92a984f87aa76d1663bb28705e95f4be', // Uniswap Wallet
  'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
  '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369', // Rainbow
]

// Static network for Monad Testnet — prevents ethers.js from auto-detecting wrong chain
const MONAD_TESTNET_NETWORK = new Network(MONAD_CONFIG.chainName, MONAD_CONFIG.chainId)

// Helper to force wallet to Monad Testnet before any transaction
async function ensureTestnetChain(wcProv: InstanceType<typeof EthereumProvider>): Promise<boolean> {
  const chainHex = `0x${MONAD_CONFIG.chainId.toString(16)}`
  try {
    await wcProv.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainHex }],
    })
    return true
  } catch {
    try {
      await wcProv.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: chainHex,
          chainName: MONAD_CONFIG.chainName,
          rpcUrls: [MONAD_CONFIG.rpcUrl],
          blockExplorerUrls: [MONAD_CONFIG.blockExplorer],
          nativeCurrency: MONAD_CONFIG.nativeCurrency,
        }],
      })
      return true
    } catch (e) {
      console.error('[Web3] Failed to add/switch chain:', e)
      return false
    }
  }
}

interface Web3ContextType {
  address: string | null
  isConnected: boolean
  isConnecting: boolean
  wrongChain: boolean
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  switchToTestnet: () => Promise<boolean>
  provider: BrowserProvider | null
  signer: JsonRpcSigner | null
}

const Web3Context = createContext<Web3ContextType>({
  address: null,
  isConnected: false,
  isConnecting: false,
  wrongChain: false,
  connect: async () => {},
  disconnect: async () => {},
  switchToTestnet: async () => false,
  provider: null,
  signer: null,
})

export function useWeb3() {
  return useContext(Web3Context)
}

export function Web3Provider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [provider, setProvider] = useState<BrowserProvider | null>(null)
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null)
  const [wcProvider, setWcProvider] = useState<InstanceType<typeof EthereumProvider> | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [wrongChain, setWrongChain] = useState(false)

  // Create BrowserProvider with STATIC network to prevent ethers from auto-detecting wrong chain
  const createProvider = useCallback((ethereumProvider: InstanceType<typeof EthereumProvider>) => {
    return new BrowserProvider(ethereumProvider, MONAD_TESTNET_NETWORK)
  }, [])

  // Helper to restore session from provider
  const restoreSession = useCallback(async (ethereumProvider: InstanceType<typeof EthereumProvider>) => {
    try {
      const ethersProvider = createProvider(ethereumProvider)
      const accounts = await ethersProvider.listAccounts()
      if (accounts.length > 0) {
        console.log('[Web3] Session restored for:', accounts[0].address)
        setAddress(accounts[0].address)
        setProvider(ethersProvider)
        const signerInstance = await ethersProvider.getSigner()
        setSigner(signerInstance)
        setWrongChain(false)
        return true
      }
    } catch (error) {
      console.error('[Web3] Failed to restore session:', error)
    }
    return false
  }, [createProvider])

  // Helper to clear stale WC session data from localStorage
  const clearWcStorage = useCallback(() => {
    try {
      Object.keys(localStorage).filter(k =>
        k.startsWith('wc@') || k.startsWith('walletconnect') || k.startsWith('WCM_')
      ).forEach(k => localStorage.removeItem(k))
    } catch {}
  }, [])

  // Initialize provider on mount
  useEffect(() => {
    const init = async () => {
      try {
        console.log('[Web3] Initializing WalletConnect provider...')

        const ethereumProvider = await EthereumProvider.init({
          projectId: PROJECT_ID,
          chains: [MONAD_CONFIG.chainId],
          optionalChains: [MONAD_CONFIG.chainId],
          showQrModal: true,
          metadata: {
            name: 'BetWhisper',
            description: 'AI prediction markets on Polymarket',
            url: 'https://betwhisper.ai',
            icons: ['https://betwhisper.ai/icon.png'],
          },
          rpcMap: {
            [MONAD_CONFIG.chainId]: MONAD_CONFIG.rpcUrl,
          },
          qrModalOptions: {
            explorerRecommendedWalletIds: RECOMMENDED_WALLETS,
            enableExplorer: true,
          },
        })

        setWcProvider(ethereumProvider)
        setIsInitialized(true)
        console.log('[Web3] Provider initialized OK')

        // Check if session exists — but verify it's on the correct chain
        if (ethereumProvider.session || ethereumProvider.connected) {
          const sessionChainId = ethereumProvider.chainId
          console.log('[Web3] Found existing session, chainId:', sessionChainId, 'expected:', MONAD_CONFIG.chainId)

          if (sessionChainId && sessionChainId !== MONAD_CONFIG.chainId) {
            console.warn(`[Web3] Session on wrong chain (${sessionChainId}), disconnecting and clearing...`)
            try {
              await ethereumProvider.disconnect()
            } catch (e) {
              console.warn('[Web3] Disconnect error (ignored):', e)
            }
            // Only clear WC storage when we detect a wrong-chain session
            clearWcStorage()
          } else {
            console.log('[Web3] Session on correct chain, restoring...')
            await restoreSession(ethereumProvider)
          }
        }

        // Listen for account changes
        ethereumProvider.on('accountsChanged', (accounts: string[]) => {
          console.log('[Web3] Accounts changed:', accounts)
          if (accounts.length > 0) {
            setAddress(accounts[0])
          } else {
            setAddress(null)
            setProvider(null)
            setSigner(null)
          }
        })

        // Listen for chain changes — detect MetaMask switching to mainnet
        ethereumProvider.on('chainChanged', (chainIdHex: string) => {
          const newChainId = parseInt(chainIdHex, 16)
          console.log('[Web3] Chain changed to:', newChainId, 'expected:', MONAD_CONFIG.chainId)
          if (newChainId !== MONAD_CONFIG.chainId) {
            console.warn(`[Web3] WRONG CHAIN! Wallet switched to ${newChainId}`)
            setWrongChain(true)
            ensureTestnetChain(ethereumProvider).then(ok => {
              if (ok) setWrongChain(false)
            })
          } else {
            setWrongChain(false)
          }
        })

        // Listen for disconnect
        ethereumProvider.on('disconnect', () => {
          console.log('[Web3] Disconnected')
          setAddress(null)
          setProvider(null)
          setSigner(null)
          setWrongChain(false)
        })

        // Listen for session events
        ethereumProvider.on('session_delete', () => {
          console.log('[Web3] Session deleted')
          setAddress(null)
          setProvider(null)
          setSigner(null)
          setWrongChain(false)
        })

      } catch (error) {
        console.error('[Web3] Failed to initialize WalletConnect:', error)
        setIsInitialized(true)
      }
    }

    init()
  }, [restoreSession, createProvider, clearWcStorage])

  const switchToTestnet = useCallback(async (): Promise<boolean> => {
    if (!wcProvider) return false
    const ok = await ensureTestnetChain(wcProvider)
    if (ok) {
      setWrongChain(false)
      // Recreate provider/signer with correct chain
      const ethersProvider = createProvider(wcProvider)
      setProvider(ethersProvider)
      try {
        const signerInstance = await ethersProvider.getSigner()
        setSigner(signerInstance)
      } catch {}
    }
    return ok
  }, [wcProvider, createProvider])

  const connect = useCallback(async () => {
    if (!wcProvider) {
      console.error('WalletConnect provider not initialized')
      return
    }

    setIsConnecting(true)
    try {
      // Connect — this opens QR/deeplink
      await wcProvider.connect()

      // AGGRESSIVELY switch to testnet after connecting
      const connectedChainId = wcProvider.chainId
      console.log('[Web3] Connected on chainId:', connectedChainId, 'expected:', MONAD_CONFIG.chainId)

      if (connectedChainId !== MONAD_CONFIG.chainId) {
        console.log('[Web3] Requesting chain switch to', MONAD_CONFIG.chainId)
        const switched = await ensureTestnetChain(wcProvider)
        if (!switched) {
          console.error('[Web3] Could not switch to testnet. User must switch manually in MetaMask.')
          setWrongChain(true)
        } else {
          setWrongChain(false)
        }
      }

      // Create provider with STATIC network to force all txs to chainId 10143
      const ethersProvider = createProvider(wcProvider)
      const accounts = await ethersProvider.listAccounts()

      if (accounts.length > 0) {
        setAddress(accounts[0].address)
        setProvider(ethersProvider)
        const signerInstance = await ethersProvider.getSigner()
        setSigner(signerInstance)
      }
    } catch (error) {
      console.error('Failed to connect:', error)
    } finally {
      setIsConnecting(false)
    }
  }, [wcProvider, createProvider])

  const disconnect = useCallback(async () => {
    if (wcProvider) {
      try {
        await wcProvider.disconnect()
      } catch {}
    }
    clearWcStorage()
    setAddress(null)
    setProvider(null)
    setSigner(null)
    setWrongChain(false)
  }, [wcProvider, clearWcStorage])

  return (
    <Web3Context.Provider
      value={{
        address,
        isConnected: !!address,
        isConnecting,
        wrongChain,
        connect,
        disconnect,
        switchToTestnet,
        provider,
        signer,
      }}
    >
      {children}
    </Web3Context.Provider>
  )
}
