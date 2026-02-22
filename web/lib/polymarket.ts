// Polymarket API utilities (server-side only)
// Ported from defi-mexico-hub/src/services/polymarket.service.ts

import { GAMMA_API, DATA_API } from './constants'

export interface MarketInfo {
  conditionId: string
  question: string
  slug: string
  volume: number
  yesPrice: number
  noPrice: number
  image: string
  endDate: string
  outcomes: string[]
}

export interface EventInfo {
  title: string
  slug: string
  image: string
  volume: number
  liquidity: number
  endDate: string
  markets: MarketInfo[]
}

export interface MarketHolder {
  address: string
  pseudonym: string
  amount: number
  outcome: 'Yes' | 'No'
}

function parseMarket(m: Record<string, unknown>): MarketInfo {
  const prices = JSON.parse((m.outcomePrices as string) || '[]')
  const outcomes = JSON.parse((m.outcomes as string) || '["Yes","No"]')
  return {
    conditionId: (m.conditionId as string) || '',
    question: (m.question as string) || '',
    slug: (m.slug as string) || '',
    volume: parseFloat(m.volume as string) || 0,
    yesPrice: parseFloat(prices[0]) || 0,
    noPrice: parseFloat(prices[1]) || 0,
    image: (m.image as string) || '',
    endDate: (m.endDate as string) || '',
    outcomes,
  }
}

// Sports league keyword -> Gamma API tag_slug mapping
// Built from https://gamma-api.polymarket.com/sports
const LEAGUE_MAP: Record<string, string> = {
  // Soccer / Football
  'liga mx': 'mex', 'ligamx': 'mex', 'liga mexicana': 'mex', 'futbol mexicano': 'mex', 'mexican soccer': 'mex',
  'premier league': 'epl', 'epl': 'epl', 'english football': 'epl',
  'la liga': 'lal', 'laliga': 'lal', 'spanish football': 'lal', 'liga espanola': 'lal',
  'bundesliga': 'bun', 'german football': 'bun',
  'serie a': 'itc', 'italian football': 'itc',
  'ligue 1': 'fl1', 'french football': 'fl1',
  'champions league': 'ucl', 'ucl': 'ucl',
  'europa league': 'uel', 'uel': 'uel',
  'mls': 'mls', 'major league soccer': 'mls',
  'copa libertadores': 'lib', 'libertadores': 'lib',
  'copa sudamericana': 'sud', 'sudamericana': 'sud',
  'liga argentina': 'arg', 'futbol argentino': 'arg', 'argentine football': 'arg',
  'brasileirao': 'bra', 'brazilian football': 'bra', 'serie a brazil': 'bra',
  'eredivisie': 'ere', 'dutch football': 'ere',
  'liga portugal': 'por', 'portuguese football': 'por',
  'j league': 'jap', 'j-league': 'jap', 'japanese football': 'jap',
  'k league': 'kor', 'korean football': 'kor',
  'liga colombiana': 'col', 'colombian football': 'col',
  'super lig': 'tur', 'turkish football': 'tur',
  // US Sports
  'nba': 'nba', 'basketball': 'nba',
  'nfl': 'nfl', 'football americano': 'nfl', 'american football': 'nfl',
  'mlb': 'mlb', 'baseball': 'mlb', 'beisbol': 'mlb',
  'nhl': 'nhl', 'hockey': 'nhl',
  'ncaab': 'ncaab', 'march madness': 'ncaab', 'college basketball': 'ncaab',
  'cfb': 'cfb', 'college football': 'cfb',
  'wnba': 'wnba',
  // Combat
  'ufc': 'ufc', 'mma': 'ufc',
  // Motorsport
  'f1': 'f1', 'formula 1': 'f1', 'formula one': 'f1', 'formula uno': 'f1',
  // Esports
  'league of legends': 'lol', 'lol': 'lol',
  'dota': 'dota2', 'dota 2': 'dota2',
  'valorant': 'val',
  'cs2': 'cs2', 'csgo': 'cs2', 'counter strike': 'cs2',
  'mobile legends': 'mlbb', 'mlbb': 'mlbb',
  'overwatch': 'ow',
  'rocket league': 'rl',
  // Tennis
  'atp': 'atp', 'tennis': 'atp',
  'wta': 'wta',
  // Cricket
  'ipl': 'ipl', 'cricket': 'ipl', 't20': 't20',
  // Rugby
  'rugby': 'ruprem',
  // Olympics
  'olympics': 'mwoh', 'olimpiadas': 'mwoh',
}

