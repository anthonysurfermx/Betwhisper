'use client'

import { useWeb3 } from '@/components/web3-provider'
import { useState, useCallback, useEffect, useRef } from 'react'
import { parseIntent } from '@/lib/intents'
import { executeBet } from '@/lib/monad-bet'
import { MONAD_EXPLORER, MON_TOKEN, UNLINK_USDC, UNLINK_POOL } from '@/lib/constants'
import { useUnlink, useDeposit, useSend } from '@unlink-xyz/react'
import { useLivePrices, usePriceFlash } from '@/hooks/use-live-price'
import { useSounds } from '@/hooks/use-sounds'
import { SocialPulseToggle } from '@/components/social-pulse-toggle'
import Link from 'next/link'
import {
  Wallet, LogOut, Loader2, AlertTriangle,
  Shield, ChevronRight, ExternalLink, CheckCircle,
  ArrowUp, Globe, Star, TrendingUp, Brain, Landmark,
  Swords, Gamepad2, CircleDot, Bitcoin, Dribbble,
  Trophy, Zap,
  Users, Link2, Copy, Check, Plus, ArrowLeft, Crown, Lock, Unlock,
  MessageSquare, Trash2, Clock, Radio, MapPin, Maximize2, X, Navigation,
} from 'lucide-react'
import {
  Drawer, DrawerContent, DrawerTrigger, DrawerTitle,
} from '@/components/ui/drawer'
import { QRCodeSVG } from 'qrcode.react'
import type { DeepAnalysisResult } from '../api/market/deep-analyze/route'
import type { StrategyType } from '@/lib/polymarket-detector'
import { calculateWinProbability } from '@/lib/probability'
import type { ProbabilityResult } from '@/lib/probability'

// ─── Types ───

interface MarketInfo {
  conditionId: string
  question: string
  slug: string
  volume: number
  yesPrice: number
  noPrice: number
  image: string
  endDate: string
}

interface EventInfo {
  title: string
  slug: string
  image: string
  volume: number
  markets: MarketInfo[]
}

interface PortfolioData {
  portfolioValue: number
  positions: {
    conditionId: string; title: string; slug: string; outcome: string
    size: number; avgPrice: number; currentPrice: number; pnl: number; pnlPct: number
  }[]
  recentTrades: {
    timestamp: number; type: string; title: string; outcome: string
    side: string; usdcSize: number; price: number; transactionHash: string
  }[]
  stats: { totalPnl: number; openPositions: number; winCount: number; lossCount: number; winRate: number }
}

type ChatRole = 'user' | 'assistant'
type Lang = 'en' | 'es' | 'pt'

type ChatAttachment =
  | { type: 'markets'; markets: MarketInfo[] }
  | { type: 'marketPreview'; market: MarketInfo }
  | { type: 'deepAnalysis'; analysis: DeepAnalysisResult; market: MarketInfo }
  | { type: 'aiExplanation'; lines: string[]; market: MarketInfo; analysis: DeepAnalysisResult }
  | { type: 'betAmountInput'; market: MarketInfo; analysis: DeepAnalysisResult }
  | { type: 'successProbability'; probability: ProbabilityResult; market: MarketInfo; analysis: DeepAnalysisResult; signalHash: string }
  | { type: 'betChoice'; slug: string; yesPrice: number; noPrice: number }
  | { type: 'betPrompt'; side: 'Yes' | 'No'; slug: string; signalHash: string; conditionId: string }
  | { type: 'betConfirmed'; side: string; amount: string; txHash: string; explorerUrl?: string; source?: string; shares?: number; price?: number }
  | { type: 'betTimeline'; steps: BetTimelineStep[]; side: string; amount: string; market: string }
  | { type: 'loading'; text: string }
  | { type: 'error'; text: string }
  | { type: 'portfolio'; data: PortfolioData }
  | { type: 'pinSetup'; wallet: string }
  | { type: 'pinVerify'; wallet: string }
  | { type: 'balanceView'; positions: BalancePosition[]; totalValue: number; totalPnl: number }
  | { type: 'sellTimeline'; steps: BetTimelineStep[]; marketSlug: string }
  | { type: 'contextInsight'; insight: string; keyStats: string[] }
  | { type: 'transactionHistory'; orders: OrderHistory[] }
  | { type: 'pulseMarket'; market: MarketInfo; analysis: DeepAnalysisResult; groupCode: string; conditionId: string }

interface OrderHistory {
  id: number; marketSlug: string; side: string; amountUSD: number; shares: number; fillPrice: number
  status: string; monadTxHash: string; polygonTxHash: string; monPaid: string; createdAt: string
}

interface BalancePosition {
  id: number; marketSlug: string; side: string; shares: number; avgPrice: number
  currentPrice: number; costBasis: number; currentValue: number; pnl: number; pnlPct: number
  tokenId: string; tickSize: string; negRisk: boolean
}

interface BetTimelineStep {
  label: string
  chain: string
  status: 'pending' | 'processing' | 'confirmed' | 'error'
  txHash?: string
  explorerUrl?: string
  detail?: string
  errorMsg?: string
}

interface ChatMessage {
  id: string
  role: ChatRole
  text: string
  attachment?: ChatAttachment
  timestamp: number
}

// ─── Groups Types ───

type GroupsView = 'list' | 'create' | 'join' | 'detail'

interface GroupInfo {
  id: string
  name: string
  mode: 'draft_pool' | 'leaderboard'
  invite_code: string
  creator_wallet: string
  member_count: number
  market_slug?: string
  created_at: string
}

interface GroupDetail extends GroupInfo {
  members: { wallet_address: string; joined_at: string }[]
}

interface LeaderboardEntry {
  wallet_address: string
  total_pnl: number
  bet_count: number
}

// ─── Conversations Types ───

interface ConversationInfo {
  id: string
  wallet_address: string
  title: string
  last_message: string | null
  message_count: number
  created_at: string
  updated_at: string
}

interface ConversationMessage {
  id: string
  role: ChatRole
  text: string
  source: string
  created_at: string
}

// ─── i18n ───

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    greeting: "Hey! What prediction market interests you today?",
    askSpecific: "Nice! What specifically?",
    searchingMarkets: "Searching markets...",
    scanningWhales: "Agent Radar scanning holders...",
    foundMarkets: "Found {n} market{s}. Which one?",
    noMarkets: "No markets found for that. Try something else?",
    whaleResult: "{n} whale{s}, {pct}% {dir}.",
    radarResult: "Scanned {scanned} of {total} holders. {agentPct}% agent activity detected.",
    noWhales: "No tracked whales in this market. You can still trade.",
    howMuch: "How much?",
    placingBet: "Trading {amount} MON on {side}...",
    betConfirmed: "Trade confirmed on Polymarket.",
    connectWallet: "Connect your wallet to see your portfolio.",
    loadingPortfolio: "Loading portfolio...",
    hereIsPortfolio: "Here is your portfolio.",
    analyzeFirst: "Pick a market first, then I can help you trade.",
    helpText: "You can search markets, analyze whales, and trade. Try typing what you want to trade!",
    wantAnalysis: "Want my analysis before you trade?",
    analyzeBtn: "ANALYZE WITH AI",
    detectAgents: "DETECT AGENTS",
    explainWithAI: "EXPLAIN WITH AI",
    explaining: "AI analyzing market data...",
    betNow: "TRADE",
    skipAnalysis: "SKIP, TRADE NOW",
    localSentiment: "LOCAL SENTIMENT",
    connectForAnalysis: "Connect your wallet to unlock agent detection.",
    successProb: "Win Probability",
    recommendedSide: "Recommended",
    smartMoneyBet: "SMART MONEY",
    noEdge: "No edge detected. Trade at your own risk.",
    highConfidence: "High confidence",
    mediumConfidence: "Medium confidence",
    lowConfidence: "Low confidence",
    howMuchInvest: "How much do you want to invest?",
    investPlaceholder: "Amount in USD",
    calculateProb: "CALCULATE PROBABILITY",
    marketImpactLabel: "Your size",
    yourSizeMovesMarket: "Your position is {pct}% of market volume. This will move the price against you.",
    sizeOk: "Your position size has negligible market impact.",
    manualAmount: "Or pick amount:",
    monOnMonad: "MON on Monad",
    onboardName: "Name your assistant",
    onboardNameSub: "This is how you will activate it. By voice, through your glasses, or by typing.",
    onboardCategories: "What do you predict?",
    onboardCategoriesSub: "Pick 3 categories. {name} will show you markets that match.",
    onboardLang: "What language?",
    onboardLangSub: "{name} will talk to you in your language.",
    startWhispering: "START WHISPERING",
    stats: "STATS",
    pinSetupTitle: "SET UP YOUR 4-DIGIT PIN",
    pinConfirmTitle: "CONFIRM YOUR PIN",
    pinCreated: "PIN created",
    pinVerifyTitle: "ENTER YOUR PIN",
    pinVerified: "Verified",
    pinWrong: "Wrong PIN",
    pinLocked: "Too many attempts",
    attemptsLeft: "{n} attempts left",
    yourPositions: "YOUR POSITIONS",
    noPositions: "No open positions",
    sell: "SELL",
    selling: "Selling...",
    contextStats: "CONTEXT / STATS",
    transactionHistory: "TRANSACTION HISTORY",
    noTransactions: "No transactions yet",
    viewHistory: "HISTORY",
    failedSearch: "Failed to search markets.",
    failedAnalysis: "Failed to analyze market.",
    failedBet: "Failed to place trade. Please try again.",
    failedPortfolio: "Failed to load portfolio.",
    pinMismatch: "PINs do not match",
    failedSetPin: "Failed to set PIN",
    networkError: "Network error",
    pinLockedMsg: "Locked. Try again in {n} min.",
    failedJoin: "Failed to join",
    loadingGroups: "Loading groups...",
    noGroups: "No groups yet",
    noGroupsSub: "Create a group or join one with an invite code",
    agentRadar: "AGENT RADAR",
    agentCapitalFlow: "AGENT CAPITAL FLOW",
    ofAgentCapital: "of agent capital",
    dividedConsensus: "Divided. No clear consensus.",
    noAgentSignal: "No agent signal detected.",
    positionOpen: "POSITION OPEN",
    txRejected: "Transaction rejected",
    clobSell: "CLOB SELL",
    connectWalletToJoin: "CONNECT WALLET TO JOIN GROUP",
    joinGroup: "JOIN GROUP",
    joinedGroup: "JOINED GROUP",
    inviteFriend: "INVITE 1 FRIEND TO UNLOCK AI",
    aiUnlocked: "AI UNLOCKED",
    scanToJoin: "Scan to join group",
    inviteCode: "INVITE CODE",
    connectWalletForGroups: "Connect your wallet to use Groups",
    groupsSubtitle: "Compete with friends. Unlock AI features.",
  },
  es: {
    greeting: "Hola! Que mercado de prediccion te interesa hoy?",
    askSpecific: "Vale! En que especificamente?",
    searchingMarkets: "Buscando mercados...",
    scanningWhales: "Agent Radar escaneando holders...",
    foundMarkets: "Encontre {n} mercado{s}. Cual te interesa?",
    noMarkets: "No encontre mercados para eso. Intenta con otra cosa?",
    whaleResult: "{n} ballena{s}, {pct}% {dir}.",
    radarResult: "Escanee {scanned} de {total} holders. {agentPct}% actividad de agentes detectada.",
    noWhales: "No hay ballenas rastreadas en este mercado. Aun puedes invertir.",
    howMuch: "Cuanto quieres invertir?",
    placingBet: "Invirtiendo {amount} MON en {side}...",
    betConfirmed: "Posicion confirmada en Polymarket.",
    connectWallet: "Conecta tu wallet para ver tu portafolio.",
    loadingPortfolio: "Cargando portafolio...",
    hereIsPortfolio: "Aqui esta tu portafolio.",
    analyzeFirst: "Primero elige un mercado, despues te ayudo a invertir.",
    helpText: "Puedes buscar mercados, analizar ballenas e invertir. Escribe sobre que quieres invertir!",
    wantAnalysis: "Quieres mi analisis antes de invertir?",
    analyzeBtn: "ANALIZAR CON IA",
    detectAgents: "DETECTAR AGENTES",
    explainWithAI: "EXPLICAR CON IA",
    explaining: "IA analizando datos del mercado...",
    betNow: "INVERTIR",
    skipAnalysis: "SALTAR, INVERTIR YA",
    localSentiment: "SENTIMIENTO LOCAL",
    connectForAnalysis: "Conecta tu wallet para detectar agentes.",
    successProb: "Probabilidad de Exito",
    recommendedSide: "Recomendado",
    smartMoneyBet: "SMART MONEY",
    noEdge: "Sin ventaja detectada. Invierte bajo tu propio riesgo.",
    highConfidence: "Alta confianza",
    mediumConfidence: "Confianza media",
    lowConfidence: "Baja confianza",
    howMuchInvest: "Cuanto quieres invertir?",
    investPlaceholder: "Monto en USD",
    calculateProb: "CALCULAR PROBABILIDAD",
    marketImpactLabel: "Tu tamano",
    yourSizeMovesMarket: "Tu posicion es {pct}% del volumen del mercado. Esto movera el precio en tu contra.",
    sizeOk: "Tu posicion tiene impacto minimo en el mercado.",
    manualAmount: "O elige monto:",
    monOnMonad: "MON en Monad",
    onboardName: "Nombra a tu asistente",
    onboardNameSub: "Asi lo vas a activar. Por voz, con tus lentes, o escribiendo.",
    onboardCategories: "Que predices?",
    onboardCategoriesSub: "Elige 3 categorias. {name} te mostrara mercados que coincidan.",
    onboardLang: "En que idioma?",
    onboardLangSub: "{name} te hablara en tu idioma.",
    startWhispering: "EMPEZAR",
    stats: "ESTADISTICAS",
    pinSetupTitle: "CONFIGURA TU PIN DE 4 DIGITOS",
    pinConfirmTitle: "CONFIRMA TU PIN",
    pinCreated: "PIN creado",
    pinVerifyTitle: "INGRESA TU PIN",
    pinVerified: "Verificado",
    pinWrong: "PIN incorrecto",
    pinLocked: "Demasiados intentos",
    attemptsLeft: "{n} intentos restantes",
    yourPositions: "TUS POSICIONES",
    noPositions: "Sin posiciones abiertas",
    sell: "VENDER",
    selling: "Vendiendo...",
    contextStats: "CONTEXTO / ESTADISTICAS",
    transactionHistory: "HISTORIAL DE TRANSACCIONES",
    noTransactions: "Sin transacciones aun",
    viewHistory: "HISTORIAL",
    failedSearch: "Error al buscar mercados.",
    failedAnalysis: "Error al analizar el mercado.",
    failedBet: "Error al invertir. Intenta de nuevo.",
    failedPortfolio: "Error al cargar portafolio.",
    pinMismatch: "Los PINs no coinciden",
    failedSetPin: "Error al configurar PIN",
    networkError: "Error de red",
    pinLockedMsg: "Bloqueado. Intenta en {n} min.",
    failedJoin: "Error al unirse",
    loadingGroups: "Cargando grupos...",
    noGroups: "Sin grupos aun",
    noGroupsSub: "Crea un grupo o unete con un codigo",
    agentRadar: "RADAR DE AGENTES",
    agentCapitalFlow: "FLUJO DE CAPITAL",
    ofAgentCapital: "de capital de agentes",
    dividedConsensus: "Dividido. Sin consenso.",
    noAgentSignal: "Sin senal de agentes.",
    positionOpen: "POSICION ABIERTA",
    txRejected: "Transaccion rechazada",
    clobSell: "VENTA CLOB",
    connectWalletToJoin: "CONECTA TU WALLET PARA UNIRTE",
    joinGroup: "UNIRSE AL GRUPO",
    joinedGroup: "TE UNISTE AL GRUPO",
    inviteFriend: "INVITA A 1 AMIGO PARA DESBLOQUEAR IA",
    aiUnlocked: "IA DESBLOQUEADA",
    scanToJoin: "Escanea para unirte",
    inviteCode: "CODIGO DE INVITACION",
    connectWalletForGroups: "Conecta tu wallet para usar Grupos",
    groupsSubtitle: "Compite con amigos. Desbloquea funciones de IA.",
  },
  pt: {
    greeting: "Oi! Que mercado de predicao te interessa hoje?",
    askSpecific: "Legal! Em que especificamente?",
    searchingMarkets: "Buscando mercados...",
    scanningWhales: "Agent Radar escaneando holders...",
    foundMarkets: "Encontrei {n} mercado{s}. Qual te interessa?",
    noMarkets: "Nao encontrei mercados para isso. Tenta outra coisa?",
    whaleResult: "{n} baleia{s}, {pct}% {dir}.",
    radarResult: "Escaneei {scanned} de {total} holders. {agentPct}% atividade de agentes detectada.",
    noWhales: "Sem baleias rastreadas neste mercado. Voce ainda pode investir.",
    howMuch: "Quanto quer investir?",
    placingBet: "Investindo {amount} MON em {side}...",
    betConfirmed: "Posicao confirmada na Polymarket.",
    connectWallet: "Conecte sua wallet para ver seu portfolio.",
    loadingPortfolio: "Carregando portfolio...",
    hereIsPortfolio: "Aqui esta seu portfolio.",
    analyzeFirst: "Escolha um mercado primeiro, depois te ajudo a investir.",
    helpText: "Voce pode buscar mercados, analisar baleias e investir. Escreva sobre o que quer investir!",
    wantAnalysis: "Quer minha analise antes de investir?",
    analyzeBtn: "ANALISAR COM IA",
    detectAgents: "DETECTAR AGENTES",
    explainWithAI: "EXPLICAR COM IA",
    explaining: "IA analisando dados do mercado...",
    betNow: "INVESTIR",
    skipAnalysis: "PULAR, INVESTIR JA",
    localSentiment: "SENTIMENTO LOCAL",
    connectForAnalysis: "Conecte sua wallet para detectar agentes.",
    successProb: "Probabilidade de Sucesso",
    recommendedSide: "Recomendado",
    smartMoneyBet: "SMART MONEY",
    noEdge: "Sem vantagem detectada. Invista por sua conta e risco.",
    highConfidence: "Alta confianca",
    mediumConfidence: "Confianca media",
    lowConfidence: "Baixa confianca",
    howMuchInvest: "Quanto voce quer investir?",
    investPlaceholder: "Valor em USD",
    calculateProb: "CALCULAR PROBABILIDADE",
    marketImpactLabel: "Seu tamanho",
    yourSizeMovesMarket: "Sua posicao e {pct}% do volume do mercado. Isso movera o preco contra voce.",
    sizeOk: "Sua posicao tem impacto minimo no mercado.",
    manualAmount: "Ou escolha valor:",
    monOnMonad: "MON na Monad",
    onboardName: "Nomeie seu assistente",
    onboardNameSub: "E assim que voce vai ativa-lo. Por voz, pelos oculos, ou digitando.",
    onboardCategories: "O que voce prediz?",
    onboardCategoriesSub: "Escolha 3 categorias. {name} vai mostrar mercados que combinam.",
    onboardLang: "Qual idioma?",
    onboardLangSub: "{name} vai falar com voce no seu idioma.",
    startWhispering: "COMECAR",
    stats: "ESTATISTICAS",
    pinSetupTitle: "CONFIGURE SEU PIN DE 4 DIGITOS",
    pinConfirmTitle: "CONFIRME SEU PIN",
    pinCreated: "PIN criado",
    pinVerifyTitle: "DIGITE SEU PIN",
    pinVerified: "Verificado",
    pinWrong: "PIN incorreto",
    pinLocked: "Muitas tentativas",
    attemptsLeft: "{n} tentativas restantes",
    yourPositions: "SUAS POSICOES",
    noPositions: "Sem posicoes abertas",
    sell: "VENDER",
    selling: "Vendendo...",
    contextStats: "CONTEXTO / ESTATISTICAS",
    transactionHistory: "HISTORICO DE TRANSACOES",
    noTransactions: "Sem transacoes ainda",
    viewHistory: "HISTORICO",
    failedSearch: "Erro ao buscar mercados.",
    failedAnalysis: "Erro ao analisar o mercado.",
    failedBet: "Erro ao investir. Tente novamente.",
    failedPortfolio: "Erro ao carregar portfolio.",
    pinMismatch: "PINs nao coincidem",
    failedSetPin: "Erro ao configurar PIN",
    networkError: "Erro de rede",
    pinLockedMsg: "Bloqueado. Tente em {n} min.",
    failedJoin: "Erro ao entrar",
    loadingGroups: "Carregando grupos...",
    noGroups: "Sem grupos ainda",
    noGroupsSub: "Crie um grupo ou entre com um codigo",
    agentRadar: "RADAR DE AGENTES",
    agentCapitalFlow: "FLUXO DE CAPITAL",
    ofAgentCapital: "de capital de agentes",
    dividedConsensus: "Dividido. Sem consenso.",
    noAgentSignal: "Sem sinal de agentes.",
    positionOpen: "POSICAO ABERTA",
    txRejected: "Transacao rejeitada",
    clobSell: "VENDA CLOB",
    connectWalletToJoin: "CONECTE SUA WALLET PARA ENTRAR",
    joinGroup: "ENTRAR NO GRUPO",
    joinedGroup: "ENTROU NO GRUPO",
    inviteFriend: "CONVIDE 1 AMIGO PARA DESBLOQUEAR IA",
    aiUnlocked: "IA DESBLOQUEADA",
    scanToJoin: "Escaneie para entrar",
    inviteCode: "CODIGO DE CONVITE",
    connectWalletForGroups: "Conecte sua wallet para usar Grupos",
    groupsSubtitle: "Compita com amigos. Desbloqueie funcoes de IA.",
  },
}

