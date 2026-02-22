'use client'

import { useWeb3 } from '@/components/web3-provider'
import { QRCodeSVG } from 'qrcode.react'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Wallet, Copy, Check, QrCode, LogOut, RefreshCw, ExternalLink, Bell, BellOff, Volume2, VolumeX, BarChart3, Download, Users, ChevronDown, ChevronUp, Link2 } from 'lucide-react'

const MONAD_EXPLORER = 'https://monadscan.com'
const POLLING_INTERVAL = 5000 // 5 seconds — faster for demo UX
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://voiceswap.vercel.app'

interface Transaction {
  hash: string
  from: string
  to: string
  value: string
  timestamp: number
  blockNumber: number
  concept?: string
}

interface WalletBalance {
  nativeMON: { symbol: string; balance: string }
  tokens: { symbol: string; balance: string }[]
  totalUSDC: string
  totalUSD: string
  monPriceUSD: number
}

interface NewPaymentToast {
  id: string
  value: string
  from: string
  hash: string
}

interface MerchantStats {
  totalPayments: number
  totalAmount: string
  uniquePayers: number
  conceptBreakdown: { concept: string; count: number; total: string }[]
}

export default function ReceivePage() {
  const { address, isConnected, isConnecting, connect, disconnect } = useWeb3()
  const [amount, setAmount] = useState('')
  const [concept, setConcept] = useState('')
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loadingTxs, setLoadingTxs] = useState(false)
  const [txError, setTxError] = useState<string | null>(null)

  // Notification states
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')
  const [toasts, setToasts] = useState<NewPaymentToast[]>([])
  const [isPolling, setIsPolling] = useState(false)
  const [stats, setStats] = useState<MerchantStats | null>(null)
  const [showStats, setShowStats] = useState(false)
  const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(null)
  const [mxnRate, setMxnRate] = useState<number | null>(null)
  const [showMXN, setShowMXN] = useState(false)
  const [expandedTx, setExpandedTx] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  // Refs for tracking
  const lastKnownTxHash = useRef<string | null>(null)
  const knownTxHashes = useRef<Set<string>>(new Set())
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize audio
  useEffect(() => {
    // Create audio element for payment notification sound
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkJWTjHhpZG6Ck5yklYZ1aW59kJ6jnI57bWt4iZqjo5iIeW9xfYycp6OWhXRtcoCSnqadkIJ1bnODlaKonpGDeXBxgZWipZ2QgnhwcYKWpKadk4N5cHCAmKWmm5GCeHFvf5ilpZuRgndxb3+YpaijkYF3cXB/mKamo5GCeHFwgJilpaORgnhxcICYpaWjkoJ4cXCAmKWlo5KCeHFwgJilpaOSgnhxcICYpaWjkoJ4cXCAmKWlo5KCeHFwgJilpaOSgnhxcA==')
    audioRef.current.volume = 0.5

    // Check notification permission
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission)
      if (Notification.permission === 'granted') {
        setNotificationsEnabled(true)
      }
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  // Load settings from localStorage
  useEffect(() => {
    const savedConcept = localStorage.getItem('voiceswap_concept')
    if (savedConcept) setConcept(savedConcept)

    const savedSound = localStorage.getItem('voiceswap_sound')
    if (savedSound !== null) setSoundEnabled(savedSound === 'true')
  }, [])

  // Save concept to localStorage
  const handleConceptChange = (value: string) => {
    setConcept(value)
    localStorage.setItem('voiceswap_concept', value)
  }

  // Toggle sound
  const toggleSound = () => {
    const newValue = !soundEnabled
    setSoundEnabled(newValue)
    localStorage.setItem('voiceswap_sound', String(newValue))
  }

  // Request notification permission
  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('This browser does not support notifications')
      return
    }

    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)
    setNotificationsEnabled(permission === 'granted')
  }

  // Play notification sound
  const playNotificationSound = () => {
    if (soundEnabled && audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {
        // Ignore autoplay errors
      })
    }
  }

  // Show browser notification
  const showBrowserNotification = (tx: Transaction) => {
    if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification('Payment Received!', {
        body: `+$${tx.value} USDC from ${tx.from.slice(0, 8)}...${tx.from.slice(-4)}`,
        icon: '/icon.png',
        tag: tx.hash,
        requireInteraction: false
      })

      notification.onclick = () => {
        window.open(`${MONAD_EXPLORER}/tx/${tx.hash}`, '_blank')
        notification.close()
      }

      setTimeout(() => notification.close(), 5000)
    }
  }

  // Show toast notification
  const showToast = (tx: Transaction) => {
    const toast: NewPaymentToast = {
      id: tx.hash,
      value: tx.value,
      from: tx.from,
      hash: tx.hash
    }

    setToasts(prev => [toast, ...prev])

    // Auto-remove after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toast.id))
    }, 5000)
  }

  // Save payment to backend with concept
  const savePaymentToBackend = async (tx: Transaction, paymentConcept: string) => {
    try {
      await fetch(`${API_BASE}/voiceswap/merchant/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantWallet: address,
          txHash: tx.hash,
          fromAddress: tx.from,
          amount: tx.value,
          concept: paymentConcept || undefined,
          blockNumber: tx.blockNumber,
        }),
      })
      console.log('[VoiceSwap] Payment saved to backend:', tx.hash)
    } catch (err) {
      console.error('[VoiceSwap] Failed to save payment:', err)
    }
  }

  // Handle new payment detection
  const handleNewPayment = (tx: Transaction) => {
    playNotificationSound()
    showBrowserNotification(tx)
    showToast(tx)
    // Save to backend with current concept
    savePaymentToBackend(tx, concept)
  }

  // Fetch merchant stats
  const fetchStats = async () => {
    if (!address) return
    try {
      const res = await fetch(`${API_BASE}/voiceswap/merchant/stats/${address}`)
      const data = await res.json()
      if (data.success) {
        setStats(data.data)
      }
    } catch (err) {
      console.error('[VoiceSwap] Failed to fetch stats:', err)
    }
  }

  // Fetch wallet balance from backend
  const fetchBalance = async () => {
    if (!address) return
    try {
      const res = await fetch(`${API_BASE}/voiceswap/balance/${address}`)
      const data = await res.json()
      if (data.success && data.data?.nativeMON) {
        setWalletBalance(data.data)
      }
    } catch (err) {
      console.error('[VoiceSwap] Failed to fetch balance:', err)
    }
  }

  // Fetch USD/MXN exchange rate
  const fetchMXNRate = async () => {
    try {
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD')
      const data = await res.json()
      if (data.rates?.MXN) {
        setMxnRate(data.rates.MXN)
      }
    } catch (err) {
      console.error('[VoiceSwap] Failed to fetch MXN rate:', err)
    }
  }

  // Format currency display
  const formatBalance = (usdValue: string | number) => {
    const usd = typeof usdValue === 'string' ? parseFloat(usdValue) : usdValue
    if (showMXN && mxnRate) {
      return `$${(usd * mxnRate).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`
    }
    return `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
  }

  // Export to CSV
  const exportToCSV = () => {
    if (transactions.length === 0) return

    const headers = ['Amount (USDC)', 'From', 'Concept', 'Transaction Hash', 'Block']
    const rows = transactions.map(tx => [
      tx.value,
      tx.from,
      tx.concept || '',
      tx.hash,
      tx.blockNumber.toString()
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `voiceswap-payments-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }


  // Fetch transactions from Blockscout API (more reliable than RPC)
  const fetchTransactions = useCallback(async (silent = false) => {
    if (!address) return

    if (!silent) {
      setLoadingTxs(true)
      setTxError(null)
    }

    try {
      // Fetch from our API — now uses database (saved by iOS app after each payment)
      const apiResponse = await fetch(`${API_BASE}/voiceswap/merchant/transactions/${address}`)
      const apiData = await apiResponse.json()

      if (!apiData.success) {
        throw new Error(apiData.error || 'Failed to fetch transactions')
      }

      const txs: Transaction[] = (apiData.data?.transactions || []).map((tx: {
        txHash: string
        fromAddress: string
        amount: string
        timestamp: string
        blockNumber: number
        concept?: string
      }) => ({
        hash: tx.txHash,
        from: tx.fromAddress,
        to: address,
        value: tx.amount,
        timestamp: new Date(tx.timestamp).getTime(),
        blockNumber: tx.blockNumber,
        concept: tx.concept || undefined
      }))

      // Check for new transactions using ref (avoids stale closure)
      if (txs.length > 0 && knownTxHashes.current.size > 0) {
        const newTxs = txs.filter(tx => !knownTxHashes.current.has(tx.hash))
        newTxs.forEach(tx => handleNewPayment(tx))
      }

      // Update known hashes ref
      knownTxHashes.current = new Set(txs.map(tx => tx.hash))
      if (txs.length > 0) {
        lastKnownTxHash.current = txs[0].hash
      }

      setTransactions(txs.slice(0, 10))

    } catch (err) {
      console.error('[VoiceSwap] Error fetching transactions:', err)
      if (!silent) {
        setTxError(err instanceof Error ? err.message : 'Failed to load transactions')
      }
    } finally {
      if (!silent) {
        setLoadingTxs(false)
      }
    }
  }, [address])

  // Start/stop polling
  useEffect(() => {
    if (address && isConnected && showQR) {
      // Start polling when QR is shown
      setIsPolling(true)
      fetchTransactions()

      pollingIntervalRef.current = setInterval(() => {
        fetchTransactions(true) // Silent fetch
        fetchBalance() // Refresh balance too
      }, POLLING_INTERVAL)
    } else {
      // Stop polling
      setIsPolling(false)
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [address, isConnected, showQR, fetchTransactions])

  // Initial fetch when connected
  useEffect(() => {
    if (address && isConnected) {
      fetchTransactions()
      fetchBalance()
      fetchMXNRate()
    }
  }, [address, isConnected])

  const paymentUrl = address || ''
  const webUrl = address
    ? `https://voiceswap.cc/pay/${address}${amount ? `?amount=${amount}` : ''}${concept ? `${amount ? '&' : '?'}name=${encodeURIComponent(concept)}` : ''}`
    : ''

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const copyPaymentLink = () => {
    if (webUrl) {
      navigator.clipboard.writeText(webUrl)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    }
  }

  // Calculate today's total
  const todayTotal = transactions
    .filter(tx => {
      const today = new Date()
      const txDate = new Date(tx.timestamp)
      return txDate.getFullYear() === today.getFullYear() &&
        txDate.getMonth() === today.getMonth() &&
        txDate.getDate() === today.getDate()
    })
    .reduce((sum, tx) => sum + parseFloat(tx.value), 0)

  const todayCount = transactions.filter(tx => {
    const today = new Date()
    const txDate = new Date(tx.timestamp)
    return txDate.getFullYear() === today.getFullYear() &&
      txDate.getMonth() === today.getMonth() &&
      txDate.getDate() === today.getDate()
  }).length

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="bg-black text-white p-4 rounded-sm shadow-lg animate-slide-in flex items-center gap-4 min-w-[300px]"
            onClick={() => dismissToast(toast.id)}
          >
            <div className="w-12 h-12 bg-[#836EF9] rounded-full flex items-center justify-center flex-shrink-0">
              <Check className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-bold tracking-[0.1em] uppercase font-mono text-white/40">
                PAYMENT RECEIVED
              </p>
              <p className="text-xl font-bold text-[#836EF9]">
                +${toast.value} USDC
                {showMXN && mxnRate && (
                  <span className="text-sm text-white/40 ml-2">
                    ≈ ${(parseFloat(toast.value) * mxnRate).toFixed(2)} MXN
                  </span>
                )}
              </p>
              <p className="text-xs text-white/40 font-mono">
                From {toast.from.slice(0, 8)}...{toast.from.slice(-4)}
              </p>
            </div>
            <a
              href={`${MONAD_EXPLORER}/tx/${toast.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#836EF9] hover:underline text-xs font-mono font-bold tracking-wider"
              onClick={(e) => e.stopPropagation()}
            >
              RECEIPT
            </a>
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-2 h-2 bg-[#836EF9] rounded-full" />
              <span className="text-xs font-bold tracking-[0.2em] uppercase font-mono text-white">
                VOICESWAP
              </span>
            </Link>
            {isConnected && (
              <div className="flex items-center gap-2">
                {/* Sound toggle */}
                <button
                  onClick={toggleSound}
                  className={`p-2 rounded-sm transition-colors ${soundEnabled ? 'text-[#836EF9]' : 'text-white/40'}`}
                  title={soundEnabled ? 'Sound on' : 'Sound off'}
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>

                {/* Notification toggle */}
                <button
                  onClick={requestNotificationPermission}
                  className={`p-2 rounded-sm transition-colors ${notificationsEnabled ? 'text-[#836EF9]' : 'text-white/40'}`}
                  title={notificationsEnabled ? 'Notifications on' : 'Enable notifications'}
                >
                  {notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => disconnect()}
                  className="px-3 py-1.5 text-[11px] font-bold tracking-[0.1em] uppercase font-mono text-white/40 hover:text-red-400 transition-colors flex items-center gap-2"
                >
                  <LogOut className="w-3 h-3" />
                  DISCONNECT
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto px-6 py-12">
        <div className="space-y-8">
          {/* Page Header */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-2 h-2 rounded-full ${isPolling ? 'bg-[#836EF9] animate-pulse' : 'bg-[#836EF9]'}`} />
              <span className="text-[11px] font-bold tracking-[0.2em] uppercase font-mono text-white">
                {isPolling ? 'LISTENING FOR PAYMENTS' : 'RECEIVE'}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Receive Payments
            </h1>
            <p className="text-sm text-white/40 mt-2">
              Generate a QR code to receive USDC on Monad
            </p>
          </div>

          {!isConnected ? (
            /* Not Connected */
            <div className="space-y-6">
              <div className="p-8 border border-white/10 rounded-sm">
                <div className="text-center space-y-4">
                  <div className="w-12 h-12 bg-[#836EF9]/20 rounded-sm flex items-center justify-center mx-auto">
                    <Wallet className="w-6 h-6 text-white" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="font-bold text-white">Connect Wallet</p>
                    <p className="text-sm text-white/40 mt-1">
                      Link your wallet to generate a payment QR code
                    </p>
                  </div>
                  <button
                    onClick={() => connect()}
                    disabled={isConnecting}
                    className="w-full px-6 py-3 bg-[#836EF9] text-white text-[11px] font-bold tracking-[0.1em] uppercase font-mono hover:bg-[#A18FFF] transition-colors disabled:opacity-50"
                  >
                    {isConnecting ? 'CONNECTING...' : 'CONNECT WALLET'}
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-white/30 font-mono text-center">
                Supports WalletConnect wallets on Monad
              </p>
            </div>
          ) : !showQR ? (
            /* Connected - Setup */
            <div className="space-y-6">
              {/* Connection Status */}
              <div className="flex items-center justify-between p-4 border border-white/10 rounded-sm">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-[#836EF9] rounded-full animate-pulse" />
                  <div>
                    <p className="text-[11px] font-bold tracking-[0.1em] uppercase font-mono text-white/40">
                      CONNECTED
                    </p>
                    <button
                      onClick={copyAddress}
                      className="text-sm font-mono text-white hover:text-[#836EF9] transition-colors flex items-center gap-1"
                    >
                      {address?.slice(0, 8)}...{address?.slice(-6)}
                      {copied ? <Check className="w-3 h-3 text-[#836EF9]" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Wallet Balance */}
              {walletBalance && walletBalance.nativeMON && (
                <div className="p-4 border border-white/10 rounded-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold tracking-[0.1em] uppercase font-mono text-white/40">
                      BALANCE
                    </span>
                    <button
                      onClick={() => setShowMXN(!showMXN)}
                      className="text-[10px] font-bold tracking-[0.05em] uppercase font-mono px-2 py-0.5 border border-white/20 rounded-sm text-white/40 hover:border-[#836EF9] hover:text-[#836EF9] transition-colors"
                    >
                      {showMXN ? 'USD' : 'MXN'}
                    </button>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {formatBalance(walletBalance.totalUSD)}
                  </p>
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-mono text-white/40">MON</span>
                      <span className="font-mono text-white">{parseFloat(walletBalance.nativeMON.balance || '0').toFixed(4)}</span>
                    </div>
                    {(walletBalance.tokens || []).map((token) => (
                      <div key={token.symbol} className="flex items-center justify-between text-sm">
                        <span className="font-mono text-white/40">{token.symbol}</span>
                        <span className="font-mono text-white">{parseFloat(token.balance || '0').toFixed(token.symbol === 'USDC' ? 2 : 4)}</span>
                      </div>
                    ))}
                  </div>
                  {walletBalance.monPriceUSD > 0 && (
                    <p className="text-[10px] text-white/30 font-mono mt-2">
                      1 MON = {showMXN && mxnRate
                        ? `$${(walletBalance.monPriceUSD * mxnRate).toFixed(2)} MXN`
                        : `$${walletBalance.monPriceUSD.toFixed(2)} USD`}
                    </p>
                  )}
                </div>
              )}

              {/* Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold tracking-[0.1em] uppercase font-mono text-white/40 mb-2">
                    CONCEPT (OPTIONAL)
                  </label>
                  <input
                    type="text"
                    value={concept}
                    onChange={(e) => handleConceptChange(e.target.value)}
                    placeholder="e.g. Coffee, Lunch, Services"
                    className="w-full px-4 py-3 bg-transparent border border-white/10 text-sm font-mono text-white focus:outline-none focus:border-[#836EF9] placeholder:text-white/30"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold tracking-[0.1em] uppercase font-mono text-white/40 mb-2">
                    AMOUNT IN USDC (OPTIONAL)
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 25.00"
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-3 bg-transparent border border-white/10 text-sm font-mono text-white focus:outline-none focus:border-[#836EF9] placeholder:text-white/30"
                  />
                </div>

                <button
                  onClick={() => setShowQR(true)}
                  className="w-full px-6 py-3 bg-[#836EF9] text-white text-[11px] font-bold tracking-[0.1em] uppercase font-mono hover:bg-[#A18FFF] transition-colors flex items-center justify-center gap-2"
                >
                  <QrCode className="w-4 h-4" />
                  GENERATE QR CODE
                </button>
              </div>
            </div>
          ) : (
            /* Show QR Code */
            <div className="space-y-6">
              {/* Hero Balance — big and prominent like a POS terminal */}
              <div className="p-8 bg-black rounded-sm text-center">
                <p className="text-[11px] font-bold tracking-[0.2em] uppercase font-mono text-white/40 mb-2">
                  MERCHANT BALANCE
                </p>
                <p className="text-5xl font-bold text-[#836EF9] tabular-nums">
                  {walletBalance ? formatBalance(walletBalance.totalUSD) : '$—'}
                </p>
                {walletBalance && (
                  <div className="mt-4 flex items-center justify-center gap-4">
                    {(walletBalance.tokens || []).filter(t => t.symbol === 'USDC').map(token => (
                      <span key={token.symbol} className="text-sm font-mono text-white">
                        {parseFloat(token.balance || '0').toFixed(2)} USDC
                      </span>
                    ))}
                    <span className="text-sm font-mono text-white/40">
                      {parseFloat(walletBalance.nativeMON?.balance || '0').toFixed(4)} MON
                    </span>
                    <button
                      onClick={() => setShowMXN(!showMXN)}
                      className="text-[10px] font-bold tracking-[0.05em] uppercase font-mono px-2 py-0.5 border border-white/20 rounded-sm text-white/40 hover:border-[#836EF9] hover:text-[#836EF9] transition-colors"
                    >
                      {showMXN ? 'USD' : 'MXN'}
                    </button>
                  </div>
                )}
                <div className="mt-3 flex items-center justify-center gap-2">
                  <div className="w-2 h-2 bg-[#836EF9] rounded-full animate-pulse" />
                  <span className="text-[11px] font-bold tracking-[0.1em] uppercase font-mono text-[#836EF9]">
                    LISTENING FOR PAYMENTS
                  </span>
                </div>
              </div>

              {/* QR Code Card */}
              <div className="p-8 border border-white/10 rounded-sm text-center">
                <div className="inline-block p-4 bg-white border border-white/10">
                  <QRCodeSVG
                    value={paymentUrl}
                    size={200}
                    level="H"
                    marginSize={2}
                  />
                </div>
                <p className="mt-4 font-bold text-white">
                  {concept || 'Scan to Pay'}
                  {amount && <span className="text-[#836EF9]"> · ${amount} USDC</span>}
                </p>
                <p className="mt-2 text-[11px] text-white/40 font-mono">
                  {address?.slice(0, 12)}...{address?.slice(-10)}
                </p>
              </div>

              {/* Instructions */}
              <div className="p-4 bg-white/5 rounded-sm">
                <p className="text-[11px] font-bold tracking-[0.1em] uppercase font-mono text-white/40 mb-3">
                  HOW CUSTOMERS PAY
                </p>
                <ol className="text-sm text-white/40 space-y-2">
                  <li className="flex gap-2">
                    <span className="text-[#836EF9] font-bold">1.</span>
                    Open any crypto wallet (Zerion, MetaMask, Rainbow)
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#836EF9] font-bold">2.</span>
                    Scan this QR code
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#836EF9] font-bold">3.</span>
                    Confirm {amount ? `$${amount} USDC` : 'USDC'} payment on Monad
                  </li>
                </ol>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowQR(false)}
                  className="flex-1 px-4 py-3 border border-white/10 text-white text-[11px] font-bold tracking-[0.1em] uppercase font-mono hover:border-white/40 transition-colors"
                >
                  EDIT
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`💳 Paga con VoiceSwap\n\n${concept ? `Concepto: ${concept}\n` : ''}${amount ? `Monto: $${amount} USDC\n` : ''}Red: Monad\nToken: USDC\n\nWallet:\n${address}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-4 py-3 bg-[#25D366] text-white text-[11px] font-bold tracking-[0.1em] uppercase font-mono hover:bg-[#1DA851] transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WHATSAPP
                </a>
              </div>

              {/* Copy Payment Link */}
              <button
                onClick={copyPaymentLink}
                className="w-full px-4 py-3 border border-white/10 text-white/40 text-[11px] font-bold tracking-[0.1em] uppercase font-mono hover:border-[#836EF9] hover:text-[#836EF9] transition-colors flex items-center justify-center gap-2"
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                {copiedLink ? 'LINK COPIED' : 'COPY PAYMENT LINK'}
              </button>
            </div>
          )}

          {/* Stats Dashboard */}
          {isConnected && (
            <div className="pt-8 border-t border-white/10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#836EF9] rounded-full" />
                  <span className="text-[11px] font-bold tracking-[0.2em] uppercase font-mono text-white">
                    DASHBOARD
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={exportToCSV}
                    disabled={transactions.length === 0}
                    className="p-1.5 hover:bg-white/5 transition-colors disabled:opacity-50"
                    title="Export CSV"
                  >
                    <Download className="w-4 h-4 text-white/40" />
                  </button>
                  <button
                    onClick={() => {
                      setShowStats(!showStats)
                      if (!stats) fetchStats()
                    }}
                    className={`p-1.5 hover:bg-white/5 transition-colors ${showStats ? 'bg-[#836EF9]/10' : ''}`}
                    title="Toggle stats"
                  >
                    <BarChart3 className={`w-4 h-4 ${showStats ? 'text-[#836EF9]' : 'text-white/40'}`} />
                  </button>
                </div>
              </div>

              {/* Stats Cards */}
              {showStats && stats && (
                <div className="mb-6 space-y-4">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-4 border border-white/10 rounded-sm text-center">
                      <p className="text-2xl font-bold text-[#836EF9]">{formatBalance(stats.totalAmount)}</p>
                      <p className="text-[10px] font-bold tracking-[0.1em] uppercase font-mono text-white/40 mt-1">
                        TOTAL
                      </p>
                    </div>
                    <div className="p-4 border border-white/10 rounded-sm text-center">
                      <p className="text-2xl font-bold text-white">{stats.totalPayments}</p>
                      <p className="text-[10px] font-bold tracking-[0.1em] uppercase font-mono text-white/40 mt-1">
                        PAYMENTS
                      </p>
                    </div>
                    <div className="p-4 border border-white/10 rounded-sm text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="w-5 h-5 text-white/40" />
                        <p className="text-2xl font-bold text-white">{stats.uniquePayers}</p>
                      </div>
                      <p className="text-[10px] font-bold tracking-[0.1em] uppercase font-mono text-white/40 mt-1">
                        PAYERS
                      </p>
                    </div>
                  </div>

                  {/* Concept Breakdown */}
                  {stats.conceptBreakdown.length > 0 && (
                    <div className="border border-white/10 rounded-sm">
                      <div className="p-3 border-b border-white/10">
                        <p className="text-[10px] font-bold tracking-[0.1em] uppercase font-mono text-white/40">
                          BY CONCEPT
                        </p>
                      </div>
                      <div className="divide-y divide-white/10">
                        {stats.conceptBreakdown.map((item, idx) => (
                          <div key={idx} className="p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-[#836EF9]/10 text-[10px] font-bold tracking-[0.05em] uppercase font-mono text-white rounded-sm">
                                {item.concept}
                              </span>
                              <span className="text-[11px] text-white/40 font-mono">
                                {item.count} {item.count === 1 ? 'payment' : 'payments'}
                              </span>
                            </div>
                            <p className="font-bold text-[#836EF9]">${item.total}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Loading stats */}
              {showStats && !stats && (
                <div className="mb-6 p-8 border border-white/10 rounded-sm text-center">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-white/40" />
                  <p className="text-sm text-white/40 mt-2">Loading stats...</p>
                </div>
              )}
            </div>
          )}

          {/* Transaction History */}
          {isConnected && (
            <div className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full" />
                  <span className="text-[11px] font-bold tracking-[0.2em] uppercase font-mono text-white">
                    RECENT PAYMENTS
                  </span>
                </div>
                <button
                  onClick={() => fetchTransactions()}
                  disabled={loadingTxs}
                  className="p-1.5 hover:bg-white/5 transition-colors disabled:opacity-50"
                  title="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 text-white/40 ${loadingTxs ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Today's Summary */}
              {transactions.length > 0 && todayCount > 0 && (
                <div className="mb-4 p-4 border border-[#836EF9]/20 bg-[#836EF9]/5 rounded-sm flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.1em] uppercase font-mono text-white/40">TODAY</p>
                    <p className="text-2xl font-bold text-[#836EF9] tabular-nums">
                      {formatBalance(todayTotal)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white tabular-nums">{todayCount}</p>
                    <p className="text-[10px] font-bold tracking-[0.1em] uppercase font-mono text-white/40">
                      {todayCount === 1 ? 'PAYMENT' : 'PAYMENTS'}
                    </p>
                  </div>
                </div>
              )}

              <div className="border border-white/10 rounded-sm">
                {loadingTxs ? (
                  <div className="p-8 text-center">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-white/40" />
                    <p className="text-sm text-white/40 mt-2">Loading...</p>
                  </div>
                ) : txError ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-red-500">{txError}</p>
                    <button
                      onClick={() => fetchTransactions()}
                      className="mt-2 text-sm text-[#836EF9] hover:underline"
                    >
                      Try again
                    </button>
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-white/40">No payments received yet</p>
                    <p className="text-[11px] text-white/40 mt-1 font-mono">
                      Payments will appear here
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/10">
                    {transactions.map((tx, index) => (
                      <div key={tx.hash + index} className="transition-colors">
                        <button
                          onClick={() => setExpandedTx(expandedTx === tx.hash ? null : tx.hash)}
                          className="w-full p-4 hover:bg-white/5 text-left"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-[#836EF9]">+${tx.value} USDC</p>
                                {showMXN && mxnRate && (
                                  <span className="text-[11px] text-white/40 font-mono">
                                    ≈ ${(parseFloat(tx.value) * mxnRate).toFixed(2)} MXN
                                  </span>
                                )}
                                {tx.concept && (
                                  <span className="px-2 py-0.5 bg-[#836EF9]/10 text-[10px] font-bold tracking-[0.05em] uppercase font-mono text-white rounded-sm">
                                    {tx.concept}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="px-1.5 py-0.5 bg-[#836EF9]/10 text-[9px] font-bold tracking-[0.05em] uppercase font-mono text-[#836EF9] rounded-sm">
                                  MONAD
                                </span>
                                <p className="text-[11px] text-white/40 font-mono">
                                  {tx.from.slice(0, 8)}...{tx.from.slice(-6)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {expandedTx === tx.hash
                                ? <ChevronUp className="w-4 h-4 text-white/30" />
                                : <ChevronDown className="w-4 h-4 text-white/30" />
                              }
                            </div>
                          </div>
                        </button>

                        {/* Expanded Receipt */}
                        {expandedTx === tx.hash && (
                          <div className="px-4 pb-4">
                            <div className="p-4 bg-white/5 border border-white/10 rounded-sm space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] font-bold tracking-[0.15em] uppercase font-mono text-white/30">RECEIPT</p>
                                <div className="flex items-center gap-1">
                                  <div className="w-1.5 h-1.5 bg-[#836EF9] rounded-full" />
                                  <span className="text-[9px] font-bold tracking-[0.1em] uppercase font-mono text-[#836EF9]">CONFIRMED</span>
                                </div>
                              </div>

                              <div className="h-[1px] bg-white/10" />

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <p className="text-[9px] font-bold tracking-[0.1em] uppercase font-mono text-white/30 mb-1">AMOUNT</p>
                                  <p className="text-lg font-bold text-[#836EF9]">${tx.value} USDC</p>
                                  {showMXN && mxnRate && (
                                    <p className="text-[11px] text-white/30 font-mono">
                                      ≈ ${(parseFloat(tx.value) * mxnRate).toFixed(2)} MXN
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <p className="text-[9px] font-bold tracking-[0.1em] uppercase font-mono text-white/30 mb-1">NETWORK</p>
                                  <p className="text-sm font-bold text-white">Monad</p>
                                  <p className="text-[11px] text-white/30 font-mono">Block #{tx.blockNumber}</p>
                                </div>
                              </div>

                              {tx.concept && (
                                <div>
                                  <p className="text-[9px] font-bold tracking-[0.1em] uppercase font-mono text-white/30 mb-1">CONCEPT</p>
                                  <p className="text-sm text-white">{tx.concept}</p>
                                </div>
                              )}

                              <div>
                                <p className="text-[9px] font-bold tracking-[0.1em] uppercase font-mono text-white/30 mb-1">FROM</p>
                                <p className="text-[11px] text-white/60 font-mono break-all">{tx.from}</p>
                              </div>

                              <div>
                                <p className="text-[9px] font-bold tracking-[0.1em] uppercase font-mono text-white/30 mb-1">TRANSACTION HASH</p>
                                <p className="text-[11px] text-white/60 font-mono break-all">{tx.hash}</p>
                              </div>

                              {tx.timestamp > 0 && (
                                <div>
                                  <p className="text-[9px] font-bold tracking-[0.1em] uppercase font-mono text-white/30 mb-1">DATE</p>
                                  <p className="text-sm text-white/60 font-mono">
                                    {new Date(tx.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                    {' '}
                                    {new Date(tx.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                              )}

                              <div className="h-[1px] bg-white/10" />

                              <a
                                href={`${MONAD_EXPLORER}/tx/${tx.hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 w-full py-2.5 border border-white/10 text-[11px] font-bold tracking-[0.1em] uppercase font-mono text-[#836EF9] hover:border-[#836EF9] transition-colors"
                              >
                                VIEW ON MONADSCAN <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-12">
        <div className="max-w-4xl mx-auto px-6 py-6 text-center">
          <p className="text-[11px] font-medium tracking-[0.05em] uppercase text-white/30 font-mono">
            POWERED BY MONAD
          </p>
        </div>
      </footer>

      {/* CSS for toast animation */}
      <style jsx global>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