// Sports team/club -> { league, searchTerms } mapping
// searchTerms: all variants that might appear in Polymarket event titles
interface TeamEntry { league: string; search: string[] }
const TEAM_ENTRIES: Record<string, TeamEntry> = {
  // Liga MX teams (Polymarket uses official names like "CF América", "CD Guadalajara")
  'pumas':        { league: 'mex', search: ['pumas', 'unam'] },
  'unam':         { league: 'mex', search: ['pumas', 'unam'] },
  'tigres':       { league: 'mex', search: ['tigres', 'uanl'] },
  'america':      { league: 'mex', search: ['america', 'américa'] },
  'aguilas':      { league: 'mex', search: ['america', 'américa'] },
  'cruz azul':    { league: 'mex', search: ['cruz azul'] },
  'chivas':       { league: 'mex', search: ['guadalajara', 'chivas'] },
  'guadalajara':  { league: 'mex', search: ['guadalajara'] },
  'monterrey':    { league: 'mex', search: ['monterrey'] },
  'rayados':      { league: 'mex', search: ['monterrey'] },
  'santos':       { league: 'mex', search: ['santos'] },
  'santos laguna':{ league: 'mex', search: ['santos laguna', 'santos'] },
  'toluca':       { league: 'mex', search: ['toluca'] },
  'leon':         { league: 'mex', search: ['leon', 'león'] },
  'pachuca':      { league: 'mex', search: ['pachuca'] },
  'atlas':        { league: 'mex', search: ['atlas'] },
  'necaxa':       { league: 'mex', search: ['necaxa'] },
  'puebla':       { league: 'mex', search: ['puebla'] },
  'tijuana':      { league: 'mex', search: ['tijuana'] },
  'xolos':        { league: 'mex', search: ['tijuana'] },
  'mazatlan':     { league: 'mex', search: ['mazatlan', 'mazatlán'] },
  'juarez':       { league: 'mex', search: ['juarez', 'juárez'] },
  'queretaro':    { league: 'mex', search: ['queretaro', 'querétaro'] },
  'san luis':     { league: 'mex', search: ['san luis'] },
  // EPL teams
  'arsenal':      { league: 'epl', search: ['arsenal'] },
  'chelsea':      { league: 'epl', search: ['chelsea'] },
  'liverpool':    { league: 'epl', search: ['liverpool'] },
  'man city':     { league: 'epl', search: ['manchester city', 'man city'] },
  'manchester city': { league: 'epl', search: ['manchester city'] },
  'man united':   { league: 'epl', search: ['manchester united', 'man united'] },
  'manchester united': { league: 'epl', search: ['manchester united'] },
  'tottenham':    { league: 'epl', search: ['tottenham', 'spurs'] },
  'spurs':        { league: 'epl', search: ['tottenham', 'spurs'] },
  'newcastle':    { league: 'epl', search: ['newcastle'] },
  // La Liga teams
  'real madrid':  { league: 'lal', search: ['real madrid'] },
  'barcelona':    { league: 'lal', search: ['barcelona'] },
  'barca':        { league: 'lal', search: ['barcelona'] },
  'atletico madrid': { league: 'lal', search: ['atletico madrid', 'atlético'] },
  'sevilla':      { league: 'lal', search: ['sevilla'] },
  // NBA teams
  'lakers':       { league: 'nba', search: ['lakers', 'los angeles lakers'] },
  'celtics':      { league: 'nba', search: ['celtics', 'boston'] },
  'warriors':     { league: 'nba', search: ['warriors', 'golden state'] },
  'knicks':       { league: 'nba', search: ['knicks', 'new york knicks'] },
  'bulls':        { league: 'nba', search: ['bulls', 'chicago'] },
  'heat':         { league: 'nba', search: ['heat', 'miami'] },
  'mavs':         { league: 'nba', search: ['mavericks', 'dallas'] },
  'mavericks':    { league: 'nba', search: ['mavericks', 'dallas'] },
  'thunder':      { league: 'nba', search: ['thunder', 'oklahoma'] },
  'nuggets':      { league: 'nba', search: ['nuggets', 'denver'] },
  // NFL teams
  'chiefs':       { league: 'nfl', search: ['chiefs', 'kansas city'] },
  'eagles':       { league: 'nfl', search: ['eagles', 'philadelphia'] },
  'cowboys':      { league: 'nfl', search: ['cowboys', 'dallas cowboys'] },
  'bills':        { league: 'nfl', search: ['bills', 'buffalo'] },
  '49ers':        { league: 'nfl', search: ['49ers', 'san francisco'] },
  'packers':      { league: 'nfl', search: ['packers', 'green bay'] },
  // UFC fighters
  'mcgregor':     { league: 'ufc', search: ['mcgregor'] },
  'adesanya':     { league: 'ufc', search: ['adesanya'] },
}

