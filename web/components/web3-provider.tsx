'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { BrowserProvider, JsonRpcSigner } from 'ethers'
import EthereumProvider from '@walletconnect/ethereum-provider'

// Monad configuration
const MONAD_CONFIG = {
  chainId: 143,
  chainName: 'Monad',
  rpcUrl: 'https://rpc.monad.xyz',
  blockExplorer: 'https://monadscan.com',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
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

interface Web3ContextType {
  address: string | null
  isConnected: boolean
  isConnecting: boolean
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  provider: BrowserProvider | null
  signer: JsonRpcSigner | null
}

const Web3Context = createContext<Web3ContextType>({
  address: null,
  isConnected: false,
  isConnecting: false,
  connect: async () => {},
  disconnect: async () => {},
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

  // Helper to restore session from provider
  const restoreSession = useCallback(async (ethereumProvider: InstanceType<typeof EthereumProvider>) => {
    try {
      const ethersProvider = new BrowserProvider(ethereumProvider)
      const accounts = await ethersProvider.listAccounts()
      if (accounts.length > 0) {
        console.log('[Web3] Session restored for:', accounts[0].address)
        setAddress(accounts[0].address)
        setProvider(ethersProvider)
        const signerInstance = await ethersProvider.getSigner()
        setSigner(signerInstance)
        return true
      }
    } catch (error) {
      console.error('[Web3] Failed to restore session:', error)
    }
    return false
  }, [])

  // Initialize provider on mount
  useEffect(() => {
    const init = async () => {
      try {
        console.log('[Web3] Initializing WalletConnect provider...')

        const ethereumProvider = await EthereumProvider.init({
          projectId: PROJECT_ID,
          chains: [MONAD_CONFIG.chainId],
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
          // Show recommended wallets including Uniswap Wallet
          qrModalOptions: {
            explorerRecommendedWalletIds: RECOMMENDED_WALLETS,
            enableExplorer: true,
          },
        })

        setWcProvider(ethereumProvider)
        setIsInitialized(true)

        // Check if session exists and restore it
        if (ethereumProvider.session) {
          console.log('[Web3] Found existing session, restoring...')
          await restoreSession(ethereumProvider)
        } else if (ethereumProvider.connected) {
          console.log('[Web3] Provider connected, restoring session...')
          await restoreSession(ethereumProvider)
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

        // Listen for disconnect
        ethereumProvider.on('disconnect', () => {
          console.log('[Web3] Disconnected')
          setAddress(null)
          setProvider(null)
          setSigner(null)
        })

        // Listen for session events
        ethereumProvider.on('session_delete', () => {
          console.log('[Web3] Session deleted')
          setAddress(null)
          setProvider(null)
          setSigner(null)
        })

      } catch (error) {
        console.error('[Web3] Failed to initialize WalletConnect:', error)
        setIsInitialized(true) // Still mark as initialized to avoid infinite loading
      }
    }

    init()
  }, [restoreSession])

  const connect = useCallback(async () => {
    if (!wcProvider) {
      console.error('WalletConnect provider not initialized')
      return
    }

    setIsConnecting(true)
    try {
      await wcProvider.connect()

      const ethersProvider = new BrowserProvider(wcProvider)
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
  }, [wcProvider])

  const disconnect = useCallback(async () => {
    if (wcProvider) {
      await wcProvider.disconnect()
    }
    setAddress(null)
    setProvider(null)
    setSigner(null)
  }, [wcProvider])

  return (
    <Web3Context.Provider
      value={{
        address,
        isConnected: !!address,
        isConnecting,
        connect,
        disconnect,
        provider,
        signer,
      }}
    >
      {children}
    </Web3Context.Provider>
  )
}