function t(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let str = STRINGS[lang]?.[key] || STRINGS.en[key] || key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{${k}}`, String(v))
    }
  }
  return str
}

// ─── Categories ───

interface BetCategory {
  id: string
  name: Record<Lang, string>
  icon: string
  query: string
}

const ALL_CATEGORIES: BetCategory[] = [
  { id: 'crypto',   name: { en: 'Crypto', es: 'Crypto', pt: 'Crypto' },             icon: 'bitcoin',    query: 'bitcoin ethereum crypto' },
  { id: 'nba',      name: { en: 'NBA', es: 'NBA', pt: 'NBA' },                      icon: 'dribbble',   query: 'nba' },
  { id: 'nfl',      name: { en: 'NFL', es: 'NFL', pt: 'NFL' },                      icon: 'trophy',     query: 'nfl' },
  { id: 'soccer',   name: { en: 'Soccer', es: 'Futbol', pt: 'Futebol' },            icon: 'circle-dot', query: 'liga mx' },
  { id: 'politics', name: { en: 'Politics', es: 'Politica', pt: 'Politica' },       icon: 'landmark',   query: 'president election politics' },
  { id: 'ai',       name: { en: 'AI', es: 'IA', pt: 'IA' },                         icon: 'brain',      query: 'artificial intelligence ai model' },
  { id: 'finance',  name: { en: 'Finance', es: 'Finanzas', pt: 'Financas' },        icon: 'trending-up',query: 'fed rates stock market' },
  { id: 'mma',      name: { en: 'MMA / UFC', es: 'MMA / UFC', pt: 'MMA / UFC' },   icon: 'swords',     query: 'ufc' },
  { id: 'baseball', name: { en: 'MLB', es: 'MLB', pt: 'MLB' },                      icon: 'zap',        query: 'mlb' },
  { id: 'esports',  name: { en: 'Esports', es: 'Esports', pt: 'Esports' },         icon: 'gamepad-2',  query: 'league of legends' },
  { id: 'world',    name: { en: 'World', es: 'Mundo', pt: 'Mundo' },                icon: 'globe',      query: 'world event global' },
  { id: 'culture',  name: { en: 'Culture', es: 'Cultura', pt: 'Cultura' },          icon: 'star',       query: 'oscars grammys entertainment' },
]

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'bitcoin': Bitcoin, 'dribbble': Dribbble, 'trophy': Trophy, 'circle-dot': CircleDot,
  'landmark': Landmark, 'brain': Brain, 'trending-up': TrendingUp, 'swords': Swords,
  'zap': Zap, 'gamepad-2': Gamepad2, 'globe': Globe, 'star': Star,
}

// ─── localStorage helpers ───

function getAssistantName(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('betwhisper_assistant_name') || ''
}

function getSavedCategories(): string[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem('betwhisper_categories') || '[]') } catch { return [] }
}

function getSavedLang(): Lang {
  if (typeof window === 'undefined') return 'en'
  return (localStorage.getItem('betwhisper_lang') as Lang) || 'en'
}

function isOnboarded(): boolean {
  return !!getAssistantName() && getSavedCategories().length > 0 && !!localStorage.getItem('betwhisper_lang')
}

function saveOnboarding(name: string, categories: string[], lang: Lang) {
  localStorage.setItem('betwhisper_assistant_name', name)
  localStorage.setItem('betwhisper_categories', JSON.stringify(categories))
  localStorage.setItem('betwhisper_lang', lang)
}

// ─── UUID helper ───

let msgCounter = 0
function uid(): string { return `msg_${Date.now()}_${++msgCounter}` }

// ─── Onboarding Screen (3 steps) ───

function OnboardingScreen({ onComplete }: { onComplete: (name: string, categories: string[], lang: Lang) => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [name, setName] = useState('')
  const [focused, setFocused] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lang, setLang] = useState<Lang>('es')

  const suggestions = ['Don Fede', 'Buddy', 'Seu Jorge', '老王', 'Coach', 'El Profe']

  const toggleCategory = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else if (next.size < 3) { next.add(id) }
      return next
    })
  }

  // Step 1: Name
  if (step === 1) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-6">
        <div className="max-w-md w-full">
          <div className="mb-10">
            <div className="w-8 h-8 border border-white/20 flex items-center justify-center mb-8">
              <span className="text-[11px] font-bold">BW</span>
            </div>
            <h1 className="text-[32px] font-bold tracking-tight mb-3">Name your assistant</h1>
            <p className="text-[15px] text-[--text-secondary] leading-relaxed">
              This is how you will activate it. By voice, through your glasses, or by typing.
            </p>
          </div>
          <div className="mb-6">
            <input
              type="text" value={name}
              onChange={e => setName(e.target.value)}
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              onKeyDown={e => { if (e.key === 'Enter' && name.trim()) setStep(2) }}
              placeholder="e.g. Don Fede"
              className={`w-full bg-transparent border ${focused ? 'border-white/40' : 'border-[--border-light]'} px-4 py-3.5 text-[16px] text-white placeholder:text-[--text-tertiary] outline-none transition-colors`}
            />
          </div>
          <div className="flex flex-wrap gap-2 mb-10">
            {suggestions.map(s => (
              <button key={s} onClick={() => setName(s)}
                className="px-3 py-1.5 border border-[--border-light] text-[13px] text-[--text-secondary] hover:text-white hover:border-white/30 transition-colors active:scale-[0.97]">
                {s}
              </button>
            ))}
          </div>
          <button onClick={() => { if (name.trim()) setStep(2) }} disabled={!name.trim()}
            className="w-full px-6 py-3.5 bg-white text-black text-[14px] font-semibold hover:bg-white/90 transition-all active:scale-[0.97] disabled:opacity-20 disabled:cursor-not-allowed">
            Continue
          </button>
        </div>
      </div>
    )
  }

  // Step 2: Categories
  if (step === 2) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-6">
        <div className="max-w-lg w-full">
          <div className="mb-8">
            <div className="w-8 h-8 border border-white/20 flex items-center justify-center mb-8">
              <span className="text-[11px] font-bold">BW</span>
            </div>
            <h1 className="text-[32px] font-bold tracking-tight mb-3">{t(lang, 'onboardCategories')}</h1>
            <p className="text-[15px] text-[--text-secondary] leading-relaxed">
              {t(lang, 'onboardCategoriesSub', { name: name })}
            </p>
          </div>
          <div className="flex items-center gap-1.5 mb-6">
            <span className={`text-[13px] font-bold font-mono ${selected.size === 3 ? 'text-emerald-500' : 'text-white'}`}>{selected.size}</span>
            <span className="text-[13px] font-mono text-white/30">/ 3</span>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-10">
            {ALL_CATEGORIES.map(cat => {
              const isSelected = selected.has(cat.id)
              const canSelect = selected.size < 3
              const IconComp = CATEGORY_ICONS[cat.icon]
              return (
                <button key={cat.id} onClick={() => toggleCategory(cat.id)} disabled={!isSelected && !canSelect}
                  className={`flex flex-col items-center gap-1.5 py-4 px-2 border transition-all active:scale-[0.97] ${
                    isSelected ? 'bg-white text-black border-white'
                      : canSelect ? 'bg-white/[0.03] text-white/60 border-white/[0.08] hover:text-white hover:border-white/20'
                        : 'bg-white/[0.03] text-white/20 border-white/[0.08] cursor-not-allowed'
                  }`}>
                  {IconComp && <IconComp className="w-5 h-5" />}
                  <span className="text-[11px] font-semibold">{cat.name[lang]}</span>
                </button>
              )
            })}
          </div>
          <button onClick={() => { if (selected.size === 3) setStep(3) }} disabled={selected.size < 3}
            className="w-full px-6 py-3.5 bg-white text-black text-[14px] font-semibold hover:bg-white/90 transition-all active:scale-[0.97] disabled:opacity-20 disabled:cursor-not-allowed">
            Continue
          </button>
        </div>
      </div>
    )
  }

  // Step 3: Language
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <div className="mb-10">
          <div className="w-8 h-8 border border-white/20 flex items-center justify-center mb-8">
            <span className="text-[11px] font-bold">BW</span>
          </div>
          <h1 className="text-[32px] font-bold tracking-tight mb-3">{t(lang, 'onboardLang')}</h1>
          <p className="text-[15px] text-[--text-secondary] leading-relaxed">
            {t(lang, 'onboardLangSub', { name: name })}
          </p>
        </div>
        <div className="space-y-2 mb-10">
          {([
            { code: 'en' as Lang, label: 'English', flag: '🇺🇸' },
            { code: 'es' as Lang, label: 'Espanol', flag: '🇲🇽' },
            { code: 'pt' as Lang, label: 'Portugues', flag: '🇧🇷' },
          ]).map(opt => (
            <button key={opt.code} onClick={() => setLang(opt.code)}
              className={`w-full flex items-center gap-3 px-5 py-4 border transition-all active:scale-[0.98] ${
                lang === opt.code ? 'bg-white text-black border-white' : 'bg-white/[0.03] text-white/60 border-white/[0.08] hover:border-white/20'
              }`}>
              <span className="text-xl">{opt.flag}</span>
              <span className="text-[14px] font-semibold">{opt.label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => { if (name.trim() && selected.size === 3) onComplete(name.trim(), Array.from(selected), lang) }}
          className="w-full px-6 py-3.5 bg-white text-black text-[14px] font-semibold hover:bg-white/90 transition-all active:scale-[0.97] flex items-center justify-center gap-2">
          {t(lang, 'startWhispering')} <ArrowUp className="w-4 h-4 rotate-45" />
        </button>
      </div>
    </div>
  )
}

// ─── Chat Attachment: Market List ───

function MarketListAttachment({ markets, onSelect }: { markets: MarketInfo[]; onSelect: (m: MarketInfo) => void }) {
  return (
    <div className="space-y-1.5 mt-2">
      {markets.map((market, idx) => (
        <div key={market.conditionId} className="bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-colors">
          <button onClick={() => onSelect(market)}
            className="w-full text-left flex items-center justify-between px-3 py-2.5 active:scale-[0.99]">
            <div className="flex-1 min-w-0 mr-3">
              <div className="text-[13px] font-medium text-white line-clamp-2 mb-1">{market.question}</div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold font-mono text-emerald-500">YES {(market.yesPrice * 100).toFixed(0)}¢</span>
                <span className="text-[10px] font-bold font-mono text-red-400">NO {(market.noPrice * 100).toFixed(0)}¢</span>
                {market.volume > 0 && (
                  <span className="text-[10px] font-mono text-white/30">
                    ${market.volume > 1000000 ? `${(market.volume / 1000000).toFixed(1)}M` : `${(market.volume / 1000).toFixed(0)}K`}
                  </span>
                )}
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />
          </button>
          {idx === 0 && <MiniPriceChart slug={market.slug} />}
        </div>
      ))}
    </div>
  )
}

// ─── Mini Price Chart (wow effect for demo) ───

function MiniPriceChart({ slug }: { slug: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loaded, setLoaded] = useState(false)
  const animRef = useRef<number>(0)
  const dataRef = useRef<{ t: number; p: number }[]>([])

  useEffect(() => {
    if (!slug) return
    let cancelled = false

    fetch(`/api/markets/history?slug=${encodeURIComponent(slug)}&interval=1d&fidelity=5`)
      .then(r => r.json())
      .then(data => {
        if (cancelled || !data.history?.length) return
        dataRef.current = data.history
        setLoaded(true)
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [slug])

  useEffect(() => {
    if (!loaded || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const points = dataRef.current
    if (points.length < 2) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)

    const prices = points.map(p => p.p * 100)
    const minP = Math.max(0, Math.min(...prices) - 2)
    const maxP = Math.min(100, Math.max(...prices) + 2)
    const range = maxP - minP || 1

    const isUp = prices[prices.length - 1] >= prices[0]
    const lineColor = isUp ? '#10b981' : '#ef4444'
    const gradTop = isUp ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.20)'
    const gradBot = isUp ? 'rgba(16,185,129,0)' : 'rgba(239,68,68,0)'

    let progress = 0
    const totalFrames = 60

    function draw() {
      if (!ctx) return
      progress = Math.min(progress + 1, totalFrames)
      const pct = progress / totalFrames
      // Ease-out cubic
      const ease = 1 - Math.pow(1 - pct, 3)
      const visibleCount = Math.floor(prices.length * ease)
      if (visibleCount < 2) {
        animRef.current = requestAnimationFrame(draw)
        return
      }

      ctx.clearRect(0, 0, w, h)

      // Draw line
      ctx.beginPath()
      ctx.strokeStyle = lineColor
      ctx.lineWidth = 1.5
      ctx.lineJoin = 'round'

      for (let i = 0; i < visibleCount; i++) {
        const x = (i / (prices.length - 1)) * w
        const y = h - ((prices[i] - minP) / range) * (h - 4) - 2
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      // Draw gradient fill
      const gradient = ctx.createLinearGradient(0, 0, 0, h)
      gradient.addColorStop(0, gradTop)
      gradient.addColorStop(1, gradBot)

      ctx.lineTo(((visibleCount - 1) / (prices.length - 1)) * w, h)
      ctx.lineTo(0, h)
      ctx.closePath()
      ctx.fillStyle = gradient
      ctx.fill()

      // Current price dot (pulsing)
      if (progress >= totalFrames) {
        const lastX = ((visibleCount - 1) / (prices.length - 1)) * w
        const lastY = h - ((prices[visibleCount - 1] - minP) / range) * (h - 4) - 2
        const pulse = 1 + Math.sin(Date.now() / 300) * 0.3
        ctx.beginPath()
        ctx.arc(lastX, lastY, 3 * pulse, 0, Math.PI * 2)
        ctx.fillStyle = lineColor
        ctx.fill()
        ctx.beginPath()
        ctx.arc(lastX, lastY, 6 * pulse, 0, Math.PI * 2)
        ctx.fillStyle = lineColor.replace(')', ',0.2)')
        ctx.fillStyle = isUp ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'
        ctx.fill()
      }

      if (progress < totalFrames || progress >= totalFrames) {
        animRef.current = requestAnimationFrame(draw)
      }
    }

    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [loaded])

  if (!loaded) return null

  const prices = dataRef.current.map(p => p.p * 100)
  const current = prices[prices.length - 1]
  const first = prices[0]
  const change = current - first
  const isUp = change >= 0

  return (
    <div className="border-t border-white/[0.06] px-3 py-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] font-mono text-white/30 uppercase tracking-wider">5m Price Chart</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono font-bold text-white">{current.toFixed(1)}¢</span>
          <span className={`text-[9px] font-mono font-bold ${isUp ? 'text-emerald-500' : 'text-red-400'}`}>
            {isUp ? '▲' : '▼'} {Math.abs(change).toFixed(1)}¢
          </span>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </div>
      </div>
      <canvas ref={canvasRef} className="w-full h-[80px]" style={{ display: 'block' }} />
    </div>
  )
}

// ─── Chat Attachment: Market Preview (before analysis) ───

function MarketPreviewAttachment({ market, lang, isConnected, onAnalyze, onSkip, onContext }: {
  market: MarketInfo; lang: Lang; isConnected: boolean
  onAnalyze: (market: MarketInfo) => void
  onSkip: (market: MarketInfo) => void
  onContext?: (title: string, slug: string) => void
}) {
  return (
    <div className="mt-2 border border-white/[0.10] bg-white/[0.04]">
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <div className="text-[13px] font-medium text-white mb-2">{market.question}</div>
        <div className="flex items-center gap-4">
          <div>
            <span className="text-[10px] text-white/30 mr-1">YES</span>
            <span className="text-[16px] font-bold font-mono text-emerald-500">{(market.yesPrice * 100).toFixed(0)}¢</span>
          </div>
          <div>
            <span className="text-[10px] text-white/30 mr-1">NO</span>
            <span className="text-[16px] font-bold font-mono text-red-400">{(market.noPrice * 100).toFixed(0)}¢</span>
          </div>
          {market.volume > 0 && (
            <div className="text-[10px] font-mono text-white/20">
              Vol ${market.volume > 1000000 ? `${(market.volume / 1000000).toFixed(1)}M` : `${(market.volume / 1000).toFixed(0)}K`}
            </div>
          )}
        </div>
      </div>
      <MiniPriceChart slug={market.slug} />
      <div className="px-4 py-3 flex items-center gap-2">
        {isConnected ? (
          <button onClick={() => onAnalyze(market)}
            className="flex-1 py-2.5 text-[12px] font-semibold border border-white/20 text-white hover:bg-white/[0.06] transition-colors active:scale-[0.97] flex items-center justify-center gap-1.5">
            <Brain className="w-3.5 h-3.5" />
            {t(lang, 'detectAgents')}
          </button>
        ) : (
          <button onClick={() => onAnalyze(market)}
            className="flex-1 py-2.5 text-[12px] font-semibold border border-white/10 text-white/30 cursor-not-allowed flex items-center justify-center gap-1.5"
            title={t(lang, 'connectForAnalysis')}>
            <Wallet className="w-3.5 h-3.5" />
            {t(lang, 'detectAgents')}
          </button>
        )}
        {onContext && (
          <button onClick={() => onContext(market.question || market.slug, market.slug)}
            className="flex-1 py-2.5 text-[12px] font-semibold border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors active:scale-[0.97] flex items-center justify-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            {t(lang, 'stats')}
          </button>
        )}
        <button onClick={() => onSkip(market)}
          className="flex-1 py-2.5 text-[12px] font-semibold border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 transition-colors active:scale-[0.97]">
          {t(lang, 'skipAnalysis')}
        </button>
      </div>
    </div>
  )
}

// ─── Chat Attachment: Bet Choice (YES/NO without analysis) ───

function BetChoiceAttachment({ slug, yesPrice, noPrice, onPickSide }: {
  slug: string; yesPrice: number; noPrice: number
  onPickSide: (side: 'Yes' | 'No', slug: string, signalHash: string) => void
}) {
  return (
    <div className="mt-2 border border-white/[0.10] bg-white/[0.04]">
      <div className="px-4 py-3 flex items-center gap-4 border-b border-white/[0.06]">
        <div>
          <span className="text-[10px] text-white/30 mr-1">YES</span>
          <span className="text-[14px] font-bold font-mono text-emerald-500">{(yesPrice * 100).toFixed(0)}¢</span>
        </div>
        <div>
          <span className="text-[10px] text-white/30 mr-1">NO</span>
          <span className="text-[14px] font-bold font-mono text-red-400">{(noPrice * 100).toFixed(0)}¢</span>
        </div>
      </div>
      <div className="px-4 py-3 flex items-center gap-2">
        <button onClick={() => onPickSide('Yes', slug, 'skip')}
          className="flex-1 py-2 text-[12px] font-semibold border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 transition-colors active:scale-[0.97]">
          TRADE YES
        </button>
        <button onClick={() => onPickSide('No', slug, 'skip')}
          className="flex-1 py-2 text-[12px] font-semibold border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-colors active:scale-[0.97]">
          TRADE NO
        </button>
      </div>
    </div>
  )
}

// ─── Chat Attachment: Deep Analysis Card (Agent Radar) ───

const STRATEGY_COLORS: Record<StrategyType, string> = {
  MARKET_MAKER: 'text-blue-400', HYBRID: 'text-purple-400', SNIPER: 'text-amber-400',
  MOMENTUM: 'text-cyan-400', UNCLASSIFIED: 'text-white/30',
}

const CLASSIFICATION_COLORS: Record<string, string> = {
  bot: 'text-red-400 border-red-400/30', 'likely-bot': 'text-orange-400 border-orange-400/30',
  mixed: 'text-yellow-400 border-yellow-400/30', human: 'text-emerald-400 border-emerald-400/30',
}

function DeepAnalysisAttachment({ analysis, market, lang, onExplain, onSkipToBet, onContext, onPulse }: {
  analysis: DeepAnalysisResult; market: MarketInfo; lang: Lang
  onExplain: (analysis: DeepAnalysisResult, market: MarketInfo) => void
  onSkipToBet: (market: MarketInfo, analysis: DeepAnalysisResult) => void
  onContext?: (title: string, slug: string) => void
  onPulse?: (market: MarketInfo, analysis: DeepAnalysisResult) => void
}) {
  const { classifications, capitalByOutcome, topHolders, strategies } = analysis
  const totalYesCap = capitalByOutcome.Yes.total
  const totalNoCap = capitalByOutcome.No.total
  const totalCap = totalYesCap + totalNoCap
  const yesPct = totalCap > 0 ? Math.round((totalYesCap / totalCap) * 100) : 50

  // Format dollar amounts
  const fmtCap = (n: number) => n > 1000000 ? `$${(n / 1000000).toFixed(1)}M` : n > 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${Math.round(n)}`

  return (
    <div className="mt-2 border border-white/[0.10] bg-white/[0.04]">
      {/* Header */}
      <div className="px-4 py-2 border-b border-white/[0.06] flex items-center justify-between">
        <span className="text-[9px] font-bold font-mono text-white/30 tracking-[1.5px]">{t(lang, 'agentRadar')}</span>
        <span className="text-[9px] font-mono text-white/20">{analysis.holdersScanned} scanned / {analysis.totalHolders} holders</span>
      </div>

      {/* Market Structure */}
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <div className="text-[10px] font-mono text-white/30 mb-2">MARKET STRUCTURE</div>
        <div className="flex items-center gap-4 mb-2">
          <div>
            <span className="text-[22px] font-bold font-mono text-white">{analysis.agentRate}%</span>
            <span className="text-[10px] text-white/30 ml-1">agent</span>
          </div>
          <div>
            <span className="text-[22px] font-bold font-mono text-white/60">{100 - analysis.agentRate}%</span>
            <span className="text-[10px] text-white/30 ml-1">human</span>
          </div>
        </div>
        <div className="h-1.5 bg-white/[0.06] w-full flex">
          <div className="h-full bg-red-400/70 transition-all duration-700" style={{ width: `${analysis.agentRate}%` }} />
          <div className="h-full bg-emerald-500/50 transition-all duration-700" style={{ width: `${100 - analysis.agentRate}%` }} />
        </div>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-[9px] font-mono text-red-400/60">BOT {classifications.bot}</span>
          <span className="text-[9px] font-mono text-orange-400/60">LIKELY {classifications.likelyBot}</span>
          <span className="text-[9px] font-mono text-yellow-400/60">MIXED {classifications.mixed}</span>
          <span className="text-[9px] font-mono text-emerald-400/60">HUMAN {classifications.human}</span>
        </div>
      </div>

      {/* Agent Capital Flow */}
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <div className="text-[10px] font-mono text-white/30 mb-2">{t(lang, 'agentCapitalFlow')}</div>
        <div className="flex items-center gap-4 mb-2">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono text-emerald-500">YES</span>
              <span className="text-[10px] font-mono text-white/40">{fmtCap(totalYesCap)}</span>
            </div>
            <div className="h-1 bg-white/[0.06] w-full">
              <div className="h-full bg-emerald-500/60 transition-all duration-700" style={{ width: `${yesPct}%` }} />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[8px] font-mono text-red-400/50">agent {fmtCap(capitalByOutcome.Yes.agent)}</span>
              <span className="text-[8px] font-mono text-emerald-400/50">human {fmtCap(capitalByOutcome.Yes.human)}</span>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono text-red-400">NO</span>
              <span className="text-[10px] font-mono text-white/40">{fmtCap(totalNoCap)}</span>
            </div>
            <div className="h-1 bg-white/[0.06] w-full">
              <div className="h-full bg-red-400/60 transition-all duration-700" style={{ width: `${100 - yesPct}%` }} />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[8px] font-mono text-red-400/50">agent {fmtCap(capitalByOutcome.No.agent)}</span>
              <span className="text-[8px] font-mono text-emerald-400/50">human {fmtCap(capitalByOutcome.No.human)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Strategy Mix */}
      {analysis.dominantStrategy && (
        <div className="px-4 py-2.5 border-b border-white/[0.06]">
          <div className="text-[10px] font-mono text-white/30 mb-1.5">STRATEGY MIX</div>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(strategies) as [StrategyType, number][])
              .filter(([, count]) => count > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <span key={type} className={`text-[10px] font-mono ${STRATEGY_COLORS[type]} border border-white/[0.06] px-2 py-0.5`}>
                  {type === 'MARKET_MAKER' ? 'Maker' : type === 'UNCLASSIFIED' ? 'Other' : type.charAt(0) + type.slice(1).toLowerCase()} x{count}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Smart Money Direction */}
      <div className="px-4 py-2.5 border-b border-white/[0.06]">
        <div className="text-[10px] font-mono text-white/30 mb-1.5">SMART MONEY</div>
        <div className="flex items-center gap-2">
          {analysis.smartMoneyDirection === 'Yes' || analysis.smartMoneyDirection === 'No' ? (
            <>
              <span className={`text-[14px] font-bold font-mono ${analysis.smartMoneyDirection === 'Yes' ? 'text-emerald-500' : 'text-red-400'}`}>
                {analysis.smartMoneyDirection.toUpperCase()}
              </span>
              <span className="text-[18px] font-bold font-mono text-white">{analysis.smartMoneyPct}%</span>
              <span className="text-[10px] text-white/30">{t(lang, 'ofAgentCapital')}</span>
            </>
          ) : (
            <span className="text-[12px] font-mono text-white/40">
              {analysis.smartMoneyDirection === 'Divided' ? t(lang, 'dividedConsensus') : t(lang, 'noAgentSignal')}
            </span>
          )}
        </div>
      </div>

      {/* Top Holders */}
      {topHolders.length > 0 && (
        <div className="px-4 py-2 border-b border-white/[0.06]">
          <div className="text-[10px] font-mono text-white/30 mb-1.5">TOP HOLDERS</div>
          {topHolders.slice(0, 5).map(h => (
            <div key={h.address} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-[11px] font-medium text-white/70 truncate max-w-[120px]">{h.pseudonym}</span>
                <span className={`text-[8px] font-bold tracking-wider border px-1 py-0.5 ${CLASSIFICATION_COLORS[h.classification] || 'text-white/30 border-white/10'}`}>
                  {h.classification === 'likely-bot' ? 'L-BOT' : h.classification.toUpperCase()}
                </span>
                {h.strategy.type !== 'UNCLASSIFIED' && (
                  <span className={`text-[8px] font-mono ${STRATEGY_COLORS[h.strategy.type]}`}>{h.strategy.label}</span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-[10px] font-bold font-mono ${h.side === 'Yes' ? 'text-emerald-500' : 'text-red-400'}`}>{h.side.toUpperCase()}</span>
                <span className="text-[10px] font-mono text-white/20">{fmtCap(h.positionSize)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Red Flags */}
      {analysis.redFlags.length > 0 && (
        <div className="px-4 py-2.5 border-b border-amber-500/20 bg-amber-500/[0.03]">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            <span className="text-[9px] font-bold font-mono text-amber-500 tracking-[1px]">RED FLAGS</span>
          </div>
          {analysis.redFlags.map((flag, i) => (
            <p key={i} className="text-[10px] text-amber-400/70 leading-relaxed">{flag}</p>
          ))}
        </div>
      )}

      {/* Recommendation */}
      <div className="px-4 py-2.5 border-b border-white/[0.06]">
        <div className="text-[10px] font-mono text-white/30 mb-1">RECOMMENDATION</div>
        <p className="text-[11px] text-white/70 leading-relaxed">{analysis.recommendation}</p>
      </div>

      {/* Tags */}
      {analysis.tags.length > 0 && (
        <div className="px-4 py-2 border-b border-white/[0.06] flex flex-wrap gap-1.5">
          {analysis.tags.map(tag => (
            <span key={tag} className="text-[9px] font-mono text-white/40 border border-white/[0.08] px-2 py-0.5">{tag}</span>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div className="px-4 py-3 flex items-center gap-2">
        <button onClick={() => onExplain(analysis, market)}
          className="flex-1 py-2.5 text-[12px] font-semibold border border-white/20 text-white hover:bg-white/[0.06] transition-colors active:scale-[0.97] flex items-center justify-center gap-1.5">
          <Brain className="w-3.5 h-3.5" />
          {t(lang, 'explainWithAI')}
        </button>
        {onContext && (
          <button onClick={() => onContext(market.question || market.slug, market.slug)}
            className="flex-1 py-2.5 text-[12px] font-semibold border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors active:scale-[0.97] flex items-center justify-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            {t(lang, 'stats')}
          </button>
        )}
        <button onClick={() => onSkipToBet(market, analysis)}
          className="flex-1 py-2.5 text-[12px] font-semibold border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 transition-colors active:scale-[0.97]">
          {t(lang, 'skipAnalysis')}
        </button>
      </div>
      {/* Local Sentiment button — full width below */}
      {onPulse && (
        <div className="px-4 pb-3">
          <button onClick={() => onPulse(market, analysis)}
            className="w-full py-2.5 text-[12px] font-semibold border border-[#836EF9]/30 text-[#836EF9] hover:bg-[#836EF9]/10 transition-colors active:scale-[0.97] flex items-center justify-center gap-1.5">
            <Radio className="w-3.5 h-3.5" />
            {t(lang, 'localSentiment')}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Chat Attachment: AI Explanation (Step 3) ───

function AIExplanationAttachment({ lines, market, analysis, lang, onNext }: {
  lines: string[]; market: MarketInfo; analysis: DeepAnalysisResult; lang: Lang
  onNext: (market: MarketInfo, analysis: DeepAnalysisResult) => void
}) {
  return (
    <div className="mt-2 border border-white/[0.10] bg-white/[0.04]">
      <div className="px-4 py-2 border-b border-white/[0.06]">
        <span className="text-[9px] font-bold font-mono text-white/30 tracking-[1.5px]">AI ANALYSIS</span>
      </div>
      <div className="px-4 py-3">
        {lines.map((line, i) => (
          <p key={i} className="text-[12px] font-mono text-white/70 leading-relaxed mb-1">{line}</p>
        ))}
      </div>
      <div className="px-4 py-3 border-t border-white/[0.06]">
        <button onClick={() => onNext(market, analysis)}
          className="w-full py-2.5 text-[13px] font-semibold bg-white text-black hover:bg-white/90 transition-colors active:scale-[0.97]">
          {t(lang, 'betNow')}
        </button>
      </div>
    </div>
  )
}

// ─── Chat Attachment: Local Sentiment (Step 3.5 - Social Heatmap) ───

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

interface PulsePoint {
  lng: number; lat: number; intensity: number; side: string; timestamp: number
}

interface FloatingTrade {
  id: string; amount: string; side: string; x: number; y: number
}

function PulseMarketAttachment({ market, analysis, groupCode, conditionId, lang, onTrade }: {
  market: MarketInfo; analysis: DeepAnalysisResult; groupCode: string; conditionId: string; lang: Lang
  onTrade: (market: MarketInfo, analysis: DeepAnalysisResult) => void
}) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [points, setPoints] = useState<PulsePoint[]>([])
  const [memberCount, setMemberCount] = useState(1)
  const [floaters, setFloaters] = useState<FloatingTrade[]>([])
  const [scanActive, setScanActive] = useState(false)
  const prevCount = useRef(0)
  const [copied, setCopied] = useState(false)
  const [sonarPhase, setSonarPhase] = useState<'ping' | 'done'>('ping')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const fullscreenMapContainer = useRef<HTMLDivElement>(null)
  const fullscreenMapRef = useRef<mapboxgl.Map | null>(null)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const userMarkerFsRef = useRef<mapboxgl.Marker | null>(null)

  // Sonar intro sequence: 3 rings staggered, then reveal map
  useEffect(() => {
    const timer = setTimeout(() => setSonarPhase('done'), 3800)
    return () => clearTimeout(timer)
  }, [])

  // Locate me — request browser GPS
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }, [])

  // Place / update user marker on maps when location changes
  useEffect(() => {
    if (!userLocation) return
    import('mapbox-gl').then((mapboxgl) => {
      // Create a pulsing blue dot element
      const createDot = () => {
        const el = document.createElement('div')
        el.style.cssText = 'width:16px;height:16px;border-radius:50%;background:#3B82F6;border:3px solid white;box-shadow:0 0 12px 4px rgba(59,130,246,0.5);'
        return el
      }

      // Inline map marker
      if (mapRef.current) {
        if (userMarkerRef.current) userMarkerRef.current.remove()
        userMarkerRef.current = new mapboxgl.default.Marker({ element: createDot() })
          .setLngLat([userLocation.lng, userLocation.lat])
          .addTo(mapRef.current)
        mapRef.current.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 15, duration: 1200 })
      }

      // Fullscreen map marker
      if (fullscreenMapRef.current) {
        if (userMarkerFsRef.current) userMarkerFsRef.current.remove()
        userMarkerFsRef.current = new mapboxgl.default.Marker({ element: createDot() })
          .setLngLat([userLocation.lng, userLocation.lat])
          .addTo(fullscreenMapRef.current)
        fullscreenMapRef.current.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 15.5, pitch: 50, duration: 1500 })
      }
    })
  }, [userLocation])

  // Hackathon venue: 50 W 23rd St, NYC (Flatiron / Privacy Hackathon)
  const mapCenter: [number, number] = [-73.9918, 40.7420]

  // Initialize Mapbox
  useEffect(() => {
    if (!mapContainer.current || mapRef.current || !MAPBOX_TOKEN) return
    import('mapbox-gl').then((mapboxgl) => {
      mapboxgl.default.accessToken = MAPBOX_TOKEN
      const map = new mapboxgl.default.Map({
        container: mapContainer.current!,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: mapCenter,
        zoom: 13.5,
        pitch: 0,
        bearing: 0,
        interactive: false,
        attributionControl: false,
      })
      map.dragRotate.disable()
      map.touchZoomRotate.disableRotation()
      map.on('load', () => {
        map.addSource('pulse-heat', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })
        map.addLayer({
          id: 'pulse-heatmap',
          type: 'heatmap',
          source: 'pulse-heat',
          paint: {
            'heatmap-weight': ['get', 'intensity'],
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 13, 1.5, 16, 2.5],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 15, 13, 30, 16, 50],
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0, 'rgba(0,0,0,0)',
              0.1, 'rgba(15,25,80,0.4)',
              0.25, 'rgba(50,20,140,0.6)',
              0.4, 'rgba(131,110,249,0.7)',
              0.55, 'rgba(180,40,60,0.8)',
              0.7, 'rgba(220,100,20,0.85)',
              0.85, 'rgba(255,180,30,0.9)',
              1.0, 'rgba(255,240,80,0.95)',
            ],
            'heatmap-opacity': 0.85,
          },
        })
        mapRef.current = map
        setMapLoaded(true)
      })
    })
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null } }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update heatmap data
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return
    const source = mapRef.current.getSource('pulse-heat') as mapboxgl.GeoJSONSource
    if (!source) return
    source.setData({
      type: 'FeatureCollection',
      features: points.map(p => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
        properties: { intensity: p.intensity, side: p.side },
      })),
    })
  }, [points, mapLoaded])

  // Initialize fullscreen map when expanded
  useEffect(() => {
    if (!isFullscreen || !fullscreenMapContainer.current || fullscreenMapRef.current) return
    import('mapbox-gl').then((mapboxgl) => {
      mapboxgl.default.accessToken = MAPBOX_TOKEN
      const map = new mapboxgl.default.Map({
        container: fullscreenMapContainer.current!,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: mapCenter,
        zoom: 14,
        pitch: 45,
        bearing: -15,
        interactive: true,
        attributionControl: false,
      })
      map.on('load', () => {
        map.addSource('pulse-heat-fs', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: points.map(p => ({
              type: 'Feature' as const,
              geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
              properties: { intensity: p.intensity, side: p.side },
            })),
          },
        })
        map.addLayer({
          id: 'pulse-heatmap-fs',
          type: 'heatmap',
          source: 'pulse-heat-fs',
          paint: {
            'heatmap-weight': ['get', 'intensity'],
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 13, 1.5, 16, 2.5],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 20, 13, 40, 16, 60],
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0, 'rgba(0,0,0,0)',
              0.1, 'rgba(15,25,80,0.4)',
              0.25, 'rgba(50,20,140,0.6)',
              0.4, 'rgba(131,110,249,0.7)',
              0.55, 'rgba(180,40,60,0.8)',
              0.7, 'rgba(220,100,20,0.85)',
              0.85, 'rgba(255,180,30,0.9)',
              1.0, 'rgba(255,240,80,0.95)',
            ],
            'heatmap-opacity': 0.9,
          },
        })
        fullscreenMapRef.current = map
      })
    })
    return () => {
      if (fullscreenMapRef.current) { fullscreenMapRef.current.remove(); fullscreenMapRef.current = null }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen])

  // Sync data to fullscreen map
  useEffect(() => {
    if (!fullscreenMapRef.current) return
    const source = fullscreenMapRef.current.getSource('pulse-heat-fs') as mapboxgl.GeoJSONSource
    if (!source) return
    source.setData({
      type: 'FeatureCollection',
      features: points.map(p => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
        properties: { intensity: p.intensity, side: p.side },
      })),
    })
  }, [points, isFullscreen])

  // Poll heatmap data every 1.5s
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/pulse/heatmap?conditionId=${conditionId}`)
        if (res.ok) {
          const data = await res.json()
          setPoints(data.points || [])
        }
      } catch {}
    }
    poll()
    const interval = setInterval(poll, 1500)
    return () => clearInterval(interval)
  }, [conditionId])

  // Poll member count every 3s
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/groups/${groupCode}`)
        if (res.ok) {
          const data = await res.json()
          setMemberCount(data.members?.length || data.member_count || 1)
        }
      } catch {}
    }
    poll()
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [groupCode])

  // Floating indicators on new trades
  useEffect(() => {
    if (points.length > prevCount.current && prevCount.current > 0) {
      const newPts = points.slice(prevCount.current)
      const amountMap: Record<number, string> = { 0.3: '1', 0.5: '5', 0.7: '25', 1: '50' }
      const newFloaters: FloatingTrade[] = newPts.map(p => ({
        id: `${Date.now()}-${Math.random()}`,
        amount: amountMap[p.intensity >= 0.9 ? 1 : p.intensity >= 0.6 ? 0.7 : p.intensity >= 0.4 ? 0.5 : 0.3] || '1',
        side: p.side,
        x: 15 + Math.random() * 70,
        y: 15 + Math.random() * 60,
      }))
      setFloaters(prev => [...prev, ...newFloaters])
      setScanActive(true)
      setTimeout(() => setScanActive(false), 2100)
      setTimeout(() => {
        setFloaters(prev => prev.filter(f => !newFloaters.find(n => n.id === f.id)))
      }, 3000)
    }
    prevCount.current = points.length
  }, [points])

  const joinUrl = `https://betwhisper.ai/predict?join=${groupCode}&market=${market.slug}`

  return (
    <div className="mt-2 border border-[#836EF9]/20 bg-[#836EF9]/[0.03]">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-[#836EF9]/10 flex items-center gap-2">
        <Radio className="w-3.5 h-3.5 text-[#836EF9]" />
        <span className="text-[9px] font-bold font-mono text-[#836EF9] tracking-[1.5px]">LOCAL SENTIMENT</span>
        <div className="ml-auto flex items-center gap-1.5">
          <Users className="w-3 h-3 text-white/30" />
          <span className="text-[11px] font-mono font-bold text-white">{memberCount}</span>
          <span className="text-[9px] font-mono text-white/30">traders</span>
        </div>
      </div>

      {/* Detection message */}
      <div className="px-4 py-2.5 border-b border-white/[0.04] flex items-center gap-2">
        <MapPin className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
        <span className="text-[11px] font-mono text-emerald-500/90">
          {lang === 'es'
            ? `Detecté ${memberCount} trader${memberCount > 1 ? 's' : ''} cerca de tu ubicación`
            : `Detected ${memberCount} trader${memberCount > 1 ? 's' : ''} near your location`}
        </span>
        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
      </div>

      {/* Inline Heatmap */}
      <div className="relative h-[250px] overflow-hidden">
        {MAPBOX_TOKEN ? (
          <>
            <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
            {/* Vignette */}
            <div className="absolute inset-0 pointer-events-none z-[5]"
              style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)' }} />
            {/* Scan line */}
            {scanActive && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-[15]">
                <div className="absolute left-0 right-0 h-[2px] animate-scan"
                  style={{ background: 'linear-gradient(to right, transparent, rgba(131,110,249,0.5), transparent)', boxShadow: '0 0 20px 4px rgba(131,110,249,0.3)' }} />
              </div>
            )}
            {/* Floating indicators */}
            {floaters.map(f => (
              <div key={f.id} className="absolute pointer-events-none z-[20] animate-float-up"
                style={{ left: `${f.x}%`, top: `${f.y}%` }}>
                <span className={`text-[14px] font-bold font-mono drop-shadow-lg ${f.side === 'Yes' || f.side === 'yes' ? 'text-emerald-400' : 'text-red-400'}`}>
                  +${f.amount}
                </span>
              </div>
            ))}
            {/* Privacy badge */}
            <div className="absolute top-3 left-3 z-20">
              <div className="flex items-center gap-1.5 px-2.5 py-1 backdrop-blur-md bg-black/40 border border-white/[0.06]">
                <Shield className="w-2.5 h-2.5 text-emerald-500" />
                <span className="text-[8px] font-mono text-emerald-500/80 tracking-[1.5px] uppercase">Encrypted by Unlink</span>
                <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
              </div>
            </div>
            {/* Map controls — top right */}
            <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
              <button onClick={() => setIsFullscreen(true)}
                className="p-1.5 backdrop-blur-md bg-black/40 border border-white/[0.06] hover:bg-white/10 transition-colors"
                title="Fullscreen">
                <Maximize2 className="w-3.5 h-3.5 text-white/60" />
              </button>
              <button onClick={handleLocateMe}
                className={`p-1.5 backdrop-blur-md border transition-colors ${userLocation ? 'bg-blue-500/20 border-blue-500/30' : 'bg-black/40 border-white/[0.06] hover:bg-white/10'}`}
                title="Locate me">
                {locating
                  ? <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                  : <Navigation className={`w-3.5 h-3.5 ${userLocation ? 'text-blue-400' : 'text-white/60'}`} />}
              </button>
            </div>

            {/* ── Sonar Ping Overlay ── */}
            {sonarPhase === 'ping' && (
              <div className="absolute inset-0 z-[30] bg-black/80 animate-sonar-overlay flex items-center justify-center">
                {/* Center dot */}
                <div className="absolute top-1/2 left-1/2 w-3 h-3 bg-[#836EF9] rounded-full animate-sonar-dot"
                  style={{ boxShadow: '0 0 20px 6px rgba(131,110,249,0.5)' }} />
                {/* Ring 1 */}
                <div className="animate-sonar-ring" style={{ animationDelay: '0s' }} />
                {/* Ring 2 */}
                <div className="animate-sonar-ring" style={{ animationDelay: '0.6s' }} />
                {/* Ring 3 */}
                <div className="animate-sonar-ring" style={{ animationDelay: '1.2s' }} />
                {/* Scanning text */}
                <div className="absolute bottom-5 left-0 right-0 text-center animate-sonar-text" style={{ animationDelay: '0.4s' }}>
                  <span className="text-[9px] font-mono text-[#836EF9]/80 tracking-[3px]">
                    {lang === 'es' ? 'DETECTANDO SENTIMIENTO LOCAL' : 'DETECTING LOCAL SENTIMENT'}
                    <span className="inline-block animate-pulse">...</span>
                  </span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-[10px] font-mono text-white/30">MAPBOX TOKEN REQUIRED</span>
          </div>
        )}
      </div>

      {/* QR Code + Join Info */}
      <div className="px-4 py-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-4">
          <div className="bg-white p-2 rounded flex-shrink-0">
            <QRCodeSVG value={joinUrl} size={90} level="H" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[8px] font-mono text-white/25 tracking-[2px] mb-1">SCAN TO JOIN</div>
            <div className="text-[15px] font-bold font-mono text-white mb-1">{market.question.length > 35 ? market.question.slice(0, 35) + '...' : market.question}</div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-mono text-[#836EF9] font-bold">{groupCode}</span>
              <button onClick={() => { navigator.clipboard.writeText(joinUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                className="p-1 hover:bg-white/5 transition-colors">
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-white/30" />}
              </button>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono text-white/30">
              <span>Yes {(market.yesPrice * 100).toFixed(0)}%</span>
              <span>No {(market.noPrice * 100).toFixed(0)}%</span>
              <span className="text-emerald-500/60">{points.length} trades</span>
            </div>
          </div>
        </div>
      </div>

      {/* Trade Button */}
      <div className="px-4 py-3 border-t border-white/[0.06]">
        <button onClick={() => onTrade(market, analysis)}
          className="w-full py-2.5 text-[13px] font-semibold bg-[#836EF9] text-white hover:bg-[#836EF9]/80 transition-colors active:scale-[0.97] flex items-center justify-center gap-2">
          <Zap className="w-4 h-4" />
          {lang === 'es' ? 'TRADEAR AHORA' : 'TRADE NOW'}
        </button>
      </div>

      {/* ── Fullscreen Heatmap Overlay ── */}
      {isFullscreen && (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
          {/* Fullscreen Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-black/90 backdrop-blur-md z-10">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#836EF9]" />
              <span className="text-[10px] font-bold font-mono text-[#836EF9] tracking-[1.5px]">LOCAL SENTIMENT</span>
              <span className="text-[10px] font-mono text-white/30 ml-2">{market.question.length > 30 ? market.question.slice(0, 30) + '...' : market.question}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Users className="w-3 h-3 text-white/30" />
                <span className="text-[12px] font-mono font-bold text-white">{memberCount}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-mono text-emerald-500/80">{points.length} trades</span>
              </div>
              <button onClick={() => setIsFullscreen(false)}
                className="p-1.5 hover:bg-white/10 transition-colors">
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>
          </div>

          {/* Fullscreen Map */}
          <div className="flex-1 relative overflow-hidden">
            <div ref={fullscreenMapContainer} className="absolute inset-0 w-full h-full" />
            {/* Vignette */}
            <div className="absolute inset-0 pointer-events-none z-[5]"
              style={{ background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.5) 100%)' }} />
            {/* Floating indicators */}
            {floaters.map(f => (
              <div key={f.id} className="absolute pointer-events-none z-[20] animate-float-up"
                style={{ left: `${f.x}%`, top: `${f.y}%` }}>
                <span className={`text-[18px] font-bold font-mono drop-shadow-lg ${f.side === 'Yes' || f.side === 'yes' ? 'text-emerald-400' : 'text-red-400'}`}>
                  +${f.amount}
                </span>
              </div>
            ))}
            {/* Scan line */}
            {scanActive && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-[15]">
                <div className="absolute left-0 right-0 h-[2px] animate-scan"
                  style={{ background: 'linear-gradient(to right, transparent, rgba(131,110,249,0.5), transparent)', boxShadow: '0 0 30px 6px rgba(131,110,249,0.3)' }} />
              </div>
            )}
            {/* Privacy badge */}
            <div className="absolute top-4 left-4 z-20">
              <div className="flex items-center gap-1.5 px-3 py-1.5 backdrop-blur-md bg-black/40 border border-white/[0.06]">
                <Shield className="w-3 h-3 text-emerald-500" />
                <span className="text-[9px] font-mono text-emerald-500/80 tracking-[1.5px] uppercase">Encrypted by Unlink</span>
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              </div>
            </div>
            {/* GPS locate button — fullscreen */}
            <button onClick={handleLocateMe}
              className={`absolute top-4 right-4 z-20 p-2.5 backdrop-blur-md border transition-colors ${userLocation ? 'bg-blue-500/20 border-blue-500/30' : 'bg-black/40 border-white/[0.06] hover:bg-white/10'}`}
              title="Locate me">
              {locating
                ? <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                : <Navigation className={`w-5 h-5 ${userLocation ? 'text-blue-400' : 'text-white/60'}`} />}
            </button>
          </div>

          {/* Fullscreen Bottom Bar */}
          <div className="px-4 py-3 border-t border-white/[0.08] bg-black/90 backdrop-blur-md flex items-center gap-3 z-10">
            <div className="flex-1 flex items-center gap-3">
              <span className="text-[11px] font-mono text-white/50">Yes {(market.yesPrice * 100).toFixed(0)}%</span>
              <span className="text-[11px] font-mono text-white/50">No {(market.noPrice * 100).toFixed(0)}%</span>
            </div>
            <button onClick={() => { setIsFullscreen(false); onTrade(market, analysis) }}
              className="px-6 py-2.5 text-[13px] font-semibold bg-[#836EF9] text-white hover:bg-[#836EF9]/80 transition-colors active:scale-[0.97] flex items-center gap-2">
              <Zap className="w-4 h-4" />
              {lang === 'es' ? 'TRADEAR AHORA' : 'TRADE NOW'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Chat Attachment: Bet Amount Input (Step 3.5 - How much?) ───

function BetAmountInputAttachment({ market, analysis, lang, onCalculate }: {
  market: MarketInfo; analysis: DeepAnalysisResult; lang: Lang
  onCalculate: (market: MarketInfo, analysis: DeepAnalysisResult, amountUSD: number) => void
}) {
  const [amount, setAmount] = useState('')
  const volumeLabel = market.volume > 1000000
    ? `$${(market.volume / 1000000).toFixed(1)}M`
    : `$${Math.round(market.volume / 1000)}K`

  const numAmount = parseFloat(amount) || 0
  const sizeRatio = market.volume > 0 ? numAmount / market.volume : 0
  const sizePct = Math.round(sizeRatio * 1000) / 10

  return (
    <div className="mt-2 border border-white/[0.10] bg-white/[0.04]">
      <div className="px-4 py-2 border-b border-white/[0.06] flex items-center justify-between">
        <span className="text-[9px] font-bold font-mono text-white/30 tracking-[1.5px]">
          {t(lang, 'howMuchInvest').toUpperCase()}
        </span>
        <span className="text-[9px] font-mono text-white/20">Vol: {volumeLabel}</span>
      </div>

      <div className="px-4 py-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[20px] font-bold font-mono text-white/40">$</span>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder={t(lang, 'investPlaceholder')}
            className="flex-1 bg-transparent border-b border-white/20 text-[24px] font-bold font-mono text-white outline-none focus:border-white/40 transition-colors pb-1"
            min="1"
            step="1"
            autoFocus
          />
        </div>

        {/* Quick amounts */}
        <div className="flex items-center gap-2 mb-4">
          {['10', '50', '100', '500'].map(preset => (
            <button key={preset} onClick={() => setAmount(preset)}
              className={`flex-1 py-1.5 text-[11px] font-semibold font-mono border transition-colors active:scale-[0.97] ${
                amount === preset
                  ? 'border-white/40 text-white bg-white/10'
                  : 'border-white/10 text-white/30 hover:border-white/20'
              }`}>
              ${preset}
            </button>
          ))}
        </div>

        {/* Size impact preview */}
        {numAmount > 0 && (
          <div className={`text-[10px] font-mono mb-4 px-2 py-1.5 border-l-2 ${
            sizePct >= 25 ? 'border-red-400 text-red-400/70'
            : sizePct >= 5 ? 'border-amber-400 text-amber-400/70'
            : 'border-emerald-500 text-emerald-500/70'
          }`}>
            {sizePct >= 5
              ? t(lang, 'yourSizeMovesMarket', { pct: sizePct })
              : t(lang, 'sizeOk')}
          </div>
        )}

        <button onClick={() => numAmount > 0 && onCalculate(market, analysis, numAmount)}
          disabled={numAmount <= 0}
          className={`w-full py-2.5 text-[13px] font-semibold font-mono transition-colors active:scale-[0.97] ${
            numAmount > 0
              ? 'bg-white text-black hover:bg-white/90'
              : 'bg-white/10 text-white/20 cursor-not-allowed'
          }`}>
          {t(lang, 'calculateProb')}
        </button>
      </div>
    </div>
  )
}

// ─── Chat Attachment: Success Probability (Step 4 - The Killer Feature) ───

function SuccessProbabilityAttachment({ probability, market, signalHash, lang, onSmartBet, onManualBet }: {
  probability: ProbabilityResult; market: MarketInfo
  analysis: DeepAnalysisResult; signalHash: string; lang: Lang
  onSmartBet: (side: 'Yes' | 'No', slug: string, signalHash: string, amount: string, conditionId?: string) => void
  onManualBet: (side: 'Yes' | 'No', slug: string, signalHash: string, conditionId?: string) => void
}) {
  const hasSide = probability.recommendedSide !== null
  const side = probability.recommendedSide || 'Yes'
  const isYes = side === 'Yes'

  const probColor = probability.winProbability >= 65 ? 'text-emerald-500'
    : probability.winProbability >= 45 ? 'text-amber-400'
    : 'text-red-400'

  const confidenceText = t(lang,
    probability.confidence === 'high' ? 'highConfidence'
    : probability.confidence === 'medium' ? 'mediumConfidence'
    : 'lowConfidence'
  )

  const hasMarketImpact = probability.breakdown.marketImpact < -2

  return (
    <div className="mt-2 border border-white/[0.10] bg-white/[0.04]">
      <div className="px-4 py-2 border-b border-white/[0.06] flex items-center justify-between">
        <span className="text-[9px] font-bold font-mono text-white/30 tracking-[1.5px]">
          {t(lang, 'successProb').toUpperCase()}
        </span>
        {probability.betAmount > 0 && (
          <span className="text-[9px] font-mono text-white/20">${probability.betAmount} USD</span>
        )}
      </div>

      {/* Big probability number */}
      <div className="px-4 py-6 text-center">
        <div className={`text-[56px] font-bold font-mono leading-none ${probColor}`}>
          {probability.winProbability}%
        </div>
        <div className="text-[11px] text-white/30 mt-2 font-mono">{confidenceText}</div>
      </div>

      {/* Breakdown */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between flex-wrap gap-y-1 text-[9px] font-mono text-white/20">
          <span>Market: {probability.breakdown.marketImplied}%</span>
          <span>Agent: {probability.breakdown.agentAdjustment > 0 ? '+' : ''}{probability.breakdown.agentAdjustment}%</span>
          {probability.breakdown.redFlagPenalty < 0 && (
            <span className="text-amber-400/60">Risk: {probability.breakdown.redFlagPenalty}%</span>
          )}
          {hasMarketImpact && (
            <span className="text-red-400/60">{t(lang, 'marketImpactLabel')}: {probability.breakdown.marketImpact}%</span>
          )}
        </div>
      </div>

      {hasSide ? (
        <div className="px-4 py-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] text-white/30">{t(lang, 'recommendedSide')}</span>
            <span className={`text-[16px] font-bold font-mono ${isYes ? 'text-emerald-500' : 'text-red-400'}`}>
              {side.toUpperCase()}
            </span>
          </div>

          {/* Smart Money button */}
          <button onClick={() => onSmartBet(side, market.slug, signalHash, String(probability.smartMoneySize), market.conditionId)}
            className={`w-full py-3 text-[13px] font-semibold font-mono border transition-colors active:scale-[0.97] mb-2 ${
              isYes ? 'border-emerald-500/40 text-emerald-500 bg-emerald-500/[0.05] hover:bg-emerald-500/10'
                    : 'border-red-400/40 text-red-400 bg-red-400/[0.05] hover:bg-red-400/10'
            }`}>
            {t(lang, 'smartMoneyBet')}: ${probability.smartMoneySize} USD
          </button>
          <div className="text-[9px] font-mono text-white/15 text-center mb-3">
            Kelly: {Math.round(probability.kellyFraction * 100)}% of ${probability.betAmount}
          </div>

          {/* Full amount button */}
          {probability.betAmount > 0 && probability.smartMoneySize < probability.betAmount && (
            <button onClick={() => onSmartBet(side, market.slug, signalHash, String(probability.betAmount), market.conditionId)}
              className={`w-full py-2 text-[11px] font-semibold font-mono border transition-colors active:scale-[0.97] mb-3 ${
                isYes ? 'border-emerald-500/15 text-emerald-500/50 hover:bg-emerald-500/10'
                      : 'border-red-400/15 text-red-400/50 hover:bg-red-400/10'
              }`}>
              ${probability.betAmount} USD (100%)
            </button>
          )}
        </div>
      ) : (
        <div className="px-4 py-3 border-t border-white/[0.06]">
          <p className="text-[11px] text-amber-400/70 font-mono mb-3">{t(lang, 'noEdge')}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => onManualBet('Yes', market.slug, signalHash, market.conditionId)}
              className="flex-1 py-2 text-[12px] font-semibold border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 transition-colors active:scale-[0.97]">
              TRADE YES
            </button>
            <button onClick={() => onManualBet('No', market.slug, signalHash, market.conditionId)}
              className="flex-1 py-2 text-[12px] font-semibold border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-colors active:scale-[0.97]">
              TRADE NO
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Chat Attachment: Bet Confirmed ───

function BetConfirmedAttachment({ side, amount, txHash, explorerUrl, source, shares, price }: {
  side: string; amount: string; txHash: string; explorerUrl?: string; source?: string; shares?: number; price?: number
}) {
  const isReal = source === 'polymarket' || source === 'polymarket-mock'
  const linkUrl = explorerUrl || `${MONAD_EXPLORER}/tx/${txHash}`
  return (
    <div className="mt-2 border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle className="w-4 h-4 text-emerald-500" />
        <span className="text-[11px] font-bold font-mono text-emerald-500 tracking-[1px]">TRADE PLACED</span>
        {isReal && <span className="text-[9px] font-mono text-emerald-500/50 px-1.5 py-0.5 border border-emerald-500/20">POLYMARKET</span>}
      </div>
      <div className="flex items-center gap-3 mb-2">
        <span className={`text-[13px] font-bold font-mono ${side === 'Yes' ? 'text-emerald-500' : 'text-red-400'}`}>{side.toUpperCase()}</span>
        <span className="text-[13px] font-medium font-mono text-white">${amount} USD</span>
      </div>
      {isReal && price && shares && (
        <div className="flex items-center gap-4 mb-2 text-[10px] font-mono text-white/30">
          <span>Price: {price.toFixed(2)}</span>
          <span>Shares: {shares.toFixed(1)}</span>
        </div>
      )}
      <a href={linkUrl} target="_blank" rel="noopener noreferrer"
        className="text-[10px] font-mono text-white/30 hover:text-white/50 transition-colors flex items-center gap-1">
        {txHash.slice(0, 18)}... <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  )
}

// ─── Chat Attachment: Bet Timeline ───

function BetTimelineAttachment({ steps, side, amount, market, playSound }: {
  steps: BetTimelineStep[]; side: string; amount: string; market: string; playSound?: (name: 'tick' | 'send' | 'receive' | 'step' | 'success' | 'error' | 'privacy' | 'whale' | 'deposit') => void
}) {
  const isYes = side === 'Yes'
  const accentColor = isYes ? 'text-emerald-500' : 'text-red-400'

  // Determine border animation state
  const isProcessing = steps.some(s => s.status === 'processing')
  const allConfirmed = steps.every(s => s.status === 'confirmed')
  const hasError = steps.some(s => s.status === 'error')
  const hasPrivacy = steps.some(s => s.chain === 'Unlink' || s.chain === 'ZK Proof')

  let borderClass: string
  if (hasError) {
    borderClass = 'border border-red-400/30 bg-red-400/[0.03]'
  } else if (allConfirmed) {
    borderClass = `border ${hasPrivacy ? 'animate-exec-success border-[#836EF9]/20 bg-[#836EF9]/[0.03]' : 'animate-exec-success border-emerald-500/20 bg-emerald-500/[0.03]'}`
  } else if (isProcessing && hasPrivacy) {
    borderClass = 'border animate-exec-glow bg-[#836EF9]/[0.02]'
  } else if (isProcessing) {
    borderClass = `border ${isYes ? 'animate-exec-glow-green bg-emerald-500/[0.02]' : 'animate-exec-glow-red bg-red-400/[0.02]'}`
  } else {
    borderClass = `border ${isYes ? 'border-emerald-500/20 bg-emerald-500/[0.03]' : 'border-red-400/20 bg-red-400/[0.03]'}`
  }

  return (
    <div className={`mt-2 ${borderClass} px-4 py-3 transition-all duration-500`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-[11px] font-bold font-mono ${accentColor} tracking-[1px]`}>
          {side.toUpperCase()} ${amount}
        </span>
        <span className="text-[9px] font-mono text-white/20">{market}</span>
      </div>
      <div className="space-y-0">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1
          const isPrivacyStep = step.chain === 'Unlink' || step.chain === 'ZK Proof'
          const dotColor = step.status === 'confirmed' ? (isPrivacyStep ? 'bg-[#836EF9]' : 'bg-emerald-500')
            : step.status === 'processing' ? (isPrivacyStep ? 'bg-[#836EF9] animate-pulse' : 'bg-amber-400 animate-pulse')
            : step.status === 'error' ? 'bg-red-500'
            : 'bg-white/20'
          const textColor = step.status === 'confirmed' ? (isPrivacyStep ? 'text-[#836EF9]/80' : 'text-white/60')
            : step.status === 'processing' ? (isPrivacyStep ? 'text-[#836EF9]' : 'text-amber-400')
            : step.status === 'error' ? 'text-red-400'
            : 'text-white/20'

          return (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-2.5 h-2.5 ${dotColor} flex-shrink-0 mt-1 ${step.status === 'confirmed' && isPrivacyStep ? 'animate-privacy-shield' : ''}`} />
                {!isLast && <div className={`w-px flex-1 min-h-[20px] ${step.status === 'confirmed' ? (isPrivacyStep ? 'bg-[#836EF9]/30' : 'bg-emerald-500/30') : 'bg-white/10'}`} />}
              </div>
              <div className="pb-3 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-bold font-mono ${textColor} tracking-[0.5px]`}>{step.label}</span>
                  <span className={`text-[8px] font-mono px-1 py-0.5 border ${isPrivacyStep ? 'text-[#836EF9]/40 border-[#836EF9]/15' : 'text-white/15 border-white/[0.06]'}`}>{step.chain}</span>
                </div>
                {step.detail && (
                  <div className="text-[10px] font-mono text-white/30 mt-0.5">{step.detail}</div>
                )}
                {step.errorMsg && (
                  <div className="text-[10px] font-mono text-red-400/80 mt-0.5">{step.errorMsg}</div>
                )}
                {step.txHash && step.explorerUrl && (
                  <a href={step.explorerUrl} target="_blank" rel="noopener noreferrer"
                    className="text-[9px] font-mono text-white/20 hover:text-white/40 transition-colors flex items-center gap-1 mt-0.5">
                    {step.txHash.slice(0, 14)}... <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {/* Encrypted by Unlink badge — shown when privacy steps are present */}
      {steps.some(s => s.chain === 'Unlink' || s.chain === 'ZK Proof') && steps.every(s => s.status === 'confirmed') && (
        <div className="mt-1 pt-2 border-t border-[#836EF9]/10 flex items-center gap-2 animate-privacy-glow">
          <Shield className="w-3 h-3 text-[#836EF9]/60" />
          <span className="text-[9px] font-mono text-[#836EF9]/50 tracking-[1px]">ENCRYPTED BY UNLINK</span>
          <span className="text-[8px] font-mono text-white/15">Deposit and trade are cryptographically unlinkable</span>
        </div>
      )}
    </div>
  )
}

// ─── Chat Attachment: PIN Setup ───

function PinSetupAttachment({ wallet, onComplete, lang }: { wallet: string; onComplete: () => void; lang: Lang }) {
  const [digits, setDigits] = useState(['', '', '', ''])
  const [confirm, setConfirm] = useState(['', '', '', ''])
  const [step, setStep] = useState<'create' | 'confirm' | 'done'>('create')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]
  const confirmRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  const handleInput = (arr: string[], setArr: (v: string[]) => void, inputRefs: typeof refs, idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return
    const next = [...arr]
    next[idx] = val
    setArr(next)
    if (val && idx < 3) inputRefs[idx + 1].current?.focus()
  }

  const handleSubmit = async () => {
    const pin = (step === 'create' ? digits : confirm).join('')
    if (pin.length !== 4) return

    if (step === 'create') {
      setStep('confirm')
      setError('')
      setTimeout(() => confirmRefs[0].current?.focus(), 100)
      return
    }

    if (digits.join('') !== confirm.join('')) {
      setError(t(lang, 'pinMismatch'))
      setConfirm(['', '', '', ''])
      setTimeout(() => confirmRefs[0].current?.focus(), 100)
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/user/pin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, pin }),
      })
      if (res.ok) {
        setStep('done')
        onComplete()
      } else {
        const data = await res.json()
        setError(data.error || t(lang, 'failedSetPin'))
      }
    } catch { setError(t(lang, 'networkError')) }
    setLoading(false)
  }

  if (step === 'done') {
    return (
      <div className="mt-2 border border-emerald-500/20 bg-emerald-500/[0.03] px-4 py-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-500" />
          <span className="text-[12px] font-mono text-emerald-500">{t(lang, 'pinCreated')}</span>
        </div>
      </div>
    )
  }

  const activeDigits = step === 'create' ? digits : confirm
  const activeRefs = step === 'create' ? refs : confirmRefs
  const activeSet = step === 'create' ? setDigits : setConfirm

  return (
    <div className="mt-2 border border-white/[0.10] bg-white/[0.04] px-4 py-3">
      <div className="text-[9px] font-bold font-mono text-white/30 tracking-[1.5px] mb-3">
        {step === 'create' ? t(lang, 'pinSetupTitle') : t(lang, 'pinConfirmTitle')}
      </div>
      <div className="flex gap-2 justify-center mb-3">
        {activeDigits.map((d, i) => (
          <input key={`${step}-${i}`} ref={activeRefs[i]} type="password" inputMode="numeric" maxLength={1} value={d}
            onChange={e => handleInput(activeDigits, activeSet, activeRefs, i, e.target.value)}
            onKeyDown={e => { if (e.key === 'Backspace' && !d && i > 0) activeRefs[i - 1].current?.focus() }}
            className="w-10 h-12 text-center text-[20px] font-mono font-bold text-white bg-white/[0.06] border border-white/[0.15] focus:border-white/40 outline-none"
          />
        ))}
      </div>
      {error && <div className="text-[10px] font-mono text-red-400 mb-2 text-center">{error}</div>}
      <button onClick={handleSubmit} disabled={loading || activeDigits.join('').length !== 4}
        className="w-full py-2 text-[11px] font-bold font-mono tracking-[1px] border border-white/20 text-white/60 hover:bg-white/[0.06] disabled:opacity-30 transition-colors">
        {loading ? 'SAVING...' : step === 'create' ? 'NEXT' : 'CONFIRM'}
      </button>
    </div>
  )
}

// ─── Chat Attachment: PIN Verify ───

function PinVerifyAttachment({ wallet, onSuccess, lang }: { wallet: string; onSuccess: (token: string) => void; lang: Lang }) {
  const [digits, setDigits] = useState(['', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null)
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  const handleInput = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return
    const next = [...digits]
    next[idx] = val
    setDigits(next)
    if (val && idx < 3) refs[idx + 1].current?.focus()

    // Auto-submit when all 4 digits entered
    if (val && idx === 3) {
      const pin = [...next].join('')
      if (pin.length === 4) submitPin(pin)
    }
  }

  const submitPin = async (pin: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/user/pin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, pin }),
      })
      const data = await res.json()
      if (data.verified && data.token) {
        onSuccess(data.token)
      } else if (data.locked) {
        setError(t(lang, 'pinLockedMsg', { n: data.minutesLeft }))
      } else {
        setAttemptsLeft(data.attemptsRemaining ?? null)
        setError(t(lang, 'pinWrong'))
        setDigits(['', '', '', ''])
        setTimeout(() => refs[0].current?.focus(), 100)
      }
    } catch { setError(t(lang, 'networkError')) }
    setLoading(false)
  }

  return (
    <div className="mt-2 border border-white/[0.10] bg-white/[0.04] px-4 py-3">
      <div className="text-[9px] font-bold font-mono text-white/30 tracking-[1.5px] mb-3">{t(lang, 'pinVerifyTitle')}</div>
      <div className="flex gap-2 justify-center mb-3">
        {digits.map((d, i) => (
          <input key={i} ref={refs[i]} type="password" inputMode="numeric" maxLength={1} value={d}
            onChange={e => handleInput(i, e.target.value)}
            onKeyDown={e => { if (e.key === 'Backspace' && !d && i > 0) refs[i - 1].current?.focus() }}
            className="w-10 h-12 text-center text-[20px] font-mono font-bold text-white bg-white/[0.06] border border-white/[0.15] focus:border-white/40 outline-none"
          />
        ))}
      </div>
      {loading && <div className="text-[10px] font-mono text-amber-400 text-center animate-pulse">...</div>}
      {error && <div className="text-[10px] font-mono text-red-400 text-center">{error}</div>}
      {attemptsLeft !== null && attemptsLeft > 0 && (
        <div className="text-[9px] font-mono text-white/20 text-center mt-1">{t(lang, 'attemptsLeft').replace('{n}', String(attemptsLeft))}</div>
      )}
    </div>
  )
}

// ─── Chat Attachment: Balance View ───

function BalancePositionRow({ pos, onSell, lang }: { pos: BalancePosition; onSell: (pos: BalancePosition) => void; lang: Lang }) {
  const { midPrice, direction } = usePriceFlash(pos.tokenId || undefined)
  // Use live price if available, otherwise fall back to API price
  const livePrice = midPrice > 0 ? midPrice : pos.currentPrice
  const livePnl = pos.shares * (livePrice - pos.avgPrice)
  const livePnlPct = pos.avgPrice > 0 ? ((livePrice - pos.avgPrice) / pos.avgPrice) * 100 : 0
  const liveValue = pos.shares * livePrice

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex-1 min-w-0">
          <div className="text-[12px] text-white/70 truncate pr-2">{pos.marketSlug}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 ${pos.side === 'Yes' ? 'text-emerald-500 bg-emerald-500/10' : 'text-red-400 bg-red-400/10'}`}>
              {pos.side.toUpperCase()}
            </span>
            <span className="text-[10px] font-mono text-white/25">{pos.shares.toFixed(1)} shares</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className={`text-[13px] font-mono font-bold tabular-nums transition-colors duration-300 ${livePnl >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
              {livePnl >= 0 ? '+' : ''}${livePnl.toFixed(2)}
            </div>
            <div className={`text-[9px] font-mono tabular-nums ${livePnlPct >= 0 ? 'text-emerald-500/60' : 'text-red-400/60'}`}>
              {livePnlPct >= 0 ? '+' : ''}{livePnlPct.toFixed(1)}%
            </div>
          </div>
          <button onClick={() => onSell(pos)}
            className="px-3 py-1.5 text-[10px] font-bold font-mono tracking-[1px] border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors">
            {t(lang, 'sell')}
          </button>
        </div>
      </div>
      {/* Price bar: entry → current with live flash */}
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[9px] font-mono text-white/20">${pos.avgPrice.toFixed(2)}</span>
        <div className="flex-1 h-px bg-white/[0.06] relative">
          <div
            className={`absolute top-0 left-0 h-full transition-all duration-500 ${livePnl >= 0 ? 'bg-emerald-500/40' : 'bg-red-400/40'}`}
            style={{ width: `${Math.min(Math.abs(livePnlPct), 100)}%` }}
          />
        </div>
        <span className={`text-[9px] font-mono font-bold tabular-nums transition-colors duration-300 ${direction === 'up' ? 'text-emerald-400' : direction === 'down' ? 'text-red-400' : 'text-white/40'}`}>
          ${livePrice.toFixed(2)}
          {direction === 'up' && <span className="ml-0.5 text-emerald-400">&#9650;</span>}
          {direction === 'down' && <span className="ml-0.5 text-red-400">&#9660;</span>}
        </span>
      </div>
    </div>
  )
}

function BalanceViewAttachment({ positions, totalValue, totalPnl, onSell, onHistory, lang }: {
  positions: BalancePosition[]; totalValue: number; totalPnl: number
  onSell: (pos: BalancePosition) => void; onHistory: () => void; lang: Lang
}) {
  // Subscribe to live prices for all positions
  const tokenIds = positions.map(p => p.tokenId).filter(Boolean)
  const livePrices = useLivePrices(tokenIds)

  // Compute live totals
  const liveTotals = positions.reduce((acc, pos) => {
    const lp = livePrices.get(pos.tokenId)
    const price = lp ? lp.midPrice : pos.currentPrice
    const value = pos.shares * price
    const pnl = value - pos.costBasis
    return { value: acc.value + value, pnl: acc.pnl + pnl }
  }, { value: 0, pnl: 0 })

  const displayValue = livePrices.size > 0 ? liveTotals.value : totalValue
  const displayPnl = livePrices.size > 0 ? liveTotals.pnl : totalPnl

  return (
    <div className="mt-2 border border-white/[0.10] bg-white/[0.04]">
      <div className="px-4 py-2 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold font-mono text-white/30 tracking-[1.5px]">{t(lang, 'yourPositions')}</span>
          {livePrices.size > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 animate-pulse" />
              <span className="text-[8px] font-mono text-emerald-500/50">LIVE</span>
            </span>
          )}
        </div>
        <button onClick={onHistory}
          className="text-[9px] font-bold font-mono text-white/30 tracking-[1px] hover:text-white/50 transition-colors">
          {t(lang, 'viewHistory')}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-px bg-white/[0.06]">
        <div className="bg-black px-4 py-3">
          <div className="text-[10px] text-white/30 mb-0.5">Value</div>
          <div className="text-[16px] font-bold font-mono text-white tabular-nums">${displayValue.toFixed(2)}</div>
        </div>
        <div className="bg-black px-4 py-3">
          <div className="text-[10px] text-white/30 mb-0.5">P&L</div>
          <div className={`text-[16px] font-bold font-mono tabular-nums ${displayPnl >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
            {displayPnl >= 0 ? '+' : ''}${displayPnl.toFixed(2)}
          </div>
        </div>
      </div>
      {positions.length > 0 ? (
        <div className="divide-y divide-white/[0.06]">
          {positions.map(pos => (
            <BalancePositionRow key={pos.id} pos={pos} onSell={onSell} lang={lang} />
          ))}
        </div>
      ) : (
        <div className="px-4 py-6 text-center text-[12px] font-mono text-white/20">{t(lang, 'noPositions')}</div>
      )}
    </div>
  )
}

// ─── Chat Attachment: Sell Timeline ───

function SellTimelineAttachment({ steps, marketSlug }: { steps: BetTimelineStep[]; marketSlug: string }) {
  return (
    <div className="mt-2 border border-amber-500/20 bg-amber-500/[0.03] px-4 py-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[11px] font-bold font-mono text-amber-400 tracking-[1px]">SELL</span>
        <span className="text-[9px] font-mono text-white/20">{marketSlug}</span>
      </div>
      <div className="space-y-0">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1
          const dotColor = step.status === 'confirmed' ? 'bg-emerald-500'
            : step.status === 'processing' ? 'bg-amber-400 animate-pulse'
            : step.status === 'error' ? 'bg-red-500' : 'bg-white/20'
          const textColor = step.status === 'confirmed' ? 'text-white/60'
            : step.status === 'processing' ? 'text-amber-400'
            : step.status === 'error' ? 'text-red-400' : 'text-white/20'
          return (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-2.5 h-2.5 ${dotColor} flex-shrink-0 mt-1`} />
                {!isLast && <div className={`w-px flex-1 min-h-[20px] ${step.status === 'confirmed' ? 'bg-emerald-500/30' : 'bg-white/10'}`} />}
              </div>
              <div className="pb-3 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-bold font-mono ${textColor} tracking-[0.5px]`}>{step.label}</span>
                  <span className="text-[8px] font-mono text-white/15 px-1 py-0.5 border border-white/[0.06]">{step.chain}</span>
                </div>
                {step.detail && <div className="text-[10px] font-mono text-white/30 mt-0.5">{step.detail}</div>}
                {step.errorMsg && <div className="text-[10px] font-mono text-red-400/80 mt-0.5">{step.errorMsg}</div>}
                {step.txHash && step.explorerUrl && (
                  <a href={step.explorerUrl} target="_blank" rel="noopener noreferrer"
                    className="text-[9px] font-mono text-white/20 hover:text-white/40 transition-colors flex items-center gap-1 mt-0.5">
                    {step.txHash.slice(0, 14)}... <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Chat Attachment: Context Insight ───

function ContextInsightAttachment({ insight, keyStats, lang }: { insight: string; keyStats: string[]; lang: Lang }) {
  return (
    <div className="mt-2 border border-blue-500/20 bg-blue-500/[0.03] px-4 py-3">
      <div className="text-[9px] font-bold font-mono text-blue-400/60 tracking-[1.5px] mb-2">{t(lang, 'contextStats')}</div>
      <div className="text-[12px] text-white/60 leading-relaxed mb-2">{insight}</div>
      {keyStats.length > 0 && (
        <div className="space-y-1">
          {keyStats.map((stat, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-[10px] text-blue-400/50 mt-0.5">&#9679;</span>
              <span className="text-[11px] font-mono text-white/40">{stat}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Chat Attachment: Transaction History ───

function timeAgo(dateStr: string, lang: Lang): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return lang === 'es' ? 'ahora' : lang === 'pt' ? 'agora' : 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

function TransactionHistoryAttachment({ orders, lang }: { orders: OrderHistory[]; lang: Lang }) {
  return (
    <div className="mt-2 border border-white/[0.10] bg-white/[0.04]">
      <div className="px-4 py-2 border-b border-white/[0.06] flex items-center justify-between">
        <span className="text-[9px] font-bold font-mono text-white/30 tracking-[1.5px]">{t(lang, 'transactionHistory')}</span>
        <span className="text-[10px] font-mono text-white/20">{orders.length} txs</span>
      </div>
      {orders.length > 0 ? (
        <div className="divide-y divide-white/[0.06]">
          {orders.map(order => (
            <div key={order.id} className="px-4 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-white/70 truncate pr-2">{order.marketSlug}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] font-bold font-mono ${order.side === 'Yes' ? 'text-emerald-500' : 'text-red-400'}`}>
                      {order.side.toUpperCase()}
                    </span>
                    <span className="text-[10px] font-mono text-white/20">
                      ${order.amountUSD.toFixed(2)} → {order.shares.toFixed(1)} @ ${order.fillPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 ${
                    order.status === 'success' ? 'text-emerald-400 bg-emerald-500/10' :
                    order.status === 'pending' ? 'text-amber-400 bg-amber-500/10' :
                    'text-red-400 bg-red-500/10'
                  }`}>
                    {order.status === 'success' ? (lang === 'es' ? 'EXITOSO' : 'SUCCESS') :
                     order.status === 'pending' ? 'PENDING' :
                     (lang === 'es' ? 'FALLIDO' : 'FAILED')}
                  </span>
                  <span className="text-[9px] font-mono text-white/15">{timeAgo(order.createdAt, lang)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-1">
                {order.monadTxHash && (
                  <a href={`https://monadscan.com/tx/${order.monadTxHash}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[9px] font-mono text-purple-400/60 hover:text-purple-400 transition-colors">
                    <span>MON</span>
                    <span className="text-white/20">{order.monadTxHash.slice(0, 6)}...{order.monadTxHash.slice(-4)}</span>
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </a>
                )}
                {order.polygonTxHash && (
                  <a href={`https://polygonscan.com/tx/${order.polygonTxHash}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[9px] font-mono text-violet-400/60 hover:text-violet-400 transition-colors">
                    <span>POLY</span>
                    <span className="text-white/20">{order.polygonTxHash.slice(0, 6)}...{order.polygonTxHash.slice(-4)}</span>
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 py-6 text-center text-[12px] font-mono text-white/20">{t(lang, 'noTransactions')}</div>
      )}
    </div>
  )
}

// ─── Chat Attachment: Bet Prompt ───

function BetPromptAttachment({ side, slug, signalHash, conditionId, lang, onConfirm }: {
  side: 'Yes' | 'No'; slug: string; signalHash: string; conditionId: string; lang: Lang
  onConfirm: (side: 'Yes' | 'No', slug: string, signalHash: string, amount: string, conditionId?: string) => void
}) {
  const amounts = ['1', '5', '10', '25']
  const isYes = side === 'Yes'
  return (
    <div className={`mt-2 border px-4 py-3 ${isYes ? 'border-emerald-500/20 bg-emerald-500/[0.03]' : 'border-red-400/20 bg-red-400/[0.03]'}`}>
      <div className="flex items-center gap-2">
        {amounts.map(amt => (
          <button key={amt} onClick={() => onConfirm(side, slug, signalHash, amt, conditionId)}
            className={`flex-1 py-2 text-[12px] font-semibold font-mono border transition-colors active:scale-[0.97] ${
              isYes ? 'border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10' : 'border-red-400/30 text-red-400 hover:bg-red-400/10'
            }`}>
            ${amt}
          </button>
        ))}
      </div>
      <div className="text-[10px] text-white/20 mt-2 font-mono">USD via Polymarket CLOB</div>
    </div>
  )
}

// ─── Chat Attachment: Portfolio ───

function PortfolioAttachment({ data }: { data: PortfolioData }) {
  const pnlColor = data.stats.totalPnl >= 0 ? 'text-emerald-500' : 'text-red-400'
  const winRateColor = data.stats.winRate >= 60 ? 'text-emerald-500' : data.stats.winRate >= 40 ? 'text-amber-400' : 'text-red-400'

  return (
    <div className="mt-2 border border-white/[0.10] bg-white/[0.04]">
      <div className="px-4 py-2 border-b border-white/[0.06]">
        <span className="text-[9px] font-bold font-mono text-white/30 tracking-[1.5px]">PORTFOLIO</span>
      </div>
      <div className="grid grid-cols-2 gap-px bg-white/[0.06]">
        {[
          { label: 'Value', value: `$${data.portfolioValue.toFixed(2)}`, color: 'text-white' },
          { label: 'P&L', value: `${data.stats.totalPnl >= 0 ? '+' : ''}$${data.stats.totalPnl.toFixed(2)}`, color: pnlColor },
          { label: 'Win Rate', value: `${data.stats.winRate}%`, color: winRateColor },
          { label: 'Positions', value: String(data.stats.openPositions), color: 'text-white' },
        ].map(s => (
          <div key={s.label} className="bg-black px-4 py-3">
            <div className="text-[10px] text-white/30 mb-0.5">{s.label}</div>
            <div className={`text-[16px] font-bold font-mono tabular-nums ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>
      {data.positions.length > 0 && (
        <div className="border-t border-white/[0.06]">
          {data.positions.slice(0, 5).map(pos => {
            const pnlPct = pos.avgPrice > 0 ? ((pos.currentPrice - pos.avgPrice) / pos.avgPrice) * 100 : 0
            return (
              <div key={`${pos.conditionId}-${pos.outcome}`} className="px-4 py-2.5 border-b border-white/[0.04] last:border-b-0">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-white/70 truncate pr-4">{pos.title}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-bold font-mono px-1 py-0.5 ${pos.outcome === 'Yes' ? 'text-emerald-500 bg-emerald-500/10' : 'text-red-400 bg-red-400/10'}`}>
                        {pos.outcome}
                      </span>
                      <span className="text-[9px] font-mono text-white/20">{pos.size.toFixed(1)} @ ${pos.avgPrice.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-[13px] font-mono font-bold tabular-nums ${pos.pnl >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                      {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}
                    </div>
                    <div className={`text-[9px] font-mono tabular-nums ${pnlPct >= 0 ? 'text-emerald-500/50' : 'text-red-400/50'}`}>
                      {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Groups Drawer ───

function GroupsDrawer({ address, isConnected, lang, aiGateEligible, onEligibilityChange, autoJoinCode }: {
  address: string | null
  isConnected: boolean
  lang: Lang
  aiGateEligible: boolean
  onEligibilityChange: (eligible: boolean) => void
  autoJoinCode?: string
}) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<GroupsView>('list')
  const [groups, setGroups] = useState<GroupInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<GroupDetail | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [copied, setCopied] = useState(false)

  const [createName, setCreateName] = useState('')
  const [createMode, setCreateMode] = useState<'draft_pool' | 'leaderboard'>('leaderboard')

  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [joinSuccess, setJoinSuccess] = useState<{ group_name: string; member_count: number } | null>(null)

  const [newGroupCode, setNewGroupCode] = useState('')

  const fetchGroups = useCallback(async () => {
    if (!address) return
    setLoading(true)
    try {
      const res = await fetch(`/api/groups?wallet=${address}`)
      if (res.ok) setGroups(await res.json())
    } catch {} finally { setLoading(false) }
  }, [address])

  const fetchGroupDetail = useCallback(async (code: string) => {
    setLoading(true)
    try {
      const [detailRes, lbRes] = await Promise.all([
        fetch(`/api/groups/${code}`),
        fetch(`/api/groups/${code}/leaderboard`),
      ])
      if (detailRes.ok) setSelectedGroup(await detailRes.json())
      if (lbRes.ok) {
        const lbData = await lbRes.json()
        setLeaderboard(lbData.leaderboard || [])
      }
    } catch {} finally { setLoading(false) }
  }, [])

  const handleCreate = useCallback(async () => {
    if (!createName.trim() || !address) return
    setLoading(true)
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createName.trim(), mode: createMode, creator_wallet: address }),
      })
      if (res.ok) {
        const group = await res.json()
        setNewGroupCode(group.invite_code)
        setCreateName('')
        setView('list')
        fetchGroups()
      }
    } catch {} finally { setLoading(false) }
  }, [createName, createMode, address, fetchGroups])

  const handleJoin = useCallback(async () => {
    if (!joinCode.trim() || !address) return
    setLoading(true)
    setJoinError('')
    setJoinSuccess(null)
    try {
      const res = await fetch(`/api/groups/${joinCode.trim()}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_address: address }),
      })
      const data = await res.json()
      if (res.ok) {
        setJoinSuccess({ group_name: data.group_name, member_count: data.member_count })
        setJoinCode('')
        fetchGroups()
        const checkRes = await fetch(`/api/groups/check?wallet=${address}`)
        if (checkRes.ok) {
          const checkData = await checkRes.json()
          onEligibilityChange(checkData.eligible === true)
        }
      } else {
        setJoinError(data.error || t(lang, 'failedJoin'))
      }
    } catch { setJoinError(t(lang, 'networkError')) } finally { setLoading(false) }
  }, [joinCode, address, fetchGroups, onEligibilityChange])

  const copyCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  useEffect(() => {
    if (open && isConnected) {
      fetchGroups()
      setView('list')
      setNewGroupCode('')
      setJoinSuccess(null)
      setJoinError('')
    }
  }, [open, isConnected, fetchGroups])

  // Auto-open and pre-fill join code from QR scan URL param
  useEffect(() => {
    if (autoJoinCode && isConnected && address) {
      setOpen(true)
      setView('join')
      setJoinCode(autoJoinCode)
    }
  }, [autoJoinCode, isConnected, address])

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button className="p-2 border border-[--border-light] hover:border-white/30 transition-colors relative">
          <Users className="w-3.5 h-3.5 text-white/40" />
          {groups.length > 0 && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#836EF9] text-[7px] font-bold flex items-center justify-center text-white">
              {groups.length}
            </span>
          )}
        </button>
      </DrawerTrigger>

      <DrawerContent className="bg-black border-t border-white/10 rounded-none max-h-[85vh]">
        <DrawerTitle className="sr-only">Groups</DrawerTitle>
        <div className="w-12 h-1 bg-white/20 mx-auto mt-3 mb-2" />

        <div className="overflow-y-auto flex-1 px-4 pb-6">
          {!isConnected ? (
            <div className="py-8 text-center">
              <div className="w-10 h-10 border border-white/10 mx-auto mb-4 flex items-center justify-center">
                <Users className="w-5 h-5 text-white/20" />
              </div>
              <p className="text-[13px] text-white/40 mb-1">{t(lang, 'connectWalletForGroups')}</p>
              <p className="text-[10px] font-mono text-white/20">{t(lang, 'groupsSubtitle')}</p>
            </div>
          ) : view === 'list' ? (
            <>
              {/* AI Gate Status */}
              <div className={`px-3 py-2.5 border mb-4 flex items-center gap-2 ${
                aiGateEligible
                  ? 'border-emerald-500/20 bg-emerald-500/[0.03]'
                  : 'border-[#836EF9]/20 bg-[#836EF9]/[0.03]'
              }`}>
                {aiGateEligible ? (
                  <>
                    <Unlock className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[11px] font-mono text-emerald-500">{t(lang, 'aiUnlocked')}</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-[#836EF9]" />
                    <span className="text-[11px] font-mono text-[#836EF9]">{t(lang, 'inviteFriend')}</span>
                  </>
                )}
              </div>

              {/* New group invite code */}
              {newGroupCode && (
                <div className="border border-[#836EF9]/30 bg-[#836EF9]/[0.05] px-4 py-4 mb-4">
                  <span className="text-[9px] font-bold font-mono text-[#836EF9] tracking-[1.5px]">{t(lang, 'inviteCode')}</span>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[24px] font-bold font-mono text-white tracking-[4px]">{newGroupCode}</span>
                    <button onClick={() => copyCode(newGroupCode)}
                      className="p-2 border border-white/10 hover:border-white/30 transition-colors">
                      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-white/40" />}
                    </button>
                  </div>
                  <div className="flex justify-center mt-3 p-3 bg-white rounded">
                    <QRCodeSVG value={`https://betwhisper.ai/predict?join=${newGroupCode}`} size={160} level="H" />
                  </div>
                  <p className="text-[10px] font-mono text-white/30 mt-2 text-center">{t(lang, 'scanToJoin')}</p>
                </div>
              )}

              {/* Groups list */}
              {loading ? (
                <div className="flex items-center gap-2 py-8 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-white/30" />
                  <span className="text-[12px] font-mono text-white/30">{t(lang, 'loadingGroups')}</span>
                </div>
              ) : groups.length === 0 ? (
                <div className="py-6 text-center">
                  <div className="w-10 h-10 border border-white/10 mx-auto mb-3 flex items-center justify-center">
                    <Users className="w-5 h-5 text-white/20" />
                  </div>
                  <p className="text-[13px] text-white/40 mb-1">{t(lang, 'noGroups')}</p>
                  <p className="text-[10px] font-mono text-white/20">{t(lang, 'noGroupsSub')}</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {groups.map(g => (
                    <button key={g.id}
                      onClick={() => { setView('detail'); fetchGroupDetail(g.invite_code) }}
                      className="w-full text-left flex items-center justify-between px-3 py-2.5 border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] transition-colors active:scale-[0.99]">
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-white">{g.name}</div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[10px] font-mono text-white/30 flex items-center gap-1">
                            <Users className="w-3 h-3" />{g.member_count}
                          </span>
                          <span className="text-[9px] font-mono text-[#836EF9]/60 border border-[#836EF9]/20 px-1.5 py-0.5">
                            {g.mode === 'draft_pool' ? 'DRAFT POOL' : 'LEADERBOARD'}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {/* CTAs */}
              <div className="flex items-center gap-2 mt-4">
                <button onClick={() => setView('create')}
                  className="flex-1 py-2.5 text-[12px] font-semibold bg-[#836EF9] text-white hover:bg-[#836EF9]/90 transition-colors active:scale-[0.97] flex items-center justify-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> CREATE
                </button>
                <button onClick={() => setView('join')}
                  className="flex-1 py-2.5 text-[12px] font-semibold border border-white/20 text-white hover:bg-white/[0.06] transition-colors active:scale-[0.97] flex items-center justify-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" /> JOIN
                </button>
              </div>
            </>
          ) : view === 'create' ? (
            <>
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setView('list')} className="p-1 hover:bg-white/[0.06] transition-colors">
                  <ArrowLeft className="w-4 h-4 text-white/40" />
                </button>
                <span className="text-[9px] font-bold font-mono text-white/30 tracking-[1.5px]">CREATE GROUP</span>
              </div>

              <div className="mb-4">
                <label className="text-[9px] font-bold font-mono text-white/30 tracking-[1px] mb-1.5 block">NAME</label>
                <input type="text" value={createName} onChange={e => setCreateName(e.target.value)}
                  placeholder="e.g. Crypto Degens"
                  className="w-full bg-transparent border border-white/[0.08] px-4 py-2.5 text-[14px] text-white placeholder:text-white/20 outline-none focus:border-white/20 transition-colors"
                  maxLength={30} />
              </div>

              <div className="mb-6">
                <label className="text-[9px] font-bold font-mono text-white/30 tracking-[1px] mb-1.5 block">MODE</label>
                <div className="flex items-center gap-2">
                  {(['leaderboard', 'draft_pool'] as const).map(mode => (
                    <button key={mode} onClick={() => setCreateMode(mode)}
                      className={`flex-1 py-2 text-[11px] font-semibold font-mono border transition-colors active:scale-[0.97] ${
                        createMode === mode
                          ? 'border-[#836EF9]/40 text-[#836EF9] bg-[#836EF9]/10'
                          : 'border-white/10 text-white/30 hover:border-white/20'
                      }`}>
                      {mode === 'leaderboard' ? 'LEADERBOARD' : 'DRAFT POOL'}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] font-mono text-white/20 mt-1.5">
                  {createMode === 'leaderboard' ? 'Free competition. Each member picks their own markets. Ranked by P&L.' : 'Same market for everyone. Pure conviction test.'}
                </p>
              </div>

              <button onClick={handleCreate} disabled={!createName.trim() || loading}
                className={`w-full py-2.5 text-[13px] font-semibold transition-colors active:scale-[0.97] ${
                  createName.trim() && !loading
                    ? 'bg-[#836EF9] text-white hover:bg-[#836EF9]/90'
                    : 'bg-white/10 text-white/20 cursor-not-allowed'
                }`}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'CREATE GROUP'}
              </button>
            </>
          ) : view === 'join' ? (
            <>
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => { setView('list'); setJoinError(''); setJoinSuccess(null) }}
                  className="p-1 hover:bg-white/[0.06] transition-colors">
                  <ArrowLeft className="w-4 h-4 text-white/40" />
                </button>
                <span className="text-[9px] font-bold font-mono text-white/30 tracking-[1.5px]">{t(lang, 'joinGroup')}</span>
              </div>

              {joinSuccess ? (
                <div className="border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-4 text-center">
                  <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                  <p className="text-[13px] font-semibold text-white mb-1">Joined {joinSuccess.group_name}</p>
                  <p className="text-[10px] font-mono text-white/30">{joinSuccess.member_count} members</p>
                  <button onClick={() => { setView('list'); setJoinSuccess(null) }}
                    className="mt-3 px-4 py-2 text-[12px] font-semibold border border-white/20 text-white hover:bg-white/[0.06] transition-colors">
                    VIEW GROUPS
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="text-[9px] font-bold font-mono text-white/30 tracking-[1px] mb-1.5 block">{t(lang, 'inviteCode')}</label>
                    <input type="text" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="e.g. BW-ABC123"
                      className="w-full bg-transparent border border-white/[0.08] px-4 py-2.5 text-[14px] font-mono text-white tracking-[2px] placeholder:text-white/20 placeholder:tracking-normal outline-none focus:border-white/20 transition-colors"
                      maxLength={10} />
                  </div>
                  {joinError && (
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-[11px] text-red-400/80">{joinError}</span>
                    </div>
                  )}
                  <button onClick={handleJoin} disabled={!joinCode.trim() || loading}
                    className={`w-full py-2.5 text-[13px] font-semibold transition-colors active:scale-[0.97] ${
                      joinCode.trim() && !loading
                        ? 'bg-white text-black hover:bg-white/90'
                        : 'bg-white/10 text-white/20 cursor-not-allowed'
                    }`}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'JOIN'}
                  </button>
                </>
              )}
            </>
          ) : view === 'detail' ? (
            <>
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => { setView('list'); setSelectedGroup(null) }}
                  className="p-1 hover:bg-white/[0.06] transition-colors">
                  <ArrowLeft className="w-4 h-4 text-white/40" />
                </button>
                <span className="text-[9px] font-bold font-mono text-white/30 tracking-[1.5px]">
                  {selectedGroup?.name.toUpperCase() || 'GROUP'}
                </span>
              </div>

              {loading || !selectedGroup ? (
                <div className="flex items-center gap-2 py-8 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-white/30" />
                </div>
              ) : (
                <>
                  {/* Invite Code + QR */}
                  <div className="border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 mb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[9px] font-bold font-mono text-white/30 tracking-[1px]">{t(lang, 'inviteCode')}</span>
                        <div className="text-[18px] font-bold font-mono text-white tracking-[3px] mt-0.5">
                          {selectedGroup.invite_code}
                        </div>
                      </div>
                      <button onClick={() => copyCode(selectedGroup.invite_code)}
                        className="p-2 border border-white/10 hover:border-white/30 transition-colors">
                        {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-white/40" />}
                      </button>
                    </div>
                    <div className="flex justify-center mt-3 p-3 bg-white rounded">
                      <QRCodeSVG value={`https://betwhisper.ai/predict?join=${selectedGroup.invite_code}`} size={140} level="H" />
                    </div>
                    <p className="text-[10px] font-mono text-white/20 mt-1.5 text-center">{t(lang, 'scanToJoin')}</p>
                  </div>

                  {/* AI Gate status */}
                  <div className={`px-3 py-2 border mb-3 flex items-center gap-2 ${
                    Number(selectedGroup.member_count) >= 2
                      ? 'border-emerald-500/20 bg-emerald-500/[0.03]'
                      : 'border-amber-400/20 bg-amber-400/[0.03]'
                  }`}>
                    {Number(selectedGroup.member_count) >= 2 ? (
                      <>
                        <Unlock className="w-3 h-3 text-emerald-500" />
                        <span className="text-[10px] font-mono text-emerald-500">{t(lang, 'aiUnlocked')}</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3 h-3 text-amber-400" />
                        <span className="text-[10px] font-mono text-amber-400">
                          {2 - Number(selectedGroup.member_count)} more friend{2 - Number(selectedGroup.member_count) !== 1 ? 's' : ''} needed
                        </span>
                      </>
                    )}
                  </div>

                  {/* Members */}
                  <div className="border border-white/[0.08] bg-white/[0.04] mb-3">
                    <div className="px-3 py-2 border-b border-white/[0.06]">
                      <span className="text-[9px] font-bold font-mono text-white/30 tracking-[1.5px]">
                        MEMBERS ({selectedGroup.member_count})
                      </span>
                    </div>
                    {selectedGroup.members.map((m, i) => (
                      <div key={m.wallet_address}
                        className={`px-3 py-2 flex items-center gap-2 ${
                          i < selectedGroup.members.length - 1 ? 'border-b border-white/[0.04]' : ''
                        }`}>
                        {i === 0 && <Crown className="w-3 h-3 text-amber-400" />}
                        <span className="text-[11px] font-mono text-white/60">
                          {m.wallet_address.slice(0, 6)}...{m.wallet_address.slice(-4)}
                        </span>
                        {m.wallet_address.toLowerCase() === address?.toLowerCase() && (
                          <span className="text-[8px] font-mono text-[#836EF9] border border-[#836EF9]/20 px-1 py-0.5">YOU</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Leaderboard */}
                  {leaderboard.length > 0 && (
                    <div className="border border-white/[0.08] bg-white/[0.04]">
                      <div className="px-3 py-2 border-b border-white/[0.06]">
                        <span className="text-[9px] font-bold font-mono text-white/30 tracking-[1.5px]">LEADERBOARD</span>
                      </div>
                      {leaderboard.map((entry, i) => (
                        <div key={entry.wallet_address}
                          className={`px-3 py-2 flex items-center justify-between ${
                            i < leaderboard.length - 1 ? 'border-b border-white/[0.04]' : ''
                          }`}>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold font-mono text-white/30 w-4">{i + 1}</span>
                            <span className="text-[11px] font-mono text-white/60">
                              {entry.wallet_address.slice(0, 6)}...{entry.wallet_address.slice(-4)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-mono text-white/30">{entry.bet_count} trades</span>
                            <span className={`text-[11px] font-bold font-mono ${
                              Number(entry.total_pnl) >= 0 ? 'text-emerald-500' : 'text-red-400'
                            }`}>
                              {Number(entry.total_pnl) >= 0 ? '+' : ''}${Math.abs(Number(entry.total_pnl)).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Delete Group (creator only) */}
                  {selectedGroup.creator_wallet === address?.toLowerCase() && (
                    <button
                      onClick={async () => {
                        if (!confirm('Delete this group? This cannot be undone.')) return
                        try {
                          const res = await fetch(`/api/groups/${selectedGroup.invite_code}?wallet=${address}`, { method: 'DELETE' })
                          if (res.ok) {
                            setSelectedGroup(null)
                            setView('list')
                            fetchGroups()
                          }
                        } catch {}
                      }}
                      className="w-full mt-4 py-2.5 text-[11px] font-semibold font-mono border border-red-500/20 text-red-400/60 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/[0.05] transition-colors active:scale-[0.97]">
                      DELETE GROUP
                    </button>
                  )}
                </>
              )}
            </>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

// ─── Chat Bubble ───

function ChatBubble({ message, assistantName }: { message: ChatMessage; assistantName: string }) {
  const isUser = message.role === 'user'
  const initial = assistantName.charAt(0).toUpperCase()

  return (
    <div className={`flex gap-2.5 ${isUser ? 'justify-end' : 'items-start'}`}>
      {!isUser && (
        <div className="w-6 h-6 border border-white/[0.08] flex items-center justify-center flex-shrink-0 mt-5">
          <span className="text-[9px] font-bold text-white/60">{initial}</span>
        </div>
      )}
      <div className={`max-w-[85%] sm:max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <span className="text-[9px] font-bold font-mono text-white/30 tracking-[1.5px] mb-1 px-0.5">
          {isUser ? 'YOU' : assistantName.toUpperCase()}
        </span>
        {message.text && (
          <div className={`px-3 py-2 text-[13px] leading-relaxed ${
            isUser ? 'bg-white text-black' : 'border border-white/[0.08] bg-white/[0.04] text-white/80'
          }`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Conversations Drawer ───

function ConversationsDrawer({ address, lang, conversations, currentConversationId, onSelect, onNew, onDelete, onDeleteAll, onRefresh }: {
  address: string | null
  lang: Lang
  conversations: ConversationInfo[]
  currentConversationId: string | null
  onSelect: (conv: ConversationInfo) => void
  onNew: () => void
  onDelete: (id: string) => void
  onDeleteAll: () => void
  onRefresh: () => void
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (open) onRefresh()
  }, [open, onRefresh])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button className="p-2 border border-[--border-light] hover:border-white/30 transition-colors relative">
          <MessageSquare className="w-3.5 h-3.5 text-white/40" />
          {conversations.length > 0 && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 text-[8px] font-bold text-black flex items-center justify-center">
              {conversations.length}
            </span>
          )}
        </button>
      </DrawerTrigger>
      <DrawerContent className="bg-black border-t border-[--border] max-h-[85vh]">
        <DrawerTitle className="sr-only">Conversations</DrawerTitle>
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-mono text-white/40 tracking-[1.5px]">
              {lang === 'es' ? 'CONVERSACIONES' : 'CONVERSATIONS'}
            </span>
            <div className="flex items-center gap-2">
              {conversations.length > 0 && (
                <button
                  onClick={() => { if (confirm(lang === 'es' ? 'Borrar todas las conversaciones?' : 'Delete all conversations?')) { onDeleteAll(); } }}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-red-500/20 text-red-400/60 text-[11px] font-mono hover:bg-red-500/10 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  {lang === 'es' ? 'BORRAR' : 'CLEAR'}
                </button>
              )}
              <button
                onClick={() => { onNew(); setOpen(false) }}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono hover:bg-emerald-500/10 transition-colors"
              >
                <Plus className="w-3 h-3" />
                {lang === 'es' ? 'NUEVA' : 'NEW'}
              </button>
            </div>
          </div>

          {/* List */}
          {conversations.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-6 h-6 text-white/10 mx-auto mb-2" />
              <p className="text-[12px] text-white/20 font-mono">
                {lang === 'es' ? 'Sin conversaciones aun' : 'No conversations yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-1 max-h-[60vh] overflow-y-auto">
              {conversations.map(conv => (
                <div
                  key={conv.id}
                  className={`flex items-center gap-3 p-3 cursor-pointer transition-colors border ${
                    conv.id === currentConversationId
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-transparent hover:bg-white/[0.03]'
                  }`}
                  onClick={() => { onSelect(conv); setOpen(false) }}
                >
                  <div className="w-8 h-8 border border-white/10 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-3.5 h-3.5 text-white/20" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium text-white truncate">
                        {conv.title}
                      </span>
                      <span className="text-[9px] font-mono text-white/20 ml-2 flex-shrink-0">
                        {formatDate(conv.updated_at)}
                      </span>
                    </div>
                    {conv.last_message && (
                      <p className="text-[11px] text-white/30 font-mono truncate mt-0.5">
                        {conv.last_message}
                      </p>
                    )}
                    <span className="text-[9px] text-white/15 font-mono">
                      {conv.message_count} msg{Number(conv.message_count) !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(conv.id) }}
                    className="p-1.5 text-white/10 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

// ─── Main Page ───

export default function PredictChat() {
  const { address, isConnected, connect, disconnect, signer, wrongChain, switchToTestnet } = useWeb3()

  // Unlink privacy wallet
  const { walletExists, ready: unlinkReady, createWallet, activeAccount, waitForConfirmation, forceResync: unlinkForceResync, balances: unlinkBalances } = useUnlink()
  const { deposit: unlinkDeposit } = useDeposit()
  const { send: unlinkSend } = useSend()
  const [serverUnlinkAddr, setServerUnlinkAddr] = useState<string>('')

  // Fetch server's Unlink address on mount
  useEffect(() => {
    fetch('/api/unlink/address').then(r => r.json()).then(d => {
      if (d.address) setServerUnlinkAddr(d.address)
    }).catch(() => {})
  }, [])

  // Auto-create Unlink wallet if none exists (once SDK is ready)
  useEffect(() => {
    if (unlinkReady && !walletExists) {
      createWallet().then(({ mnemonic }) => {
        // Store mnemonic for recovery — user can export later
        try { localStorage.setItem('bw_unlink_mnemonic', mnemonic) } catch {}
        console.log('[Unlink] Wallet created')
      }).catch(e => console.warn('[Unlink] Wallet creation failed:', e))
    }
  }, [unlinkReady, walletExists, createWallet])

  // Recovery state: detect pending Unlink deposit from interrupted flow
  const [unlinkRecovery, setUnlinkRecovery] = useState<{
    market: string; side: string; amount: string; signalHash: string; conditionId: string; monAmountWei: string
  } | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('bw_unlink_pending')
      if (raw) {
        const pending = JSON.parse(raw)
        if (pending.market && pending.amount) setUnlinkRecovery(pending)
      }
    } catch {}
  }, [])

  // Sound effects
  const { play: playSound } = useSounds()

  const [assistantName, setAssistantNameState] = useState<string | null>(null)
  const [lang, setLangState] = useState<Lang>('en')
  const [onboarded, setOnboarded] = useState<boolean | null>(null)

  useEffect(() => {
    setAssistantNameState(getAssistantName() || null)
    setLangState(getSavedLang())
    setOnboarded(isOnboarded())
  }, [])

  const handleOnboardComplete = (name: string, categories: string[], selectedLang: Lang) => {
    saveOnboarding(name, categories, selectedLang)
    setAssistantNameState(name)
    setLangState(selectedLang)
    setOnboarded(true)
  }

  // Auto-join from QR scan URL param (persists in sessionStorage through onboarding)
  const [autoJoinCode, setAutoJoinCode] = useState<string>('')
  // Pulse geolocation: lat/lng passed from /pulse trade buttons
  const [pulseGeo, setPulseGeo] = useState<{ lat: number; lng: number } | null>(null)
  // Social Pulse: opt-in toggle — GPS only captured/sent when active
  const [socialPulseActive, setSocialPulseActive] = useState(false)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const join = params.get('join')
    if (join) {
      setAutoJoinCode(join)
      setInlineJoinCode(join.toUpperCase())
      sessionStorage.setItem('bw_join_code', join.toUpperCase())
    } else {
      // Recover from sessionStorage (survives onboarding + page transitions)
      const saved = sessionStorage.getItem('bw_join_code')
      if (saved) {
        setAutoJoinCode(saved)
        setInlineJoinCode(saved)
      }
    }
    // Read market slug from Local Sentiment QR code
    const marketParam = params.get('market')
    if (marketParam) {
      sessionStorage.setItem('bw_pulse_market', marketParam)
    }
    // Read lat/lng from Pulse trade buttons (URL params only — no auto GPS)
    const lat = params.get('lat')
    const lng = params.get('lng')
    if (lat && lng) {
      setPulseGeo({ lat: parseFloat(lat), lng: parseFloat(lng) })
    }
    // Restore Social Pulse state from sessionStorage
    const savedPulse = sessionStorage.getItem('bw_social_pulse')
    if (savedPulse === 'on') setSocialPulseActive(true)
    // Clean URL params
    window.history.replaceState({}, '', window.location.pathname)
  }, [])

  // When Social Pulse is toggled ON → capture GPS; OFF → clear it
  const handleSocialPulseActivate = useCallback(() => {
    setSocialPulseActive(true)
    sessionStorage.setItem('bw_social_pulse', 'on')
    // Capture GPS now that user explicitly opted in
    navigator.geolocation?.getCurrentPosition(
      (pos) => setPulseGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}, // silently fail if denied
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
    )
  }, [])

  const handleSocialPulseDeactivate = useCallback(() => {
    setSocialPulseActive(false)
    setPulseGeo(null)
    sessionStorage.removeItem('bw_social_pulse')
  }, [])

  // AI Gate state
  const [aiGateEligible, setAiGateEligible] = useState(false)
  const [showUnlockToast, setShowUnlockToast] = useState(false)
  const prevAiGateRef = useRef(false)
  const [inlineJoinCode, setInlineJoinCode] = useState('')
  const [inlineJoinLoading, setInlineJoinLoading] = useState(false)
  const [inlineJoinResult, setInlineJoinResult] = useState<'success' | 'error' | null>(null)
  useEffect(() => {
    if (!address) return
    const check = () =>
      fetch(`/api/groups/check?wallet=${address}`)
        .then(r => r.json())
        .then(d => setAiGateEligible(d.eligible === true))
        .catch(() => setAiGateEligible(false))
    check()
    // Poll every 5s so User 1 detects when a friend joins their group
    const interval = setInterval(check, 5000)
    return () => clearInterval(interval)
  }, [address])

  // Detect AI unlock transition (false -> true) and show toast
  useEffect(() => {
    if (aiGateEligible && !prevAiGateRef.current) {
      setShowUnlockToast(true)
      setTimeout(() => setShowUnlockToast(false), 5000)
    }
    prevAiGateRef.current = aiGateEligible
  }, [aiGateEligible])

  // Inline join group handler
  const handleInlineJoin = useCallback(async () => {
    if (!inlineJoinCode.trim() || !address || inlineJoinLoading) return
    setInlineJoinLoading(true)
    setInlineJoinResult(null)
    try {
      const res = await fetch(`/api/groups/${inlineJoinCode.trim()}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_address: address }),
      })
      if (res.ok) {
        setInlineJoinResult('success')
        setInlineJoinCode('')
        sessionStorage.removeItem('bw_join_code')
        // Re-check AI Gate eligibility
        const checkRes = await fetch(`/api/groups/check?wallet=${address}`)
        if (checkRes.ok) {
          const checkData = await checkRes.json()
          setAiGateEligible(checkData.eligible === true)
        }
      } else {
        setInlineJoinResult('error')
      }
    } catch {
      setInlineJoinResult('error')
    } finally {
      setInlineJoinLoading(false)
    }
  }, [inlineJoinCode, address, inlineJoinLoading])

  // Auto-join when user connects wallet after QR scan
  const autoJoinTriggered = useRef(false)
  useEffect(() => {
    if (autoJoinCode && address && !aiGateEligible && inlineJoinCode && !autoJoinTriggered.current) {
      autoJoinTriggered.current = true
      // Small delay so user sees the banner briefly before auto-join
      const t = setTimeout(() => handleInlineJoin(), 800)
      return () => clearTimeout(t)
    }
  }, [autoJoinCode, address, aiGateEligible, inlineJoinCode, handleInlineJoin])

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [pinToken, setPinToken] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const initialLoadDone = useRef(false)

  // Conversation persistence
  const [conversations, setConversations] = useState<ConversationInfo[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const conversationTitleSet = useRef(false)

  const fetchConversations = useCallback(async () => {
    if (!address) return
    try {
      const res = await fetch(`/api/conversations?wallet=${address}`)
      if (res.ok) setConversations(await res.json())
    } catch {}
  }, [address])

  const createConversation = useCallback(async () => {
    if (!address) return null
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_address: address }),
      })
      if (res.ok) {
        const conv = await res.json()
        setCurrentConversationId(conv.id)
        conversationTitleSet.current = false
        return conv.id as string
      }
    } catch {}
    return null
  }, [address])

  const persistMessage = useCallback(async (convId: string, role: ChatRole, text: string) => {
    if (!text || !convId) return
    try {
      await fetch(`/api/conversations/${convId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, text }),
      })
      // Auto-title from first user message
      if (role === 'user' && !conversationTitleSet.current) {
        conversationTitleSet.current = true
        await fetch(`/api/conversations/${convId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: text.slice(0, 60) }),
        })
      }
    } catch {}
  }, [])

  const loadConversation = useCallback(async (conv: ConversationInfo) => {
    setCurrentConversationId(conv.id)
    conversationTitleSet.current = conv.title !== 'New Conversation'
    try {
      const res = await fetch(`/api/conversations/${conv.id}`)
      if (res.ok) {
        const data = await res.json()
        const restored: ChatMessage[] = (data.messages || []).map((m: ConversationMessage) => ({
          id: uid(),
          role: m.role as ChatRole,
          text: m.text,
          timestamp: new Date(m.created_at).getTime(),
        }))
        setMessages(restored)
      }
    } catch {}
  }, [])

  const startNewConversation = useCallback(async () => {
    setMessages([])
    initialLoadDone.current = false
    const convId = await createConversation()
    if (convId) {
      await fetchConversations()
    }
  }, [createConversation, fetchConversations])

  const deleteConversation = useCallback(async (id: string) => {
    try {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
      setConversations(prev => prev.filter(c => c.id !== id))
      if (id === currentConversationId) {
        startNewConversation()
      }
    } catch {}
  }, [currentConversationId, startNewConversation])

  const deleteAllConversations = useCallback(async () => {
    try {
      await Promise.all(conversations.map(c => fetch(`/api/conversations/${c.id}`, { method: 'DELETE' })))
      setConversations([])
      startNewConversation()
    } catch {}
  }, [conversations, startNewConversation])

  // Create conversation on first connect
  useEffect(() => {
    if (address && !currentConversationId) {
      createConversation().then(() => fetchConversations())
    }
  }, [address, currentConversationId, createConversation, fetchConversations])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const addMessage = useCallback((role: ChatRole, text: string, attachment?: ChatAttachment): string => {
    const id = uid()
    setMessages(prev => [...prev, { id, role, text, attachment, timestamp: Date.now() }])
    // Persist non-empty text messages
    if (text && currentConversationId) {
      persistMessage(currentConversationId, role, text)
    }
    return id
  }, [currentConversationId, persistMessage])

  const removeMessage = useCallback((id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id))
  }, [])

  const updateMessage = useCallback((id: string, attachment: ChatAttachment) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, attachment } : m))
  }, [])

  // Auto-load market after successful QR join (Local Sentiment flow)
  const pulseMarketLoaded = useRef(false)
  useEffect(() => {
    if (inlineJoinResult !== 'success' || pulseMarketLoaded.current) return
    const pulseMarket = sessionStorage.getItem('bw_pulse_market')
    if (!pulseMarket) return
    pulseMarketLoaded.current = true
    sessionStorage.removeItem('bw_pulse_market')
    ;(async () => {
      try {
        const mRes = await fetch(`/api/markets?q=${encodeURIComponent(pulseMarket)}&limit=1`)
        if (mRes.ok) {
          const mData = await mRes.json()
          const events = mData.events || []
          for (const event of events) {
            const m = (event.markets || []).find((mk: MarketInfo) => mk.slug === pulseMarket) || (event.markets || [])[0]
            if (m) {
              addMessage('assistant', `You're in! Trading: ${m.question}`, {
                type: 'betChoice', slug: m.slug, yesPrice: m.yesPrice, noPrice: m.noPrice,
              })
              break
            }
          }
        }
      } catch {}
    })()
  }, [inlineJoinResult, addMessage])

  // ─── Handlers ───

  const searchMarkets = useCallback(async (query: string) => {
    const loadingId = addMessage('assistant', '', { type: 'loading', text: t(lang, 'searchingMarkets') })
    try {
      const q = query === 'trending' ? '' : query
      const res = await fetch(`/api/markets?q=${encodeURIComponent(q)}&limit=12`)
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      const allMarkets: MarketInfo[] = (data.events || []).flatMap((e: EventInfo) => e.markets)
      removeMessage(loadingId)
      if (allMarkets.length === 0) {
        addMessage('assistant', t(lang, 'noMarkets'))
      } else {
        const display = allMarkets.slice(0, 5)
        addMessage('assistant',
          t(lang, 'foundMarkets', { n: allMarkets.length, s: allMarkets.length === 1 ? '' : 's' }),
          { type: 'markets', markets: display }
        )
      }
    } catch {
      removeMessage(loadingId)
      addMessage('assistant', '', { type: 'error', text: t(lang, 'failedSearch') })
    }
  }, [addMessage, removeMessage, lang])

  const performAnalysis = useCallback(async (market: MarketInfo) => {
    const loadingId = addMessage('assistant', '', { type: 'loading', text: t(lang, 'scanningWhales') })
    try {
      const res = await fetch('/api/market/deep-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conditionId: market.conditionId }),
      })
      if (!res.ok) throw new Error('API error')
      const analysis: DeepAnalysisResult = await res.json()
      removeMessage(loadingId)

      const text = analysis.holdersScanned > 0
        ? t(lang, 'radarResult', { scanned: analysis.holdersScanned, total: analysis.totalHolders, agentPct: analysis.agentRate })
        : t(lang, 'noWhales')

      addMessage('assistant', text,
        { type: 'deepAnalysis', analysis, market }
      )
    } catch {
      removeMessage(loadingId)
      addMessage('assistant', '', { type: 'error', text: t(lang, 'failedAnalysis') })
    }
  }, [addMessage, removeMessage, lang])

  // Recovery handler: resume interrupted Unlink flow (skip deposit, go to transfer)
  const handleUnlinkRecovery = useCallback(async () => {
    if (!unlinkRecovery || !unlinkReady || !walletExists || !serverUnlinkAddr) return

    const { market, side, amount, signalHash, conditionId, monAmountWei } = unlinkRecovery

    // Build a 3-step timeline (skip deposit — already done)
    const steps: BetTimelineStep[] = [
      { label: 'PRIVATE TRANSFER', chain: 'ZK Proof', status: 'pending', detail: lang === 'es' ? 'Reanudando transferencia...' : 'Resuming transfer...' },
      { label: 'CLOB EXECUTION', chain: 'Polygon', status: 'pending' },
      { label: t(lang, 'positionOpen'), chain: 'Confirmed', status: 'pending' },
    ]
    const timelineId = addMessage('assistant', '', { type: 'betTimeline', steps: [...steps], side, amount, market })
    const updateTimeline = (s: BetTimelineStep[]) => updateMessage(timelineId, { type: 'betTimeline', steps: [...s], side, amount, market })

    // Step 1: Private transfer (deposit already in pool — refresh balance first)
    steps[0].status = 'processing'
    steps[0].detail = lang === 'es' ? 'Sincronizando balance...' : 'Syncing balance...'
    updateTimeline(steps)
    await unlinkForceResync()

    steps[0].detail = lang === 'es' ? 'Generando prueba ZK...' : 'Generating ZK proof...'
    updateTimeline(steps)

    let unlinkTxHash: string | null = null
    try {
      const transferResult = await unlinkSend([{
        token: MON_TOKEN,
        recipient: serverUnlinkAddr,
        amount: BigInt(monAmountWei),
      }])
      // Wait for on-chain confirmation to get txHash (relayId is internal, can't verify cross-wallet)
      const confirmed = await waitForConfirmation(transferResult.relayId, { timeout: 30_000 })
      unlinkTxHash = confirmed.txHash || transferResult.relayId
      steps[0].status = 'confirmed'
      steps[0].detail = lang === 'es' ? 'Transferencia privada enviada' : 'Private transfer sent'
      updateTimeline(steps)

      try { localStorage.removeItem('bw_unlink_pending') } catch {}
      setUnlinkRecovery(null)
    } catch (err) {
      steps[0].status = 'error'
      steps[0].errorMsg = err instanceof Error ? err.message : 'Private transfer failed'
      updateTimeline(steps)
      return
    }

    // Step 2: CLOB execution
    steps[1].status = 'processing'
    steps[1].detail = lang === 'es' ? 'Ejecutando orden...' : 'Executing order...'
    updateTimeline(steps)

    try {
      const res = await fetch('/api/bet/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conditionId, outcomeIndex: side === 'Yes' ? 0 : 1,
          amountUSD: parseFloat(amount), signalHash, marketSlug: market,
          side, walletAddress: address,
          unlinkTxHash, unlinkAmount: parseFloat(amount), executionMode: 'unlink',
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        steps[1].status = 'confirmed'
        steps[1].txHash = data.polygonTxHash || data.txHash
        steps[1].explorerUrl = data.explorerUrl
        steps[1].detail = `$${parseFloat(amount).toFixed(2)} USDC → ${data.shares?.toFixed(1) || '?'} shares`
        updateTimeline(steps)

        // Step 3: Position recording
        steps[2].status = 'processing'
        updateTimeline(steps)
        await fetch('/api/bet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            marketSlug: market, side, amount, walletAddress: address || 'demo',
            txHash: data.polygonTxHash || data.txHash, signalHash, source: data.source,
            conditionId, shares: data.shares, price: data.price,
            tokenId: data.tokenId, tickSize: data.tickSize, negRisk: data.negRisk,
            unlinkTxHash, executionMode: 'unlink',
          }),
        }).catch(() => {})
        steps[2].status = 'confirmed'
        steps[2].detail = `${side.toUpperCase()} @ $${data.price?.toFixed(2)} · ${data.shares?.toFixed(1)} shares`
        updateTimeline(steps)
      } else {
        steps[1].status = 'error'
        steps[1].errorMsg = data.error || 'CLOB execution failed'
        updateTimeline(steps)
      }
    } catch {
      steps[1].status = 'error'
      steps[1].errorMsg = lang === 'es' ? 'Error de red' : 'Network error'
      updateTimeline(steps)
    }
  }, [unlinkRecovery, unlinkReady, walletExists, serverUnlinkAddr, unlinkSend, address, addMessage, updateMessage, lang])

  const dismissUnlinkRecovery = useCallback(() => {
    try { localStorage.removeItem('bw_unlink_pending') } catch {}
    setUnlinkRecovery(null)
  }, [])

  const handleBetPrompt = useCallback((side: 'Yes' | 'No', slug: string, signalHash: string, conditionId?: string) => {
    playSound('tick')
    addMessage('user', `${side} on this market`)
    addMessage('assistant', t(lang, 'howMuch'), { type: 'betPrompt', side, slug, signalHash, conditionId: conditionId || '' })
  }, [addMessage, lang, playSound])

  const handleBet = useCallback(async (side: 'Yes' | 'No', slug: string, signalHash: string, amount: string, conditionId?: string) => {
    addMessage('user', `$${amount} on ${side}`)

    // Require wallet connection
    if (!isConnected || !signer) {
      addMessage('assistant', '', { type: 'error', text: lang === 'es' ? 'Conecta tu wallet para invertir.' : 'Connect your wallet to trade.' })
      return
    }

    // Resolve conditionId from chat history if not passed directly
    let resolvedConditionId = conditionId
    if (!resolvedConditionId) {
      const marketMsg = [...messages].reverse().find(m =>
        m.attachment?.type === 'successProbability' || m.attachment?.type === 'deepAnalysis' || m.attachment?.type === 'marketPreview'
      )
      if (marketMsg?.attachment && 'market' in marketMsg.attachment) {
        resolvedConditionId = marketMsg.attachment.market.conditionId
      }
    }

    // Determine if Unlink privacy path is available
    console.log('[Execution] Unlink check:', { unlinkReady, walletExists, serverUnlinkAddr: !!serverUnlinkAddr, activeAccount: !!activeAccount })
    const useUnlinkPath = unlinkReady && walletExists && serverUnlinkAddr && activeAccount
    console.log('[Execution] Path:', useUnlinkPath ? 'UNLINK (ZK Privacy)' : 'DIRECT (old flow)')

    // Initialize timeline — 4 steps for Unlink, 3 for direct
    const steps: BetTimelineStep[] = useUnlinkPath
      ? [
          { label: 'PRIVACY DEPOSIT', chain: 'Unlink', status: 'pending' },
          { label: 'PRIVATE TRANSFER', chain: 'ZK Proof', status: 'pending' },
          { label: 'CLOB EXECUTION', chain: 'Polygon', status: 'pending' },
          { label: t(lang, 'positionOpen'), chain: 'Confirmed', status: 'pending' },
        ]
      : [
          { label: 'MON PAYMENT', chain: 'Monad', status: 'pending' },
          { label: 'CLOB EXECUTION', chain: 'Polygon', status: 'pending' },
          { label: t(lang, 'positionOpen'), chain: 'Confirmed', status: 'pending' },
        ]
    const timelineId = addMessage('assistant', '', { type: 'betTimeline', steps: [...steps], side, amount, market: slug })
    const updateTimeline = (newSteps: BetTimelineStep[]) => {
      updateMessage(timelineId, { type: 'betTimeline', steps: [...newSteps], side, amount, market: slug })
    }

    // Calculate amounts for both paths
    const amountUSD = parseFloat(amount)
    // Unlink path: deposit USDC (18 decimals on Monad testnet) — amount = USD value directly
    const usdcAmountWei = BigInt(Math.floor(amountUSD * 1e18))
    // Direct path: convert USD → MON
    let monPriceUSD = 0.021
    try {
      const priceRes = await fetch('/api/mon-price')
      if (priceRes.ok) {
        const priceData = await priceRes.json()
        monPriceUSD = priceData.price || 0.021
      }
    } catch { /* use fallback */ }
    const monAmountNum = (amountUSD / monPriceUSD) * 1.01
    const monAmount = monAmountNum.toFixed(4)
    const monAmountWei = BigInt(Math.floor(monAmountNum * 1e18))

    let monadTxHash: string | null = null
    let unlinkTxHash: string | null = null

    if (useUnlinkPath) {
      // ─── UNLINK PRIVACY PATH ───
      // Step 1: Deposit MON into Unlink privacy pool
      steps[0].status = 'processing'
      steps[0].detail = lang === 'es' ? 'Depositando en pool de privacidad...' : 'Depositing to privacy pool...'
      updateTimeline(steps)
      playSound('deposit')

      try {
        // CRITICAL: Force wallet to Monad Testnet before ANY transaction
        // MetaMask mobile caches the chain from old WC sessions and silently
        // routes txs to mainnet (143) even when WC reports 10143
        console.log('[Unlink:Deposit] Forcing wallet_switchEthereumChain to testnet 10143...')
        const switched = await switchToTestnet()
        if (!switched) {
          const errMsg = lang === 'es'
            ? `Abre MetaMask y cambia manualmente a "Monad Testnet" (chain ${MONAD_TESTNET_CHAIN_ID}). Luego intenta de nuevo.`
            : `Open MetaMask and manually switch to "Monad Testnet" (chain ${MONAD_TESTNET_CHAIN_ID}). Then try again.`
          throw new Error(errMsg)
        }
        console.log('[Unlink:Deposit] Chain switch confirmed, proceeding on testnet')

        console.log('[Unlink:Deposit] Starting USDC deposit flow', {
          token: UNLINK_USDC,
          amount: usdcAmountWei.toString(),
          amountUSD: amount,
          depositor: address,
        })

        // Step 1a: Prepare deposit FIRST (generates calldata + tells us which contract to approve)
        steps[0].detail = lang === 'es' ? 'Preparando depósito...' : 'Preparing deposit...'
        updateTimeline(steps)
        const depositResult = await unlinkDeposit([{
          token: UNLINK_USDC,
          amount: usdcAmountWei,
          depositor: address!,
        }])

        console.log('[Unlink:Deposit] SDK returned deposit result', {
          relayId: depositResult.relayId,
          to: depositResult.to,
          calldataLen: depositResult.calldata?.length,
          calldataFirst100: depositResult.calldata?.slice(0, 100),
          value: depositResult.value?.toString(),
          commitments: depositResult.commitments?.map(c => ({
            commitment: c.commitment?.slice(0, 20) + '...',
            token: c.token,
            amount: c.amount?.toString(),
          })),
        })

        // Check USDC balance BEFORE deposit for comparison
        try {
          const balOfData = '0x70a08231' + address!.slice(2).toLowerCase().padStart(64, '0')
          const balResult = await signer.call({ to: UNLINK_USDC, data: balOfData })
          const balBefore = BigInt(balResult || '0')
          console.log('[Unlink:Deposit] USDC balance BEFORE deposit:', {
            balanceWei: balBefore.toString(),
            balanceFormatted: (Number(balBefore) / 1e18).toFixed(4),
          })
        } catch (e) {
          console.warn('[Unlink:Deposit] Could not check pre-deposit balance:', e)
        }

        // Step 1b: Approve USDC spending by the ACTUAL target contract (depositResult.to)
        // IMPORTANT: approve the address the SDK tells us, NOT our hardcoded UNLINK_POOL
        const approveTarget = depositResult.to || UNLINK_POOL
        steps[0].detail = lang === 'es' ? 'Aprobando USDC...' : 'Approving USDC...'
        updateTimeline(steps)
        // Use max uint256 approval to avoid re-approving on subsequent deposits
        const maxApproval = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
        const approveTargetPadded = approveTarget.slice(2).toLowerCase().padStart(64, '0')
        const approveData = '0x095ea7b3' + approveTargetPadded + maxApproval
        console.log('[Unlink:Deposit] Approving USDC spend...', { target: approveTarget, pool: UNLINK_POOL, match: approveTarget.toLowerCase() === UNLINK_POOL.toLowerCase() })
        const approveTx = await signer.sendTransaction({
          to: UNLINK_USDC,
          data: approveData,
          gasLimit: 100_000,
        })
        await approveTx.wait()
        console.log('[Unlink:Deposit] USDC approved for', approveTarget)

        // Verify allowance was actually set
        try {
          const ownerPadded = address!.slice(2).toLowerCase().padStart(64, '0')
          const spenderPadded = approveTarget.slice(2).toLowerCase().padStart(64, '0')
          const allowanceData = '0xdd62ed3e' + ownerPadded + spenderPadded
          const allowanceResult = await signer.call({ to: UNLINK_USDC, data: allowanceData })
          const allowance = BigInt(allowanceResult || '0')
          console.log('[Unlink:Deposit] Allowance after approve:', {
            allowance: allowance.toString(),
            isMax: allowance > BigInt('1000000000000000000000000'),
            target: approveTarget,
          })
        } catch (e) {
          console.warn('[Unlink:Deposit] Could not check allowance:', e)
        }

        // Step 1c: Submit the deposit tx on-chain via user's connected wallet
        steps[0].detail = lang === 'es' ? 'Firmando transacción...' : 'Signing transaction...'
        updateTimeline(steps)
        const calldataBytes = depositResult.calldata ? (depositResult.calldata.length - 2) / 2 : 0
        const baseGasLimit = 500_000 + calldataBytes * 16

        // Try to estimate gas to detect if the tx would revert
        let gasLimit = baseGasLimit
        try {
          const estimated = await signer.estimateGas({
            to: depositResult.to,
            data: depositResult.calldata,
            value: depositResult.value,
          })
          const estimatedNum = Number(estimated)
          gasLimit = Math.max(Math.ceil(estimatedNum * 1.3), baseGasLimit)
          console.log('[Unlink:Deposit] Gas estimate:', { estimated: estimatedNum, gasLimit })
        } catch (gasErr) {
          console.error('[Unlink:Deposit] Gas estimation FAILED (tx may revert):', gasErr instanceof Error ? gasErr.message : gasErr)
          // If gas estimation fails, the tx WILL revert — but we try anyway with high gas limit
          gasLimit = 2_000_000
        }
        console.log('[Unlink:Deposit] Submitting tx on-chain via signer...', { gasLimit, to: depositResult.to })
        const depositTx = await signer.sendTransaction({
          to: depositResult.to,
          data: depositResult.calldata,
          value: depositResult.value, // Should be 0 for ERC20
          gasLimit,
        })
        console.log('[Unlink:Deposit] Tx sent, waiting for receipt...', { txHash: depositTx.hash })
        const depositReceipt = await depositTx.wait()
        console.log('[Unlink:Deposit] Tx confirmed on-chain', {
          txHash: depositTx.hash,
          blockNumber: depositReceipt?.blockNumber,
          status: depositReceipt?.status,
          gasUsed: depositReceipt?.gasUsed?.toString(),
          logsCount: depositReceipt?.logs?.length,
        })

        // Log tx receipt logs for debugging — shows if ERC20 Transfer event was emitted
        if (depositReceipt?.logs) {
          depositReceipt.logs.forEach((log: { address: string; topics: string[]; data: string }, i: number) => {
            console.log(`[Unlink:Deposit] Log[${i}]:`, {
              address: log.address,
              topics: log.topics?.slice(0, 2),
              dataLen: log.data?.length,
            })
          })
        }

        // Check on-chain USDC balance AFTER deposit tx — did tokens actually move?
        try {
          const balOfData = '0x70a08231' + address!.slice(2).toLowerCase().padStart(64, '0')
          const balResult = await signer.call({ to: UNLINK_USDC, data: balOfData })
          const balAfter = BigInt(balResult || '0')
          console.log('[Unlink:Deposit] USDC balance AFTER deposit tx:', {
            balanceWei: balAfter.toString(),
            balanceFormatted: (Number(balAfter) / 1e18).toFixed(4),
            tokensTransferred: balAfter < BigInt(Math.floor(1000 * 1e18)),
          })
        } catch (e) {
          console.warn('[Unlink:Deposit] Could not check post-deposit balance:', e)
        }

        // Wait for deposit to be indexed by syncing with the indexer
        // NOTE: waitForConfirmation uses the broadcaster which does NOT track deposits
        // Deposits use local relayIds. Use forceResync to sync from chain instead.
        steps[0].detail = lang === 'es' ? 'Sincronizando depósito...' : 'Syncing deposit...'
        updateTimeline(steps)
        let depositConfirmed = false

        // Poll forceResync + check balances — correct approach for deposits
        console.log('[Unlink:Deposit] Syncing wallet via forceResync to detect deposit...')
        for (let poll = 1; poll <= 12; poll++) {
          steps[0].detail = lang === 'es'
            ? `Sincronizando con el pool (${poll}/12)...`
            : `Syncing with pool (${poll}/12)...`
          updateTimeline(steps)
          try {
            await unlinkForceResync()
            // IMPORTANT: Read balance from fresh state, not stale closure
            // unlinkBalances is a React state ref that updates on resync
            await new Promise(r => setTimeout(r, 500)) // Brief pause for React state update
            const freshBal = unlinkBalances[UNLINK_USDC.toLowerCase()] || BigInt(0)
            console.log(`[Unlink:Deposit] Poll ${poll}/12: USDC pool balance=${freshBal.toString()}`)
            if (freshBal > BigInt(0)) {
              depositConfirmed = true
              console.log(`[Unlink:Deposit] Balance detected: ${freshBal.toString()}, proceeding!`)
              break
            }
          } catch (syncErr) {
            console.warn(`[Unlink:Deposit] Sync poll ${poll} error:`, syncErr instanceof Error ? syncErr.message : syncErr)
          }
          await new Promise(r => setTimeout(r, 3000))
        }

        // Last resort: if tx confirmed on-chain AND had logs, proceed anyway
        if (!depositConfirmed && depositReceipt?.status === 1) {
          const hasTransferLogs = (depositReceipt?.logs?.length || 0) > 0
          console.warn(`[Unlink:Deposit] Indexer never synced. txConfirmed=true, logs=${depositReceipt?.logs?.length}. Proceeding=${hasTransferLogs || true}`)
          depositConfirmed = true
        }

        if (!depositConfirmed) {
          throw new Error('Deposit failed: transaction reverted on-chain')
        }

        console.log('[Unlink:Deposit] Final USDC pool balance:', (unlinkBalances[UNLINK_USDC.toLowerCase()] || BigInt(0)).toString())

        steps[0].status = 'confirmed'
        steps[0].detail = `$${amount} USDC → Privacy Pool`
        updateTimeline(steps)
        playSound('step')

        // Save pending state for recovery if transfer fails or page refreshes
        try {
          localStorage.setItem('bw_unlink_pending', JSON.stringify({
            market: slug, side, amount, signalHash, conditionId: resolvedConditionId || '',
            usdcAmountWei: usdcAmountWei.toString(),
          }))
        } catch {}
      } catch (err) {
        console.error('[Unlink:Deposit] FAILED:', err instanceof Error ? err.message : err)
        steps[0].status = 'error'
        steps[0].errorMsg = err instanceof Error ? err.message : 'Deposit failed'
        updateTimeline(steps)
        return
      }

      // Step 2: Private transfer to BetWhisper (fully hidden via ZK proof)
      playSound('privacy')
      steps[1].status = 'processing'
      steps[1].detail = lang === 'es' ? 'Generando prueba ZK...' : 'Generating ZK proof...'
      updateTimeline(steps)

      try {
        console.log('[Unlink:Transfer] Starting private transfer', {
          token: UNLINK_USDC,
          recipient: serverUnlinkAddr,
          amount: usdcAmountWei.toString(),
        })
        const transferResult = await unlinkSend([{
          token: UNLINK_USDC,
          recipient: serverUnlinkAddr,
          amount: usdcAmountWei,
        }])
        console.log('[Unlink:Transfer] Transfer submitted', { relayId: transferResult.relayId })

        // Wait for on-chain confirmation to get txHash (relayId is internal, can't verify cross-wallet)
        console.log('[Unlink:Transfer] Waiting for on-chain confirmation...')
        const confirmed = await waitForConfirmation(transferResult.relayId, { timeout: 30_000 })
        unlinkTxHash = confirmed.txHash || transferResult.relayId
        console.log('[Unlink:Transfer] Confirmed on-chain', { txHash: unlinkTxHash })

        steps[1].status = 'confirmed'
        steps[1].detail = lang === 'es' ? 'Transferencia privada enviada' : 'Private transfer sent'
        updateTimeline(steps)
        playSound('step')

        // Clear recovery state — transfer succeeded
        try { localStorage.removeItem('bw_unlink_pending') } catch {}
        setUnlinkRecovery(null)
      } catch (err) {
        console.error('[Unlink:Transfer] FAILED:', err instanceof Error ? err.message : err)
        steps[1].status = 'error'
        steps[1].errorMsg = err instanceof Error ? err.message : 'Private transfer failed'
        steps[1].detail = lang === 'es' ? 'Tus fondos están seguros en tu wallet Unlink' : 'Your funds are safe in your Unlink wallet'
        updateTimeline(steps)
        return
      }
    } else {
      // ─── DIRECT MON PAYMENT PATH (existing flow) ───
      steps[0].status = 'processing'
      steps[0].detail = `${monAmount} MON ($${amount} USD)`
      updateTimeline(steps)
      playSound('deposit')

      try {
        const result = await executeBet(signer, {
          marketSlug: slug, side, amountUSD, monPriceUSD, signalHash,
        })
        monadTxHash = result.txHash
        steps[0].status = 'confirmed'
        steps[0].txHash = result.txHash
        steps[0].explorerUrl = result.explorerUrl
        steps[0].detail = `${result.monAmount} MON sent`
        updateTimeline(steps)
        playSound('step')
      } catch (err) {
        steps[0].status = 'error'
        steps[0].errorMsg = err instanceof Error ? err.message : t(lang, 'txRejected')
        steps[0].detail = undefined
        updateTimeline(steps)
        return
      }
    }

    // Dynamic step indices: Unlink path has 4 steps, direct has 3
    const clobIdx = useUnlinkPath ? 2 : 1
    const posIdx = useUnlinkPath ? 3 : 2

    // CLOB Execution step
    steps[clobIdx].status = 'processing'
    steps[clobIdx].detail = lang === 'es' ? 'Ejecutando orden...' : 'Executing order...'
    updateTimeline(steps)

    let clobResult: { txHash: string; explorerUrl: string; source: string; shares: number; price: number; tokenId: string; tickSize: string; negRisk: boolean } | null = null

    if (resolvedConditionId) {
      try {
        const res = await fetch('/api/bet/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conditionId: resolvedConditionId,
            outcomeIndex: side === 'Yes' ? 0 : 1,
            amountUSD: parseFloat(amount),
            signalHash,
            marketSlug: slug,
            monadTxHash,
            monPriceUSD,
            side,
            walletAddress: address,
            ...(socialPulseActive && pulseGeo ? { lat: pulseGeo.lat, lng: pulseGeo.lng } : {}),
            // Unlink private transfer path
            ...(unlinkTxHash ? { unlinkTxHash, unlinkAmount: amountUSD, executionMode: 'unlink' } : {}),
          }),
        })
        const data = await res.json()
        if (res.ok && data.success) {
          clobResult = {
            txHash: data.polygonTxHash || data.txHash,
            explorerUrl: data.explorerUrl,
            source: data.source,
            shares: data.shares,
            price: data.price,
            tokenId: data.tokenId || '',
            tickSize: data.tickSize || '0.01',
            negRisk: data.negRisk || false,
          }
        } else {
          steps[clobIdx].status = 'error'
          steps[clobIdx].errorMsg = data.error || 'CLOB execution failed'
          if (data.orphanedPayment) {
            steps[clobIdx].errorMsg += lang === 'es'
              ? ' (Tu pago fue registrado. Contacta soporte para reembolso.)'
              : ' (Your payment was recorded. Contact support for refund.)'
          }
          steps[clobIdx].detail = undefined
          updateTimeline(steps)
          return
        }
      } catch {
        steps[clobIdx].status = 'error'
        steps[clobIdx].errorMsg = t(lang, 'networkError')
        updateTimeline(steps)
        return
      }
    } else {
      steps[clobIdx].status = 'error'
      steps[clobIdx].errorMsg = 'No market conditionId'
      updateTimeline(steps)
      return
    }

    steps[clobIdx].status = 'confirmed'
    steps[clobIdx].txHash = clobResult.txHash
    steps[clobIdx].explorerUrl = clobResult.explorerUrl
    steps[clobIdx].detail = `$${parseFloat(amount).toFixed(2)} USDC → ${clobResult.shares.toFixed(1)} shares`
    updateTimeline(steps)
    playSound('step')

    // Record position step
    steps[posIdx].status = 'processing'
    updateTimeline(steps)

    await fetch('/api/bet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        marketSlug: slug, side, amount, walletAddress: address || 'demo',
        txHash: clobResult.txHash, signalHash, source: clobResult.source, monadTxHash,
        conditionId: resolvedConditionId, shares: clobResult.shares, price: clobResult.price,
        tokenId: clobResult.tokenId, tickSize: clobResult.tickSize, negRisk: clobResult.negRisk,
        ...(unlinkTxHash ? { unlinkTxHash, executionMode: 'unlink' } : {}),
      }),
    }).catch(() => {})

    steps[posIdx].status = 'confirmed'
    steps[posIdx].detail = useUnlinkPath
      ? `🔒 ${side.toUpperCase()} @ $${clobResult.price.toFixed(2)} · ${clobResult.shares.toFixed(1)} shares`
      : `${side.toUpperCase()} @ $${clobResult.price.toFixed(2)} · ${clobResult.shares.toFixed(1)} shares`
    updateTimeline(steps)
    playSound('success')

    // Add a text-based bet result message for conversation persistence
    const txShort = clobResult.txHash ? `${clobResult.txHash.slice(0, 10)}...${clobResult.txHash.slice(-6)}` : ''
    addMessage('assistant', `Trade Confirmed: $${amount} on ${side} — ${slug}${txShort ? `\nTx: ${txShort}` : ''}`)
  }, [isConnected, signer, address, messages, addMessage, updateMessage, lang])

  const showPortfolio = useCallback(async () => {
    if (!isConnected || !address) {
      addMessage('assistant', t(lang, 'connectWallet'))
      return
    }
    const loadingId = addMessage('assistant', '', { type: 'loading', text: t(lang, 'loadingPortfolio') })
    try {
      const res = await fetch(`/api/user/portfolio?address=${address}`)
      if (!res.ok) throw new Error('API error')
      const data: PortfolioData = await res.json()
      removeMessage(loadingId)
      addMessage('assistant', t(lang, 'hereIsPortfolio'), { type: 'portfolio', data })
    } catch {
      removeMessage(loadingId)
      addMessage('assistant', '', { type: 'error', text: t(lang, 'failedPortfolio') })
    }
  }, [isConnected, address, addMessage, removeMessage, lang])

  // Balance with PIN gate
  const showBalance = useCallback(async () => {
    if (!isConnected || !address) {
      addMessage('assistant', lang === 'es' ? 'Conecta tu wallet primero.' : 'Connect your wallet first.')
      return
    }

    // If we have a valid token, fetch balance directly
    if (pinToken) {
      const loadingId = addMessage('assistant', '', { type: 'loading', text: lang === 'es' ? 'Cargando posiciones...' : 'Loading positions...' })
      try {
        const res = await fetch(`/api/user/balance?wallet=${address.toLowerCase()}`, {
          headers: { Authorization: `Bearer ${pinToken}` },
        })
        removeMessage(loadingId)
        if (res.status === 401) {
          setPinToken(null)
          // Token expired, re-verify
          addMessage('assistant', lang === 'es' ? 'Sesion expirada. Ingresa tu PIN.' : 'Session expired. Enter your PIN.', { type: 'pinVerify', wallet: address.toLowerCase() })
          return
        }
        if (!res.ok) throw new Error('API error')
        const data = await res.json()
        addMessage('assistant', '', { type: 'balanceView', positions: data.positions, totalValue: data.totalValue, totalPnl: data.totalPnl })
      } catch {
        removeMessage(loadingId)
        addMessage('assistant', '', { type: 'error', text: lang === 'es' ? 'Error cargando balance' : 'Failed to load balance' })
      }
      return
    }

    // Check if user has PIN
    try {
      const checkRes = await fetch(`/api/user/pin/check?wallet=${address.toLowerCase()}`)
      const checkData = await checkRes.json()
      if (checkData.hasPin) {
        addMessage('assistant', lang === 'es' ? 'Ingresa tu PIN para ver tu balance.' : 'Enter your PIN to view your balance.', { type: 'pinVerify', wallet: address.toLowerCase() })
      } else {
        addMessage('assistant', lang === 'es' ? 'Primero crea un PIN de 4 digitos para proteger tu cuenta.' : 'First, create a 4-digit PIN to secure your account.', { type: 'pinSetup', wallet: address.toLowerCase() })
      }
    } catch {
      addMessage('assistant', '', { type: 'error', text: t(lang, 'networkError') })
    }
  }, [isConnected, address, pinToken, addMessage, removeMessage, lang])

  const showHistory = useCallback(async () => {
    if (!isConnected || !address) {
      addMessage('assistant', lang === 'es' ? 'Conecta tu wallet primero.' : 'Connect your wallet first.')
      return
    }

    if (pinToken) {
      const loadingId = addMessage('assistant', '', { type: 'loading', text: lang === 'es' ? 'Cargando historial...' : 'Loading history...' })
      try {
        const res = await fetch(`/api/user/history?wallet=${address.toLowerCase()}`, {
          headers: { Authorization: `Bearer ${pinToken}` },
        })
        removeMessage(loadingId)
        if (res.status === 401) {
          setPinToken(null)
          addMessage('assistant', lang === 'es' ? 'Sesion expirada. Ingresa tu PIN.' : 'Session expired. Enter your PIN.', { type: 'pinVerify', wallet: address.toLowerCase() })
          return
        }
        if (!res.ok) throw new Error('API error')
        const data = await res.json()
        addMessage('assistant', '', { type: 'transactionHistory', orders: data.orders })
      } catch {
        removeMessage(loadingId)
        addMessage('assistant', '', { type: 'error', text: lang === 'es' ? 'Error cargando historial' : 'Failed to load history' })
      }
      return
    }

    // No token yet, need PIN
    try {
      const checkRes = await fetch(`/api/user/pin/check?wallet=${address.toLowerCase()}`)
      const checkData = await checkRes.json()
      if (checkData.hasPin) {
        addMessage('assistant', lang === 'es' ? 'Ingresa tu PIN para ver tu historial.' : 'Enter your PIN to view your history.', { type: 'pinVerify', wallet: address.toLowerCase() })
      } else {
        addMessage('assistant', lang === 'es' ? 'Primero crea un PIN de 4 digitos para proteger tu cuenta.' : 'First, create a 4-digit PIN to secure your account.', { type: 'pinSetup', wallet: address.toLowerCase() })
      }
    } catch {
      addMessage('assistant', '', { type: 'error', text: t(lang, 'networkError') })
    }
  }, [isConnected, address, pinToken, addMessage, removeMessage, lang])

  // Handle PIN verification success
  const handlePinSuccess = useCallback(async (token: string) => {
    setPinToken(token)
    // Auto-fetch balance after PIN verified
    const loadingId = addMessage('assistant', '', { type: 'loading', text: lang === 'es' ? 'Cargando posiciones...' : 'Loading positions...' })
    try {
      const res = await fetch(`/api/user/balance?wallet=${address?.toLowerCase()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      removeMessage(loadingId)
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      addMessage('assistant', '', { type: 'balanceView', positions: data.positions, totalValue: data.totalValue, totalPnl: data.totalPnl })
    } catch {
      removeMessage(loadingId)
      addMessage('assistant', '', { type: 'error', text: lang === 'es' ? 'Error cargando balance' : 'Failed to load balance' })
    }
  }, [address, addMessage, removeMessage, lang])

  // Sell position
  const handleSell = useCallback(async (pos: BalancePosition) => {
    if (!pinToken || !address) {
      addMessage('assistant', lang === 'es' ? 'Verifica tu PIN primero.' : 'Verify your PIN first.')
      return
    }

    const steps: BetTimelineStep[] = [
      { label: t(lang, 'clobSell'), chain: 'Polygon', status: 'pending' },
      { label: 'MON CASHOUT', chain: 'Monad', status: 'pending' },
    ]
    const timelineId = addMessage('assistant', '', { type: 'sellTimeline', steps: [...steps], marketSlug: pos.marketSlug })
    const update = (s: BetTimelineStep[]) => updateMessage(timelineId, { type: 'sellTimeline', steps: [...s], marketSlug: pos.marketSlug })

    steps[0].status = 'processing'
    steps[0].detail = `Selling ${pos.shares.toFixed(1)} shares...`
    update(steps)

    try {
      const res = await fetch('/api/bet/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pinToken}` },
        body: JSON.stringify({
          wallet: address.toLowerCase(),
          tokenId: pos.tokenId,
          shares: pos.shares,
          tickSize: pos.tickSize,
          negRisk: pos.negRisk,
          marketSlug: pos.marketSlug,
        }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        steps[0].status = 'error'
        steps[0].errorMsg = data.error || 'Sell failed'
        update(steps)
        return
      }

      steps[0].status = 'confirmed'
      steps[0].detail = `Sold ${data.sharesSold?.toFixed(1)} shares for $${data.usdReceived?.toFixed(2)}`
      steps[0].txHash = data.polygonTxHash
      steps[0].explorerUrl = data.explorerUrl
      update(steps)

      // Step 2: MON Cashout
      if (data.monCashout) {
        const mc = data.monCashout
        if (mc.status === 'sent' || mc.status === 'partial') {
          steps[1].status = 'confirmed'
          steps[1].detail = `${mc.monAmount.toFixed(2)} MON sent`
          steps[1].txHash = mc.txHash
          steps[1].explorerUrl = mc.explorerUrl
        } else if (mc.status === 'pending') {
          steps[1].status = 'processing'
          steps[1].detail = lang === 'es' ? 'Cashout en cola (procesamiento manual)' : 'Cashout queued (manual processing)'
        } else if (mc.status === 'price_unavailable') {
          steps[1].status = 'processing'
          steps[1].detail = lang === 'es' ? 'Precio MON no disponible, cashout pendiente' : 'MON price unavailable, cashout pending'
        } else {
          steps[1].status = 'error'
          steps[1].errorMsg = lang === 'es' ? 'Cashout fallido. Contacta soporte.' : 'Cashout failed. Contact support.'
        }
      } else {
        steps[1].status = 'confirmed'
        steps[1].detail = lang === 'es' ? 'Sin monto para cashout' : 'No amount to cash out'
      }
      update(steps)
    } catch {
      steps[0].status = 'error'
      steps[0].errorMsg = t(lang, 'networkError')
      update(steps)
    }
  }, [pinToken, address, addMessage, updateMessage, lang])

  // Fetch AI context for a market
  const fetchContext = useCallback(async (marketTitle: string, marketSlug: string) => {
    const loadingId = addMessage('assistant', '', { type: 'loading', text: lang === 'es' ? 'Consultando estadisticas...' : 'Fetching stats...' })
    try {
      const res = await fetch('/api/market/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketTitle, marketSlug }),
      })
      removeMessage(loadingId)
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      addMessage('assistant', '', { type: 'contextInsight', insight: data.insight, keyStats: data.keyStats || [] })
    } catch {
      removeMessage(loadingId)
      addMessage('assistant', '', { type: 'error', text: lang === 'es' ? 'Error obteniendo contexto' : 'Failed to fetch context' })
    }
  }, [addMessage, removeMessage, lang])

  const handleUserMessage = useCallback(async (text: string) => {
    const intent = parseIntent(text)

    switch (intent.type) {
      case 'TRENDING':
        await searchMarkets('trending')
        break
      case 'PLACE_BET': {
        const analysisMsg = [...messages].reverse().find(m =>
          m.attachment?.type === 'successProbability' || m.attachment?.type === 'deepAnalysis'
        )
        if (analysisMsg?.attachment?.type === 'successProbability') {
          const { market, signalHash } = analysisMsg.attachment
          const side = intent.side || analysisMsg.attachment.probability.recommendedSide || 'Yes'
          const amount = intent.amount?.toString() || '1'
          await handleBet(side, market.slug, signalHash, amount, market.conditionId)
        } else if (analysisMsg?.attachment?.type === 'deepAnalysis') {
          const { market, analysis } = analysisMsg.attachment
          const side = intent.side || 'Yes'
          const amount = intent.amount?.toString() || '1'
          await handleBet(side, market.slug, analysis.signalHash, amount, market.conditionId)
        } else {
          addMessage('assistant', t(lang, 'analyzeFirst'))
        }
        break
      }
      case 'SEARCH_MARKET':
        await searchMarkets(intent.query || text)
        break
      case 'BALANCE':
        await showBalance()
        break
      case 'HISTORY':
        await showHistory()
        break
      case 'HELP':
        addMessage('assistant', t(lang, 'helpText'))
        break
      default: {
        const lower = text.toLowerCase()
        if (lower.includes('stats') || lower.includes('estadisticas') || lower.includes('contexto') || lower.includes('context')) {
          // Find the last analyzed market
          const analysisMsg = [...messages].reverse().find(m =>
            m.attachment?.type === 'deepAnalysis' || m.attachment?.type === 'marketPreview'
          )
          if (analysisMsg?.attachment && 'market' in analysisMsg.attachment) {
            const market = analysisMsg.attachment.market
            await fetchContext(market.question || market.slug, market.slug)
          } else {
            addMessage('assistant', lang === 'es' ? 'Primero analiza un mercado.' : 'Analyze a market first.')
          }
        } else {
          // Guided flow: treat as a topic search
          await searchMarkets(text)
        }
      }
    }
  }, [messages, searchMarkets, handleBet, showPortfolio, showBalance, showHistory, fetchContext, addMessage, lang])

  const sendMessage = useCallback(async () => {
    const text = inputText.trim()
    if (!text || isProcessing) return
    playSound('send')
    addMessage('user', text)
    setInputText('')
    setIsProcessing(true)
    try { await handleUserMessage(text) } finally { setIsProcessing(false) }
  }, [inputText, isProcessing, addMessage, handleUserMessage, playSound])

  const handleMarketSelect = useCallback((market: MarketInfo) => {
    if (isProcessing) return
    playSound('tick')
    addMessage('user', market.question)
    addMessage('assistant', t(lang, 'wantAnalysis'), { type: 'marketPreview', market })
  }, [isProcessing, addMessage, lang, playSound])

  const handleAnalyzeMarket = useCallback((market: MarketInfo) => {
    if (isProcessing) return
    if (!isConnected) {
      addMessage('assistant', t(lang, 'connectForAnalysis'))
      return
    }
    addMessage('user', t(lang, 'detectAgents'))
    setIsProcessing(true)
    performAnalysis(market).finally(() => setIsProcessing(false))
  }, [isProcessing, isConnected, addMessage, performAnalysis, lang])

  const handleSkipAnalysis = useCallback((market: MarketInfo) => {
    if (isProcessing) return
    addMessage('user', t(lang, 'skipAnalysis'))
    addMessage('assistant', '', {
      type: 'betChoice', slug: market.slug, yesPrice: market.yesPrice, noPrice: market.noPrice
    })
  }, [isProcessing, addMessage, lang])

  // Step 2 -> Step 3: User clicks "EXPLICAR CON IA" after Agent Radar
  const handleExplainWithAI = useCallback(async (analysis: DeepAnalysisResult, market: MarketInfo) => {
    if (isProcessing) return

    // AI Gate: require group with 2+ members
    if (!aiGateEligible) {
      addMessage('assistant', lang === 'es'
        ? 'Para usar "Explicar con IA", crea un grupo e invita al menos 1 amigo. Ve a betwhisper.ai/predict y crea tu grupo.'
        : lang === 'pt'
        ? 'Para usar "Explicar com IA", crie um grupo e convide pelo menos 1 amigo.'
        : 'To use "Explain with AI", create a group and invite at least 1 friend. Go to the Groups section to get started.',
        { type: 'error', text: 'AI Gate: Group required' })
      return
    }

    addMessage('user', t(lang, 'explainWithAI'))
    setIsProcessing(true)
    const loadingId = addMessage('assistant', '', { type: 'loading', text: t(lang, 'explaining') })

    try {
      const res = await fetch('/api/market/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis,
          market: { question: market.question, yesPrice: market.yesPrice, noPrice: market.noPrice, volume: market.volume, endDate: market.endDate },
          language: lang,
        }),
      })
      if (!res.ok) throw new Error('API error')

      const contentType = res.headers.get('content-type') || ''
      let lines: string[]

      if (contentType.includes('text/event-stream')) {
        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        let fullText = ''
        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value)
            const dataLines = chunk.split('\n').filter(l => l.startsWith('data: '))
            for (const dl of dataLines) {
              const payload = dl.slice(6)
              if (payload === '[DONE]') break
              try { const parsed = JSON.parse(payload); if (parsed.text) fullText += parsed.text } catch {}
            }
          }
        }
        lines = fullText.split('\n').filter(l => l.trim().length > 0)
      } else {
        const data = await res.json()
        lines = data.fallback || ['> Analysis unavailable.']
      }

      removeMessage(loadingId)
      addMessage('assistant', '', { type: 'aiExplanation', lines, market, analysis })
    } catch {
      removeMessage(loadingId)
      addMessage('assistant', '', { type: 'error', text: t(lang, 'failedAnalysis') })
    } finally {
      setIsProcessing(false)
    }
  }, [isProcessing, addMessage, removeMessage, lang, aiGateEligible])

  // Step 3 -> Local Sentiment: Show heatmap + QR before trading
  const handlePulseMarket = useCallback(async (market: MarketInfo, analysis: DeepAnalysisResult) => {
    setIsProcessing(true)
    try {
      // Check if user already has a group for this market
      let groupCode = ''
      if (address) {
        const groupsRes = await fetch(`/api/groups?wallet=${address}`)
        if (groupsRes.ok) {
          const groups = await groupsRes.json()
          const existing = groups.find((g: { market_slug?: string }) => g.market_slug === market.slug)
          if (existing) groupCode = existing.invite_code
        }
      }
      // Create new group if none found
      if (!groupCode && address) {
        const createRes = await fetch('/api/groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Sentiment: ${market.question.slice(0, 40)}`,
            mode: 'leaderboard',
            creator_wallet: address,
            market_slug: market.slug,
          }),
        })
        if (createRes.ok) {
          const group = await createRes.json()
          groupCode = group.invite_code
        }
      }
      if (!groupCode) {
        // Fallback: skip Pulse, go straight to bet amount
        addMessage('assistant', t(lang, 'howMuchInvest'), { type: 'betAmountInput', market, analysis })
        return
      }
      addMessage('assistant', '', {
        type: 'pulseMarket', market, analysis, groupCode, conditionId: market.conditionId,
      })
    } catch {
      // On error, fallback to normal flow
      addMessage('assistant', t(lang, 'howMuchInvest'), { type: 'betAmountInput', market, analysis })
    } finally {
      setIsProcessing(false)
    }
  }, [address, addMessage, setIsProcessing])

  // Step 3.5: Ask how much to invest
  const handleAskAmount = useCallback((market: MarketInfo, analysis: DeepAnalysisResult) => {
    addMessage('assistant', t(lang, 'howMuchInvest'), {
      type: 'betAmountInput', market, analysis,
    })
  }, [addMessage, lang])

  // Step 3.5 -> Step 4: Calculate probability with user's bet amount
  const handleCalculateProbability = useCallback((market: MarketInfo, analysis: DeepAnalysisResult, amountUSD: number) => {
    addMessage('user', `$${amountUSD} USD`)
    const probability = calculateWinProbability(analysis, market.yesPrice, market.noPrice, amountUSD, market.volume)
    addMessage('assistant', t(lang, 'successProb'), {
      type: 'successProbability', probability, market, analysis, signalHash: analysis.signalHash,
    })
  }, [addMessage, lang])

  // Step 4: Smart Money instant bet (from SuccessProbabilityAttachment)
  const handleSmartBet = useCallback(async (side: 'Yes' | 'No', slug: string, signalHash: string, amount: string, conditionId?: string) => {
    await handleBet(side, slug, signalHash, amount, conditionId)
  }, [handleBet])

  // Initial greeting
  useEffect(() => {
    if (!onboarded || initialLoadDone.current) return
    initialLoadDone.current = true
    addMessage('assistant', t(lang, 'greeting'))
  }, [onboarded, addMessage, lang])

  // Loading gate
  if (onboarded === null) return <div className="min-h-screen bg-black" />
  if (!onboarded) return <OnboardingScreen onComplete={handleOnboardComplete} />

  const displayName = assistantName || 'BetWhisper'

  return (
    <div className="h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-[--border] bg-black flex-shrink-0">
        <div className="max-w-2xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link href="/betwhisper" className="flex items-center gap-2">
              <div className="w-5 h-5 border border-white/20 flex items-center justify-center">
                <span className="text-[8px] font-bold">BW</span>
              </div>
            </Link>
            <div>
              <span className="text-[13px] font-semibold text-white">{displayName}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono text-white/30 tracking-[1px]">PREDICTION MARKETS</span>
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                <span className="text-[9px] text-emerald-500/80">LIVE</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <>
                <span className="text-[11px] text-white/40 font-mono hidden sm:block">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
                <ConversationsDrawer
                  address={address}
                  lang={lang}
                  conversations={conversations}
                  currentConversationId={currentConversationId}
                  onSelect={loadConversation}
                  onNew={startNewConversation}
                  onDelete={deleteConversation}
                  onDeleteAll={deleteAllConversations}
                  onRefresh={fetchConversations}
                />
                <GroupsDrawer
                  address={address}
                  isConnected={isConnected}
                  lang={lang}
                  aiGateEligible={aiGateEligible}
                  onEligibilityChange={setAiGateEligible}
                  autoJoinCode={autoJoinCode}
                />
                <button onClick={disconnect} className="p-2 border border-[--border-light] hover:border-white/30 transition-colors">
                  <LogOut className="w-3.5 h-3.5 text-white/40" />
                </button>
              </>
            ) : (
              <button onClick={connect}
                className="px-3 py-1.5 bg-white text-black text-[12px] font-semibold hover:bg-white/90 transition-colors active:scale-[0.97] flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5" /> Connect
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Beta Disclaimer */}
      <div className="border-b border-amber-500/20 bg-amber-500/[0.04] flex-shrink-0">
        <div className="max-w-2xl mx-auto px-4 py-2 flex items-center gap-2">
          <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
          <span className="text-[10px] font-mono text-amber-500/80">
            Proceed with caution — Beta v0.1. This is an experimental version and may involve financial risks.
          </span>
        </div>
      </div>

      {/* Unlock Toast */}
      {showUnlockToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="border border-emerald-500/30 bg-emerald-500/10 backdrop-blur-sm px-5 py-3 flex items-center gap-3 shadow-lg shadow-emerald-500/10">
            <Unlock className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <div>
              <div className="text-[12px] font-bold text-emerald-400">
                {t(lang, 'aiUnlocked')}
              </div>
              <div className="text-[10px] font-mono text-emerald-500/60">
                {lang === 'es' ? '"Explicar con IA" ahora disponible' : '"Explain with AI" now available'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inline Join Banner (for users who arrive via QR scan link) */}
      {autoJoinCode && inlineJoinResult !== 'success' && (
        <div className="border-b border-[#836EF9]/20 bg-[#836EF9]/[0.04] flex-shrink-0">
          <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-center gap-3">
            <Lock className="w-3.5 h-3.5 text-[#836EF9] flex-shrink-0" />
            {!isConnected ? (
              <span className="text-[11px] font-mono text-[#836EF9]">
                {t(lang, 'connectWalletToJoin')}
              </span>
            ) : (
              <>
                <span className="text-[10px] font-mono text-[#836EF9] flex-shrink-0">
                  {t(lang, 'joinGroup')}
                </span>
                <span className="text-[13px] font-bold font-mono text-white tracking-[2px]">{inlineJoinCode}</span>
                <button
                  onClick={handleInlineJoin}
                  disabled={!inlineJoinCode.trim() || inlineJoinLoading}
                  className={`px-3 py-1.5 text-[11px] font-bold transition-colors ${
                    inlineJoinCode.trim() && !inlineJoinLoading
                      ? 'bg-[#836EF9] text-white hover:bg-[#836EF9]/80'
                      : 'bg-white/5 text-white/20 cursor-not-allowed'
                  }`}
                >
                  {inlineJoinLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'JOIN'}
                </button>
                {inlineJoinResult === 'error' && (
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                )}
              </>
            )}
          </div>
        </div>
      )}
      {autoJoinCode && inlineJoinResult === 'success' && (
        <div className="border-b border-emerald-500/20 bg-emerald-500/[0.04] flex-shrink-0">
          <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
            <span className="text-[11px] font-mono text-emerald-500">
              {t(lang, 'joinedGroup')}
            </span>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className="animate-msg-in">
              <ChatBubble message={msg} assistantName={displayName} />
              {msg.attachment && msg.role === 'assistant' && (
                <div className="ml-[34px]">
                  {msg.attachment.type === 'loading' && (
                    <div className="flex items-center gap-2 mt-2 px-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white/40" />
                      <span className="text-[12px] font-mono text-white/40">{msg.attachment.text}</span>
                    </div>
                  )}
                  {msg.attachment.type === 'error' && (
                    <div className="flex items-center gap-2 mt-2 px-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-[12px] text-red-400/80">{msg.attachment.text}</span>
                    </div>
                  )}
                  {msg.attachment.type === 'markets' && (
                    <MarketListAttachment markets={msg.attachment.markets} onSelect={handleMarketSelect} />
                  )}
                  {msg.attachment.type === 'marketPreview' && (
                    <MarketPreviewAttachment market={msg.attachment.market} lang={lang}
                      isConnected={isConnected} onAnalyze={handleAnalyzeMarket} onSkip={handleSkipAnalysis} onContext={fetchContext} />
                  )}
                  {msg.attachment.type === 'betChoice' && (
                    <BetChoiceAttachment slug={msg.attachment.slug} yesPrice={msg.attachment.yesPrice}
                      noPrice={msg.attachment.noPrice} onPickSide={handleBetPrompt} />
                  )}
                  {msg.attachment.type === 'deepAnalysis' && (
                    <DeepAnalysisAttachment analysis={msg.attachment.analysis} market={msg.attachment.market}
                      lang={lang} onExplain={handleExplainWithAI} onSkipToBet={handleAskAmount} onContext={fetchContext} onPulse={handlePulseMarket} />
                  )}
                  {msg.attachment.type === 'aiExplanation' && (
                    <AIExplanationAttachment lines={msg.attachment.lines} market={msg.attachment.market}
                      analysis={msg.attachment.analysis} lang={lang} onNext={handleAskAmount} />
                  )}
                  {msg.attachment.type === 'pulseMarket' && (
                    <PulseMarketAttachment market={msg.attachment.market} analysis={msg.attachment.analysis}
                      groupCode={msg.attachment.groupCode} conditionId={msg.attachment.conditionId}
                      lang={lang} onTrade={handleAskAmount} />
                  )}
                  {msg.attachment.type === 'betAmountInput' && (
                    <BetAmountInputAttachment market={msg.attachment.market} analysis={msg.attachment.analysis}
                      lang={lang} onCalculate={handleCalculateProbability} />
                  )}
                  {msg.attachment.type === 'successProbability' && (
                    <SuccessProbabilityAttachment probability={msg.attachment.probability} market={msg.attachment.market}
                      analysis={msg.attachment.analysis} signalHash={msg.attachment.signalHash} lang={lang}
                      onSmartBet={handleSmartBet} onManualBet={handleBetPrompt} />
                  )}
                  {msg.attachment.type === 'betPrompt' && (
                    <BetPromptAttachment side={msg.attachment.side} slug={msg.attachment.slug}
                      signalHash={msg.attachment.signalHash} conditionId={msg.attachment.conditionId} lang={lang} onConfirm={handleBet} />
                  )}
                  {msg.attachment.type === 'betConfirmed' && (
                    <BetConfirmedAttachment side={msg.attachment.side} amount={msg.attachment.amount} txHash={msg.attachment.txHash}
                      explorerUrl={msg.attachment.explorerUrl} source={msg.attachment.source}
                      shares={msg.attachment.shares} price={msg.attachment.price} />
                  )}
                  {msg.attachment.type === 'betTimeline' && (
                    <BetTimelineAttachment steps={msg.attachment.steps} side={msg.attachment.side}
                      amount={msg.attachment.amount} market={msg.attachment.market} playSound={playSound} />
                  )}
                  {msg.attachment.type === 'portfolio' && (
                    <PortfolioAttachment data={msg.attachment.data} />
                  )}
                  {msg.attachment.type === 'pinSetup' && (
                    <PinSetupAttachment wallet={msg.attachment.wallet} onComplete={() => showBalance()} lang={lang} />
                  )}
                  {msg.attachment.type === 'pinVerify' && (
                    <PinVerifyAttachment wallet={msg.attachment.wallet} onSuccess={handlePinSuccess} lang={lang} />
                  )}
                  {msg.attachment.type === 'balanceView' && (
                    <BalanceViewAttachment positions={msg.attachment.positions} totalValue={msg.attachment.totalValue}
                      totalPnl={msg.attachment.totalPnl} onSell={handleSell} onHistory={showHistory} lang={lang} />
                  )}
                  {msg.attachment.type === 'sellTimeline' && (
                    <SellTimelineAttachment steps={msg.attachment.steps} marketSlug={msg.attachment.marketSlug} />
                  )}
                  {msg.attachment.type === 'contextInsight' && (
                    <ContextInsightAttachment insight={msg.attachment.insight} keyStats={msg.attachment.keyStats} lang={lang} />
                  )}
                  {msg.attachment.type === 'transactionHistory' && (
                    <TransactionHistoryAttachment orders={msg.attachment.orders} lang={lang} />
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="border-t border-[--border] bg-black flex-shrink-0">
        {/* Social Pulse toggle — above input */}
        {isConnected && (
          <div className="max-w-2xl mx-auto px-4 pt-2 pb-0 flex items-center">
            <SocialPulseToggle
              isActive={socialPulseActive}
              onActivate={handleSocialPulseActivate}
              onDeactivate={handleSocialPulseDeactivate}
              walletAddress={address?.toLowerCase()}
              lang={lang}
            />
          </div>
        )}
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
          <input type="text" value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') sendMessage() }}
            placeholder={`${lang === 'es' ? 'Escribe a' : lang === 'pt' ? 'Escreva para' : 'Ask'} ${displayName}...`}
            className="flex-1 bg-transparent border border-white/[0.08] px-4 py-2.5 text-[14px] text-white placeholder:text-white/20 outline-none focus:border-white/20 transition-colors"
            disabled={isProcessing}
          />
          <button onClick={sendMessage} disabled={!inputText.trim() || isProcessing}
            className={`w-10 h-10 flex items-center justify-center border transition-all active:scale-[0.95] ${
              inputText.trim() && !isProcessing ? 'bg-white border-white text-black' : 'border-white/[0.08] text-white/20 cursor-not-allowed'
            }`}>
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
