'use client'

import { useWeb3 } from '@/components/web3-provider'
import { useState, useCallback, useEffect, useRef } from 'react'
import { parseIntent } from '@/lib/intents'
import { executeBet } from '@/lib/monad-bet'
import { MONAD_EXPLORER } from '@/lib/constants'
import Link from 'next/link'
import {
  Wallet, LogOut, Loader2, AlertTriangle,
  Shield, ChevronRight, ExternalLink, CheckCircle,
  ArrowUp, Globe, Star, TrendingUp, Brain, Landmark,
  Swords, Gamepad2, CircleDot, Bitcoin, Dribbble,
  Trophy, Zap,
  Users, Link2, Copy, Check, Plus, ArrowLeft, Crown, Lock, Unlock,
  MessageSquare, Trash2, Clock,
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
    greeting: "Hey! What bet do you want to make today?",
    askSpecific: "Nice! What specifically?",
    searchingMarkets: "Searching markets...",
    scanningWhales: "Agent Radar scanning holders...",
    foundMarkets: "Found {n} market{s}. Which one?",
    noMarkets: "No markets found for that. Try something else?",
    whaleResult: "{n} whale{s}, {pct}% {dir}.",
    radarResult: "Scanned {scanned} of {total} holders. {agentPct}% agent activity detected.",
    noWhales: "No tracked whales in this market. You can still bet.",
    howMuch: "How much?",
    placingBet: "Placing {amount} MON on {side}...",
    betConfirmed: "Bet confirmed on Polymarket.",
    connectWallet: "Connect your wallet to see your portfolio.",
    loadingPortfolio: "Loading portfolio...",
    hereIsPortfolio: "Here is your portfolio.",
    analyzeFirst: "Pick a market first, then I can help you bet.",
    helpText: "You can search markets, analyze whales, and place bets. Try typing what you want to bet on!",
    wantAnalysis: "Want my analysis before you bet?",
    analyzeBtn: "ANALYZE WITH AI",
    detectAgents: "DETECT AGENTS",
    explainWithAI: "EXPLAIN WITH AI",
    explaining: "AI analyzing market data...",
    betNow: "BET",
    skipAnalysis: "SKIP, BET NOW",
    connectForAnalysis: "Connect your wallet to unlock agent detection.",
    successProb: "Win Probability",
    recommendedSide: "Recommended",
    smartMoneyBet: "SMART MONEY",
    noEdge: "No edge detected. Bet at your own risk.",
    highConfidence: "High confidence",
    mediumConfidence: "Medium confidence",
    lowConfidence: "Low confidence",
    howMuchInvest: "How much do you want to invest?",
    investPlaceholder: "Amount in USD",
    calculateProb: "CALCULATE PROBABILITY",
    marketImpactLabel: "Your size",
    yourSizeMovesMarket: "Your bet is {pct}% of market volume. This will move the price against you.",
    sizeOk: "Your bet size has negligible market impact.",
    manualAmount: "Or pick amount:",
    monOnMonad: "MON on Monad",
    onboardName: "Name your assistant",
    onboardNameSub: "This is how you will activate it. By voice, through your glasses, or by typing.",
    onboardCategories: "What do you bet on?",
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
    failedBet: "Failed to place bet. Please try again.",
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
    greeting: "Hola! Que apuesta quieres hacer hoy?",
    askSpecific: "Vale! En que especificamente?",
    searchingMarkets: "Buscando mercados...",
    scanningWhales: "Agent Radar escaneando holders...",
    foundMarkets: "Encontre {n} mercado{s}. Cual te interesa?",
    noMarkets: "No encontre mercados para eso. Intenta con otra cosa?",
    whaleResult: "{n} ballena{s}, {pct}% {dir}.",
    radarResult: "Escanee {scanned} de {total} holders. {agentPct}% actividad de agentes detectada.",
    noWhales: "No hay ballenas rastreadas en este mercado. Aun puedes apostar.",
    howMuch: "Cuanto quieres apostar?",
    placingBet: "Apostando {amount} MON en {side}...",
    betConfirmed: "Apuesta confirmada en Polymarket.",
    connectWallet: "Conecta tu wallet para ver tu portafolio.",
    loadingPortfolio: "Cargando portafolio...",
    hereIsPortfolio: "Aqui esta tu portafolio.",
    analyzeFirst: "Primero elige un mercado, despues te ayudo a apostar.",
    helpText: "Puedes buscar mercados, analizar ballenas y apostar. Escribe sobre que quieres apostar!",
    wantAnalysis: "Quieres mi analisis antes de apostar?",
    analyzeBtn: "ANALIZAR CON IA",
    detectAgents: "DETECTAR AGENTES",
    explainWithAI: "EXPLICAR CON IA",
    explaining: "IA analizando datos del mercado...",
    betNow: "APOSTAR",
    skipAnalysis: "SALTAR, APOSTAR YA",
    connectForAnalysis: "Conecta tu wallet para detectar agentes.",
    successProb: "Probabilidad de Exito",
    recommendedSide: "Recomendado",
    smartMoneyBet: "SMART MONEY",
    noEdge: "Sin ventaja detectada. Apuesta bajo tu propio riesgo.",
    highConfidence: "Alta confianza",
    mediumConfidence: "Confianza media",
    lowConfidence: "Baja confianza",
    howMuchInvest: "Cuanto quieres invertir?",
    investPlaceholder: "Monto en USD",
    calculateProb: "CALCULAR PROBABILIDAD",
    marketImpactLabel: "Tu tamano",
    yourSizeMovesMarket: "Tu apuesta es {pct}% del volumen del mercado. Esto movera el precio en tu contra.",
    sizeOk: "Tu apuesta tiene impacto minimo en el mercado.",
    manualAmount: "O elige monto:",
    monOnMonad: "MON en Monad",
    onboardName: "Nombra a tu asistente",
    onboardNameSub: "Asi lo vas a activar. Por voz, con tus lentes, o escribiendo.",
    onboardCategories: "En que apuestas?",
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
    failedBet: "Error al apostar. Intenta de nuevo.",
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
    greeting: "Oi! Que aposta voce quer fazer hoje?",
    askSpecific: "Legal! Em que especificamente?",
    searchingMarkets: "Buscando mercados...",
    scanningWhales: "Agent Radar escaneando holders...",
    foundMarkets: "Encontrei {n} mercado{s}. Qual te interessa?",
    noMarkets: "Nao encontrei mercados para isso. Tenta outra coisa?",
    whaleResult: "{n} baleia{s}, {pct}% {dir}.",
    radarResult: "Escaneei {scanned} de {total} holders. {agentPct}% atividade de agentes detectada.",
    noWhales: "Sem baleias rastreadas neste mercado. Voce ainda pode apostar.",
    howMuch: "Quanto quer apostar?",
    placingBet: "Apostando {amount} MON em {side}...",
    betConfirmed: "Aposta confirmada na Polymarket.",
    connectWallet: "Conecte sua wallet para ver seu portfolio.",
    loadingPortfolio: "Carregando portfolio...",
    hereIsPortfolio: "Aqui esta seu portfolio.",
    analyzeFirst: "Escolha um mercado primeiro, depois te ajudo a apostar.",
    helpText: "Voce pode buscar mercados, analisar baleias e apostar. Escreva sobre o que quer apostar!",
    wantAnalysis: "Quer minha analise antes de apostar?",
    analyzeBtn: "ANALISAR COM IA",
    detectAgents: "DETECTAR AGENTES",
    explainWithAI: "EXPLICAR COM IA",
    explaining: "IA analisando dados do mercado...",
    betNow: "APOSTAR",
    skipAnalysis: "PULAR, APOSTAR JA",
    connectForAnalysis: "Conecte sua wallet para detectar agentes.",
    successProb: "Probabilidade de Sucesso",
    recommendedSide: "Recomendado",
    smartMoneyBet: "SMART MONEY",
    noEdge: "Sem vantagem detectada. Aposte por sua conta e risco.",
    highConfidence: "Alta confianca",
    mediumConfidence: "Confianca media",
    lowConfidence: "Baixa confianca",
    howMuchInvest: "Quanto voce quer investir?",
    investPlaceholder: "Valor em USD",
    calculateProb: "CALCULAR PROBABILIDADE",
    marketImpactLabel: "Seu tamanho",
    yourSizeMovesMarket: "Sua aposta e {pct}% do volume do mercado. Isso movera o preco contra voce.",
    sizeOk: "Sua aposta tem impacto minimo no mercado.",
    manualAmount: "Ou escolha valor:",
    monOnMonad: "MON na Monad",
    onboardName: "Nomeie seu assistente",
    onboardNameSub: "E assim que voce vai ativa-lo. Por voz, pelos oculos, ou digitando.",
    onboardCategories: "Em que voce aposta?",
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
    failedBet: "Erro ao apostar. Tente novamente.",
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
      {markets.map(market => (
        <button key={market.conditionId} onClick={() => onSelect(market)}
          className="w-full text-left flex items-center justify-between px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-colors active:scale-[0.99]">
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
      ))}
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
          BET YES
        </button>
        <button onClick={() => onPickSide('No', slug, 'skip')}
          className="flex-1 py-2 text-[12px] font-semibold border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-colors active:scale-[0.97]">
          BET NO
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

function DeepAnalysisAttachment({ analysis, market, lang, onExplain, onSkipToBet, onContext }: {
  analysis: DeepAnalysisResult; market: MarketInfo; lang: Lang
  onExplain: (analysis: DeepAnalysisResult, market: MarketInfo) => void
  onSkipToBet: (market: MarketInfo, analysis: DeepAnalysisResult) => void
  onContext?: (title: string, slug: string) => void
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
              BET YES
            </button>
            <button onClick={() => onManualBet('No', market.slug, signalHash, market.conditionId)}
              className="flex-1 py-2 text-[12px] font-semibold border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-colors active:scale-[0.97]">
              BET NO
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
        <span className="text-[11px] font-bold font-mono text-emerald-500 tracking-[1px]">BET PLACED</span>
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

function BetTimelineAttachment({ steps, side, amount, market }: {
  steps: BetTimelineStep[]; side: string; amount: string; market: string
}) {
  const isYes = side === 'Yes'
  const borderColor = isYes ? 'border-emerald-500/20' : 'border-red-400/20'
  const bgColor = isYes ? 'bg-emerald-500/[0.03]' : 'bg-red-400/[0.03]'
  const accentColor = isYes ? 'text-emerald-500' : 'text-red-400'

  return (
    <div className={`mt-2 border ${borderColor} ${bgColor} px-4 py-3`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-[11px] font-bold font-mono ${accentColor} tracking-[1px]`}>
          {side.toUpperCase()} ${amount}
        </span>
        <span className="text-[9px] font-mono text-white/20">{market}</span>
      </div>
      <div className="space-y-0">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1
          const dotColor = step.status === 'confirmed' ? 'bg-emerald-500'
            : step.status === 'processing' ? 'bg-amber-400 animate-pulse'
            : step.status === 'error' ? 'bg-red-500'
            : 'bg-white/20'
          const textColor = step.status === 'confirmed' ? 'text-white/60'
            : step.status === 'processing' ? 'text-amber-400'
            : step.status === 'error' ? 'text-red-400'
            : 'text-white/20'

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

function BalanceViewAttachment({ positions, totalValue, totalPnl, onSell, onHistory, lang }: {
  positions: BalancePosition[]; totalValue: number; totalPnl: number
  onSell: (pos: BalancePosition) => void; onHistory: () => void; lang: Lang
}) {
  return (
    <div className="mt-2 border border-white/[0.10] bg-white/[0.04]">
      <div className="px-4 py-2 border-b border-white/[0.06] flex items-center justify-between">
        <span className="text-[9px] font-bold font-mono text-white/30 tracking-[1.5px]">{t(lang, 'yourPositions')}</span>
        <button onClick={onHistory}
          className="text-[9px] font-bold font-mono text-white/30 tracking-[1px] hover:text-white/50 transition-colors">
          {t(lang, 'viewHistory')}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-px bg-white/[0.06]">
        <div className="bg-black px-4 py-3">
          <div className="text-[10px] text-white/30 mb-0.5">Value</div>
          <div className="text-[16px] font-bold font-mono text-white">${totalValue.toFixed(2)}</div>
        </div>
        <div className="bg-black px-4 py-3">
          <div className="text-[10px] text-white/30 mb-0.5">P&L</div>
          <div className={`text-[16px] font-bold font-mono ${totalPnl >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
            {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
          </div>
        </div>
      </div>
      {positions.length > 0 ? (
        <div className="divide-y divide-white/[0.06]">
          {positions.map(pos => (
            <div key={pos.id} className="px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-white/70 truncate pr-2">{pos.marketSlug}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] font-bold font-mono ${pos.side === 'Yes' ? 'text-emerald-500' : 'text-red-400'}`}>
                      {pos.side.toUpperCase()}
                    </span>
                    <span className="text-[10px] font-mono text-white/20">
                      {pos.shares.toFixed(1)} @ ${pos.avgPrice.toFixed(2)} → ${pos.currentPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[12px] font-mono font-semibold ${pos.pnl >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                    {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}
                  </span>
                  <button onClick={() => onSell(pos)}
                    className="px-3 py-1 text-[10px] font-bold font-mono tracking-[1px] border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors">
                    {t(lang, 'sell')}
                  </button>
                </div>
              </div>
            </div>
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
  return (
    <div className="mt-2 border border-white/[0.10] bg-white/[0.04]">
      <div className="px-4 py-2 border-b border-white/[0.06]">
        <span className="text-[9px] font-bold font-mono text-white/30 tracking-[1.5px]">PORTFOLIO</span>
      </div>
      <div className="grid grid-cols-2 gap-px bg-white/[0.06]">
        {[
          { label: 'Value', value: `$${data.portfolioValue.toFixed(2)}` },
          { label: 'P&L', value: `${data.stats.totalPnl >= 0 ? '+' : ''}$${data.stats.totalPnl.toFixed(2)}`, color: data.stats.totalPnl >= 0 ? 'text-emerald-500' : 'text-red-400' },
          { label: 'Win Rate', value: `${data.stats.winRate}%` },
          { label: 'Positions', value: String(data.stats.openPositions) },
        ].map(s => (
          <div key={s.label} className="bg-black px-4 py-3">
            <div className="text-[10px] text-white/30 mb-0.5">{s.label}</div>
            <div className={`text-[16px] font-bold font-mono ${s.color || 'text-white'}`}>{s.value}</div>
          </div>
        ))}
      </div>
      {data.positions.length > 0 && (
        <div className="px-4 py-2 border-t border-white/[0.06]">
          {data.positions.slice(0, 5).map(pos => (
            <div key={`${pos.conditionId}-${pos.outcome}`} className="flex items-center justify-between py-1.5">
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-white/70 truncate pr-4">{pos.title}</div>
                <span className={`text-[10px] font-bold font-mono ${pos.outcome === 'Yes' ? 'text-emerald-500' : 'text-red-400'}`}>{pos.outcome}</span>
              </div>
              <span className={`text-[12px] font-mono font-semibold ${pos.pnl >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                {pos.pnl >= 0 ? '+' : ''}${Math.abs(pos.pnl).toFixed(2)}
              </span>
            </div>
          ))}
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
                            <span className="text-[10px] font-mono text-white/30">{entry.bet_count} bets</span>
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

function ConversationsDrawer({ address, lang, conversations, currentConversationId, onSelect, onNew, onDelete, onRefresh }: {
  address: string | null
  lang: Lang
  conversations: ConversationInfo[]
  currentConversationId: string | null
  onSelect: (conv: ConversationInfo) => void
  onNew: () => void
  onDelete: (id: string) => void
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
            <button
              onClick={() => { onNew(); setOpen(false) }}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono hover:bg-emerald-500/10 transition-colors"
            >
              <Plus className="w-3 h-3" />
              {lang === 'es' ? 'NUEVA' : 'NEW'}
            </button>
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
  const { address, isConnected, connect, disconnect, signer } = useWeb3()

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
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const join = params.get('join')
    if (join) {
      setAutoJoinCode(join)
      setInlineJoinCode(join.toUpperCase())
      sessionStorage.setItem('bw_join_code', join.toUpperCase())
      window.history.replaceState({}, '', window.location.pathname)
    } else {
      // Recover from sessionStorage (survives onboarding + page transitions)
      const saved = sessionStorage.getItem('bw_join_code')
      if (saved) {
        setAutoJoinCode(saved)
        setInlineJoinCode(saved)
      }
    }
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

  const handleBetPrompt = useCallback((side: 'Yes' | 'No', slug: string, signalHash: string, conditionId?: string) => {
    addMessage('user', `${side} on this market`)
    addMessage('assistant', t(lang, 'howMuch'), { type: 'betPrompt', side, slug, signalHash, conditionId: conditionId || '' })
  }, [addMessage, lang])

  const handleBet = useCallback(async (side: 'Yes' | 'No', slug: string, signalHash: string, amount: string, conditionId?: string) => {
    addMessage('user', `$${amount} on ${side}`)

    // Require wallet connection
    if (!isConnected || !signer) {
      addMessage('assistant', '', { type: 'error', text: lang === 'es' ? 'Conecta tu wallet para apostar.' : 'Connect your wallet to bet.' })
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

    // Initialize timeline
    const steps: BetTimelineStep[] = [
      { label: 'MON PAYMENT', chain: 'Monad', status: 'pending' },
      { label: 'CLOB EXECUTION', chain: 'Polygon', status: 'pending' },
      { label: t(lang, 'positionOpen'), chain: 'Confirmed', status: 'pending' },
    ]
    const timelineId = addMessage('assistant', '', { type: 'betTimeline', steps: [...steps], side, amount, market: slug })
    const updateTimeline = (newSteps: BetTimelineStep[]) => {
      updateMessage(timelineId, { type: 'betTimeline', steps: [...newSteps], side, amount, market: slug })
    }

    // Step 1: MON Payment
    steps[0].status = 'processing'
    steps[0].detail = lang === 'es' ? 'Obteniendo precio MON...' : 'Fetching MON price...'
    updateTimeline(steps)

    let monadTxHash: string | null = null
    let monPriceUSD = 0.021

    try {
      const priceRes = await fetch('/api/mon-price')
      if (priceRes.ok) {
        const priceData = await priceRes.json()
        monPriceUSD = priceData.price || 0.021
      }
    } catch { /* use fallback */ }

    const monAmount = (parseFloat(amount) / monPriceUSD * 1.01).toFixed(4)
    steps[0].detail = `${monAmount} MON ($${amount} USD)`
    updateTimeline(steps)

    try {
      const result = await executeBet(signer, {
        marketSlug: slug, side, amountUSD: parseFloat(amount), monPriceUSD, signalHash,
      })
      monadTxHash = result.txHash
      steps[0].status = 'confirmed'
      steps[0].txHash = result.txHash
      steps[0].explorerUrl = result.explorerUrl
      steps[0].detail = `${result.monAmount} MON sent`
      updateTimeline(steps)
    } catch (err) {
      steps[0].status = 'error'
      steps[0].errorMsg = err instanceof Error ? err.message : t(lang, 'txRejected')
      steps[0].detail = undefined
      updateTimeline(steps)
      return
    }

    // Step 2: CLOB Execution
    steps[1].status = 'processing'
    steps[1].detail = lang === 'es' ? 'Ejecutando orden...' : 'Executing order...'
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
          steps[1].status = 'error'
          steps[1].errorMsg = data.error || 'CLOB execution failed'
          if (data.orphanedPayment) {
            steps[1].errorMsg += lang === 'es'
              ? ' (Tu pago MON fue registrado. Contacta soporte para reembolso.)'
              : ' (Your MON payment was recorded. Contact support for refund.)'
          }
          steps[1].detail = undefined
          updateTimeline(steps)
          return
        }
      } catch {
        steps[1].status = 'error'
        steps[1].errorMsg = t(lang, 'networkError')
        updateTimeline(steps)
        return
      }
    } else {
      steps[1].status = 'error'
      steps[1].errorMsg = 'No market conditionId'
      updateTimeline(steps)
      return
    }

    steps[1].status = 'confirmed'
    steps[1].txHash = clobResult.txHash
    steps[1].explorerUrl = clobResult.explorerUrl
    steps[1].detail = `$${parseFloat(amount).toFixed(2)} USDC → ${clobResult.shares.toFixed(1)} shares`
    updateTimeline(steps)

    // Step 3: Record position
    steps[2].status = 'processing'
    updateTimeline(steps)

    await fetch('/api/bet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        marketSlug: slug, side, amount, walletAddress: address || 'demo',
        txHash: clobResult.txHash, signalHash, source: clobResult.source, monadTxHash,
        conditionId: resolvedConditionId, shares: clobResult.shares, price: clobResult.price,
        tokenId: clobResult.tokenId, tickSize: clobResult.tickSize, negRisk: clobResult.negRisk,
      }),
    }).catch(() => {})

    steps[2].status = 'confirmed'
    steps[2].detail = `${side.toUpperCase()} @ $${clobResult.price.toFixed(2)} · ${clobResult.shares.toFixed(1)} shares`
    updateTimeline(steps)

    // Add a text-based bet result message for conversation persistence
    const txShort = clobResult.txHash ? `${clobResult.txHash.slice(0, 10)}...${clobResult.txHash.slice(-6)}` : ''
    addMessage('assistant', `Bet Confirmed: $${amount} on ${side} — ${slug}${txShort ? `\nTx: ${txShort}` : ''}`)
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
        if (mc.status === 'sent') {
          steps[1].status = 'confirmed'
          steps[1].detail = `${mc.monAmount.toFixed(2)} MON sent`
          steps[1].txHash = mc.txHash
          steps[1].explorerUrl = mc.explorerUrl
        } else if (mc.status === 'pending') {
          steps[1].status = 'processing'
          steps[1].detail = lang === 'es' ? 'Cashout en cola (procesamiento manual)' : 'Cashout queued (manual processing)'
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
    addMessage('user', text)
    setInputText('')
    setIsProcessing(true)
    try { await handleUserMessage(text) } finally { setIsProcessing(false) }
  }, [inputText, isProcessing, addMessage, handleUserMessage])

  const handleMarketSelect = useCallback((market: MarketInfo) => {
    if (isProcessing) return
    addMessage('user', market.question)
    addMessage('assistant', t(lang, 'wantAnalysis'), { type: 'marketPreview', market })
  }, [isProcessing, addMessage, lang])

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

  // Step 3 -> Step 3.5: Ask how much to invest
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
            <div key={msg.id}>
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
                      lang={lang} onExplain={handleExplainWithAI} onSkipToBet={handleAskAmount} onContext={fetchContext} />
                  )}
                  {msg.attachment.type === 'aiExplanation' && (
                    <AIExplanationAttachment lines={msg.attachment.lines} market={msg.attachment.market}
                      analysis={msg.attachment.analysis} lang={lang} onNext={handleAskAmount} />
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
                      amount={msg.attachment.amount} market={msg.attachment.market} />
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