function detectLeague(query: string): string | null {
  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  // Check longest matches first to avoid partial matches
  const sorted = Object.keys(LEAGUE_MAP).sort((a, b) => b.length - a.length)
  for (const key of sorted) {
    if (q.includes(key)) return LEAGUE_MAP[key]
  }
  return null
}

function detectTeamLeague(query: string): { league: string; searchTerms: string[] } | null {
  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  const sorted = Object.keys(TEAM_ENTRIES).sort((a, b) => b.length - a.length)
  for (const key of sorted) {
    if (q.includes(key)) {
      const entry = TEAM_ENTRIES[key]
      return { league: entry.league, searchTerms: entry.search }
    }
  }
  return null
}

function parseEvent(event: Record<string, unknown>): EventInfo {
  const rawMarkets = (event.markets as Record<string, unknown>[]) || []
  return {
    title: (event.title as string) || '',
    slug: (event.slug as string) || '',
    image: (event.image as string) || '',
    volume: parseFloat(event.volume as string) || 0,
    liquidity: parseFloat(event.liquidity as string) || 0,
    endDate: (event.endDate as string) || '',
    markets: rawMarkets.map(parseMarket),
  }
}

async function fetchEvents(params: URLSearchParams): Promise<EventInfo[]> {
  const res = await fetch(`${GAMMA_API}/events?${params}`, {
    next: { revalidate: 60 },
  })
  if (!res.ok) return []
  const data = await res.json()
  if (!Array.isArray(data)) return []
  return data.map(parseEvent)
}

// Query expansion: short/ambiguous queries -> better search terms
// This helps when users type abbreviations or colloquial terms
const QUERY_EXPAND: Record<string, string[]> = {
  'btc': ['bitcoin'], 'eth': ['ethereum'], 'sol': ['solana'],
  'trump': ['trump'], 'biden': ['biden'], 'elon': ['elon', 'musk', 'tesla'],
  'ai': ['artificial intelligence', 'openai', 'chatgpt'],
  'war': ['war', 'military', 'strike', 'invasion'],
  'election': ['election', 'president', 'vote'],
  'eleccion': ['election', 'president'], 'elecciones': ['election'],
  'mexico': ['mexico', 'mexican'], 'usa': ['united states', 'america'],
}

// Score how well an event title matches a query (0 = no match)
function scoreMatch(title: string, query: string): number {
  const t = title.toLowerCase()
  const q = query.toLowerCase().trim()
  const words = q.split(/\s+/).filter(w => w.length > 1)

  // Exact query in title = best match
  if (t.includes(q)) return 100

  // All words present
  const allPresent = words.every(w => t.includes(w))
  if (allPresent) return 80

  // Count matching words
  const matchCount = words.filter(w => t.includes(w)).length
  if (matchCount === 0) return 0
  return (matchCount / words.length) * 60
}

export async function searchMarkets(query: string, limit = 10): Promise<EventInfo[]> {
  if (!query) {
    // Trending: no query
    return fetchEvents(new URLSearchParams({
      _limit: String(limit), active: 'true', closed: 'false',
      order: 'volume24hr', ascending: 'false',
    }))
  }

  // 1. Check if query maps to a sports league ("liga mx", "nba", "f1")
  const leagueSlug = detectLeague(query)
  if (leagueSlug) {
    return fetchEvents(new URLSearchParams({
      _limit: String(limit), active: 'true', closed: 'false',
      tag_slug: leagueSlug, order: 'startDate', ascending: 'true',
    }))
  }

  // 2. Check if query matches a team name ("Pumas", "Chivas", "Lakers")
  const teamMatch = detectTeamLeague(query)
  if (teamMatch) {
    const allEvents = await fetchEvents(new URLSearchParams({
      _limit: '50', active: 'true', closed: 'false',
      tag_slug: teamMatch.league, order: 'startDate', ascending: 'true',
    }))
    const filtered = allEvents.filter(e => {
      const titleLower = e.title.toLowerCase()
      return teamMatch.searchTerms.some(term => titleLower.includes(term))
    })
    if (filtered.length > 0) return filtered.slice(0, limit)
    return allEvents.slice(0, limit)
  }

  // 3. Smart general search: fetch large pool, score & filter locally
  //    (Gamma API title search is unreliable, so we filter ourselves)
  const qNorm = query.toLowerCase().trim()
  const expanded = QUERY_EXPAND[qNorm]
  const searchTerms = expanded ? [query, ...expanded] : [query]

  // Fetch a broad pool of active events
  const pool = await fetchEvents(new URLSearchParams({
    _limit: '200', active: 'true', closed: 'false',
    order: 'volume24hr', ascending: 'false',
  }))

  // Score each event against all search terms, take best score
  const scored = pool.map(event => {
    const best = Math.max(...searchTerms.map(term => scoreMatch(event.title, term)))
    // Also check market questions inside the event
    const marketScore = Math.max(0, ...event.markets.map(m =>
      Math.max(...searchTerms.map(term => scoreMatch(m.question, term)))
    ))
    return { event, score: Math.max(best, marketScore) }
  })

  const matched = scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score || b.event.volume - a.event.volume)
    .map(s => s.event)
    .slice(0, limit)

  // If local filtering found results, return them
  if (matched.length > 0) return matched

  // 4. Last resort: try Gamma title search anyway (might work for longer queries)
  return fetchEvents(new URLSearchParams({
    _limit: String(limit), active: 'true', closed: 'false',
    title: query, order: 'volume24hr', ascending: 'false',
  }))
}

export async function getMarketBySlug(slug: string): Promise<MarketInfo | null> {
  // Try as market slug first
  const res = await fetch(`${GAMMA_API}/markets?slug=${slug}&limit=1`)
  if (res.ok) {
    const data = await res.json()
    if (Array.isArray(data) && data.length > 0) {
      return parseMarket(data[0])
    }
  }

  // Try as event slug
  const eventRes = await fetch(`${GAMMA_API}/events?slug=${slug}&limit=1`)
  if (eventRes.ok) {
    const eventData = await eventRes.json()
    if (Array.isArray(eventData) && eventData.length > 0) {
      const markets = eventData[0].markets || []
      if (markets.length > 0) return parseMarket(markets[0])
    }
  }

  return null
}

export async function getMarketHolders(conditionId: string): Promise<MarketHolder[]> {
  const res = await fetch(`${DATA_API}/holders?market=${conditionId}&limit=100`)
  if (!res.ok) return []
  const data = await res.json()
  if (!Array.isArray(data)) return []

  const holders: MarketHolder[] = []
  for (const group of data) {
    const outcomeIndex = group.holders?.[0]?.outcomeIndex ?? 0
    const outcome: 'Yes' | 'No' = outcomeIndex === 0 ? 'Yes' : 'No'
    for (const h of group.holders || []) {
      holders.push({
        address: h.proxyWallet || '',
        pseudonym: h.pseudonym || h.name || '',
        amount: parseFloat(h.amount) || 0,
        outcome,
      })
    }
  }

  holders.sort((a, b) => b.amount - a.amount)
  return holders
}

export async function getTrendingMarkets(limit = 8): Promise<EventInfo[]> {
  return searchMarkets('', limit)
}

// User-specific Polymarket data (Data API)

export interface UserPosition {
  conditionId: string
  title: string
  slug: string
  eventSlug: string
  outcome: string
  outcomeIndex: number
  size: number
  avgPrice: number
  currentPrice: number
  pnl: number
  pnlPct: number
}

export interface UserActivity {
  timestamp: number
  type: string // TRADE, SPLIT, MERGE, REDEEM, REWARD
  title: string
  slug: string
  outcome: string
  side: string // BUY, SELL
  size: number
  usdcSize: number
  price: number
  transactionHash: string
}

export interface UserProfile {
  name: string
  pseudonym: string
  profileImage: string
  bio: string
}

export interface UserPortfolioValue {
  totalValue: number
}

export async function getUserPositions(address: string): Promise<UserPosition[]> {
  const res = await fetch(`${DATA_API}/positions?user=${address}&sizeThreshold=0.1`)
  if (!res.ok) return []
  const data = await res.json()
  if (!Array.isArray(data)) return []

  return data.map((p: Record<string, unknown>) => {
    const size = parseFloat(p.size as string) || 0
    const avgPrice = parseFloat(p.avgPrice as string) || 0
    const currentPrice = parseFloat(p.curPrice as string) || parseFloat(p.currentPrice as string) || 0
    const pnl = size * (currentPrice - avgPrice)
    const pnlPct = avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0

    return {
      conditionId: (p.conditionId as string) || (p.asset as string) || '',
      title: (p.title as string) || '',
      slug: (p.slug as string) || '',
      eventSlug: (p.eventSlug as string) || '',
      outcome: (p.outcome as string) || '',
      outcomeIndex: (p.outcomeIndex as number) || 0,
      size,
      avgPrice,
      currentPrice,
      pnl: Math.round(pnl * 100) / 100,
      pnlPct: Math.round(pnlPct * 10) / 10,
    }
  })
}

export async function getUserActivity(
  address: string,
  limit = 50,
  type?: string
): Promise<UserActivity[]> {
  const params = new URLSearchParams({
    user: address,
    limit: String(limit),
    sortBy: 'TIMESTAMP',
    sortDirection: 'DESC',
  })
  if (type) params.set('type', type)

  const res = await fetch(`${DATA_API}/activity?${params}`)
  if (!res.ok) return []
  const data = await res.json()
  if (!Array.isArray(data)) return []

  return data.map((a: Record<string, unknown>) => ({
    timestamp: (a.timestamp as number) || 0,
    type: (a.type as string) || '',
    title: (a.title as string) || '',
    slug: (a.slug as string) || '',
    outcome: (a.outcome as string) || '',
    side: (a.side as string) || '',
    size: parseFloat(a.size as string) || 0,
    usdcSize: parseFloat(a.usdcSize as string) || 0,
    price: parseFloat(a.price as string) || 0,
    transactionHash: (a.transactionHash as string) || '',
  }))
}

export async function getUserPortfolioValue(address: string): Promise<UserPortfolioValue> {
  const res = await fetch(`${DATA_API}/value?user=${address}`)
  if (!res.ok) return { totalValue: 0 }
  const data = await res.json()
  return {
    totalValue: parseFloat(data?.value as string) || parseFloat(data?.totalValue as string) || 0,
  }
}

export async function getUserProfile(address: string): Promise<UserProfile | null> {
  const res = await fetch(`${GAMMA_API}/public-profile?address=${address}`)
  if (!res.ok) return null
  const data = await res.json()
  return {
    name: (data.name as string) || '',
    pseudonym: (data.pseudonym as string) || '',
    profileImage: (data.profileImage as string) || '',
    bio: (data.bio as string) || '',
  }
}
