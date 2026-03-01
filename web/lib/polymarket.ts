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
  // NBA teams (all 30)
  'lakers':       { league: 'nba', search: ['lakers', 'los angeles lakers'] },
  'celtics':      { league: 'nba', search: ['celtics', 'boston'] },
  'boston':        { league: 'nba', search: ['celtics', 'boston'] },
  'warriors':     { league: 'nba', search: ['warriors', 'golden state'] },
  'knicks':       { league: 'nba', search: ['knicks', 'new york knicks'] },
  'bulls':        { league: 'nba', search: ['bulls', 'chicago'] },
  'heat':         { league: 'nba', search: ['heat', 'miami'] },
  'mavs':         { league: 'nba', search: ['mavericks', 'dallas mavericks'] },
  'mavericks':    { league: 'nba', search: ['mavericks', 'dallas mavericks'] },
  'thunder':      { league: 'nba', search: ['thunder', 'oklahoma'] },
  'nuggets':      { league: 'nba', search: ['nuggets', 'denver'] },
  'suns':         { league: 'nba', search: ['suns', 'phoenix'] },
  'phoenix':      { league: 'nba', search: ['suns', 'phoenix'] },
  'bucks':        { league: 'nba', search: ['bucks', 'milwaukee'] },
  'sixers':       { league: 'nba', search: ['76ers', 'sixers', 'philadelphia'] },
  '76ers':        { league: 'nba', search: ['76ers', 'sixers', 'philadelphia'] },
  'raptors':      { league: 'nba', search: ['raptors', 'toronto'] },
  'nets':         { league: 'nba', search: ['nets', 'brooklyn'] },
  'hawks':        { league: 'nba', search: ['hawks', 'atlanta'] },
  'cavaliers':    { league: 'nba', search: ['cavaliers', 'cavs', 'cleveland'] },
  'cavs':         { league: 'nba', search: ['cavaliers', 'cavs', 'cleveland'] },
  'pacers':       { league: 'nba', search: ['pacers', 'indiana'] },
  'magic':        { league: 'nba', search: ['magic', 'orlando'] },
  'wizards':      { league: 'nba', search: ['wizards', 'washington'] },
  'hornets':      { league: 'nba', search: ['hornets', 'charlotte'] },
  'pistons':      { league: 'nba', search: ['pistons', 'detroit'] },
  'timberwolves': { league: 'nba', search: ['timberwolves', 'wolves', 'minnesota'] },
  'wolves':       { league: 'nba', search: ['timberwolves', 'wolves', 'minnesota'] },
  'pelicans':     { league: 'nba', search: ['pelicans', 'new orleans'] },
  'grizzlies':    { league: 'nba', search: ['grizzlies', 'memphis'] },
  'san antonio':  { league: 'nba', search: ['spurs', 'san antonio'] },
  'san antonio spurs': { league: 'nba', search: ['spurs', 'san antonio'] },
  'rockets':      { league: 'nba', search: ['rockets', 'houston'] },
  'clippers':     { league: 'nba', search: ['clippers', 'la clippers'] },
  'kings':        { league: 'nba', search: ['kings', 'sacramento'] },
  'blazers':      { league: 'nba', search: ['blazers', 'trail blazers', 'portland'] },
  'jazz':         { league: 'nba', search: ['jazz', 'utah'] },
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
    // Word boundary match to prevent false positives
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(?:^|\\s|\\b)${escaped}(?:$|\\s|\\b)`, 'i')
    if (regex.test(q)) return LEAGUE_MAP[key]
  }
  return null
}

function detectTeamLeague(query: string): { league: string; searchTerms: string[] } | null {
  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  const sorted = Object.keys(TEAM_ENTRIES).sort((a, b) => b.length - a.length)
  for (const key of sorted) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(?:^|\\s|\\b)${escaped}(?:$|\\s|\\b)`, 'i')
    if (regex.test(q)) {
      const entry = TEAM_ENTRIES[key]
      return { league: entry.league, searchTerms: entry.search }
    }
  }
  return null
}

function detectTopicTags(query: string): string[] {
  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  const sorted = Object.keys(TOPIC_TAG_MAP).sort((a, b) => b.length - a.length)
  for (const key of sorted) {
    // Use word boundary matching to avoid false positives like "rain" matching "ai"
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(?:^|\\s|\\b)${escaped}(?:$|\\s|\\b)`, 'i')
    if (regex.test(q)) return TOPIC_TAG_MAP[key]
  }
  return []
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

// In-memory cache for Gamma API results (survives within serverless instance)
const gammaCache = new Map<string, { data: EventInfo[]; ts: number }>()
const GAMMA_CACHE_TTL = 30_000 // 30s — fresh enough for live odds, fast for demo
const GAMMA_FETCH_TIMEOUT = 5_000 // 5s max per Gamma request

async function fetchEvents(params: URLSearchParams): Promise<EventInfo[]> {
  const cacheKey = params.toString()
  const cached = gammaCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < GAMMA_CACHE_TTL) return cached.data

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GAMMA_FETCH_TIMEOUT)
  try {
    const res = await fetch(`${GAMMA_API}/events?${params}`, {
      signal: controller.signal,
      next: { revalidate: 60 },
    })
    if (!res.ok) return cached?.data || []
    const data = await res.json()
    if (!Array.isArray(data)) return cached?.data || []
    const events = data.map(parseEvent)
    gammaCache.set(cacheKey, { data: events, ts: Date.now() })
    return events
  } catch {
    return cached?.data || [] // stale cache on timeout
  } finally {
    clearTimeout(timer)
  }
}

// Topic → Gamma tag_slug mapping (non-sports categories)
// Verified slugs: crypto, economy, tariffs, politics, pop-culture, science, tech
const TOPIC_TAG_MAP: Record<string, string[]> = {
  // Crypto (tag: crypto)
  'crypto': ['crypto'], 'bitcoin': ['crypto'], 'btc': ['crypto'],
  'ethereum': ['crypto'], 'eth': ['crypto'], 'solana': ['crypto'],
  'sol': ['crypto'], 'defi': ['crypto'], 'nft': ['crypto'],
  'altcoin': ['crypto'], 'altcoins': ['crypto'], 'blockchain': ['crypto'],
  'cripto': ['crypto'], 'criptomonedas': ['crypto'], 'moneda': ['crypto'],
  'xrp': ['crypto'], 'ripple': ['crypto'], 'dogecoin': ['crypto'], 'doge': ['crypto'],
  // Economy (tags: economy + tariffs when relevant)
  'economy': ['economy'], 'fed': ['economy'], 'inflation': ['economy'], 'gdp': ['economy'],
  'interest rate': ['economy'], 'recession': ['economy'],
  'economia': ['economy'], 'inflacion': ['economy'], 'tasa de interes': ['economy'],
  'stock market': ['economy'], 'bolsa': ['economy'],
  // Tariffs (has its own dedicated tag!)
  'tariff': ['tariffs', 'economy'], 'tariffs': ['tariffs', 'economy'],
  'arancel': ['tariffs', 'economy'], 'aranceles': ['tariffs', 'economy'],
  // Politics
  'politics': ['politics'], 'politica': ['politics'], 'president': ['politics'],
  'presidente': ['politics'], 'congress': ['politics'], 'senate': ['politics'],
  'democrat': ['politics'], 'republican': ['politics'],
  'democrata': ['politics'], 'republicano': ['politics'],
  // Pop culture
  'oscar': ['pop-culture'], 'oscars': ['pop-culture'], 'oscares': ['pop-culture'],
  'grammy': ['pop-culture'], 'grammys': ['pop-culture'],
  'emmy': ['pop-culture'], 'emmys': ['pop-culture'],
  'celebrity': ['pop-culture'], 'celebridad': ['pop-culture'],
  // Note: specific celebrity names (taylor swift, drake, etc.) are NOT mapped to tags
  // because tag results would be too broad (all pop-culture events, not just that person).
  // They work better through text matching against titles/questions.
  // Science
  'science': ['science'], 'ciencia': ['science'], 'space': ['science'],
  'espacio': ['science'], 'nasa': ['science'], 'spacex': ['science'],
  'alien': ['science'], 'ufo': ['science'],
  // Tech
  'tech': ['tech'], 'tecnologia': ['tech'], 'apple': ['tech'],
  'google': ['tech'], 'microsoft': ['tech'], 'meta': ['tech'],
  'ai': ['tech'], 'artificial intelligence': ['tech'],
  'openai': ['tech'], 'chatgpt': ['tech'],
}

// BTC/ETH/SOL Up or Down 5-minute event detection
// These events rotate every 5 min with slug pattern: btc-updown-5m-{epoch}
// They have very low volume so they never appear in trending — must fetch directly.
const UPDOWN_5M_PATTERNS: Record<string, { slugPrefix: string; coinName: string }> = {
  'btc': { slugPrefix: 'btc-updown-5m', coinName: 'Bitcoin' },
  'bitcoin': { slugPrefix: 'btc-updown-5m', coinName: 'Bitcoin' },
  'eth': { slugPrefix: 'eth-updown-5m', coinName: 'Ethereum' },
  'ethereum': { slugPrefix: 'eth-updown-5m', coinName: 'Ethereum' },
  'sol': { slugPrefix: 'sol-updown-5m', coinName: 'Solana' },
  'solana': { slugPrefix: 'sol-updown-5m', coinName: 'Solana' },
  'xrp': { slugPrefix: 'xrp-updown-5m', coinName: 'XRP' },
}

// Detect "BTC 5m", "bitcoin up or down", "btc 5 minute", "eth up down", etc.
function detectUpDown5m(query: string): string | null {
  const q = query.toLowerCase().trim()
  // Patterns that indicate user wants the 5-minute up/down market
  const is5m = /\b(5\s*m(in(ute)?s?)?|cinco\s*min|5\s*minutos?)\b/i.test(q)
  const isUpDown = /\b(up\s*(or|\/|and)?\s*down|sube\s*(o|y)?\s*baja|arriba\s*(o|y)?\s*abajo)\b/i.test(q)

  if (!is5m && !isUpDown) return null

  // Find which coin the user is asking about
  for (const [keyword, info] of Object.entries(UPDOWN_5M_PATTERNS)) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(?:^|\\s|\\b)${escaped}(?:$|\\s|\\b)`, 'i')
    if (regex.test(q)) return info.slugPrefix
  }

  // If just "5m" or "up or down" without coin, default to BTC
  if (is5m || isUpDown) return 'btc-updown-5m'

  return null
}

// Compute the current 5-minute slot epoch and fetch the active event
async function fetchUpDown5mEvent(slugPrefix: string): Promise<EventInfo[]> {
  // Slot epoch = UTC time rounded down to nearest 5-minute boundary
  const nowSec = Math.floor(Date.now() / 1000)
  const slotEpoch = nowSec - (nowSec % 300) // 300s = 5 min

  // Try current slot + next 2 slots (in case current just expired)
  const slugsToTry = [
    `${slugPrefix}-${slotEpoch}`,
    `${slugPrefix}-${slotEpoch + 300}`,    // next 5 min
    `${slugPrefix}-${slotEpoch + 600}`,    // 10 min from now
  ]

  console.log(`[Search] Fetching Up/Down 5m: trying slugs ${slugsToTry.join(', ')}`)

  // Try each slug until we find an active, non-closed event
  for (const slug of slugsToTry) {
    const events = await fetchEvents(new URLSearchParams({
      slug, _limit: '1',
    }))
    if (events.length > 0 && events[0].slug) {
      console.log(`[Search] Found Up/Down 5m: ${events[0].title}`)
      return events
    }
  }

  console.log(`[Search] No active Up/Down 5m event found for prefix ${slugPrefix}`)
  return []
}

// Query expansion: short/ambiguous queries -> better search terms
// This helps when users type abbreviations or colloquial terms
const QUERY_EXPAND: Record<string, string[]> = {
  // Crypto
  'btc': ['bitcoin'], 'eth': ['ethereum'], 'sol': ['solana'],
  'bitcoin': ['bitcoin', 'btc'], 'ethereum': ['ethereum', 'eth'],
  'btc 5m': ['bitcoin up or down'], 'btc 5 min': ['bitcoin up or down'],
  'btc 5 minute': ['bitcoin up or down'], 'btc 5 minutes': ['bitcoin up or down'],
  'bitcoin 5m': ['bitcoin up or down'], 'bitcoin 5 min': ['bitcoin up or down'],
  'btc up or down': ['bitcoin up or down'], 'btc up down': ['bitcoin up or down'],
  'eth 5m': ['ethereum up or down'], 'eth up or down': ['ethereum up or down'],
  'sol 5m': ['solana up or down'], 'sol up or down': ['solana up or down'],
  'xrp': ['xrp', 'ripple'], 'ada': ['cardano'], 'doge': ['dogecoin'],
  'matic': ['polygon'], 'avax': ['avalanche'], 'dot': ['polkadot'],
  'link': ['chainlink'], 'uni': ['uniswap'],
  // People
  'trump': ['trump'], 'biden': ['biden'], 'elon': ['elon', 'musk', 'tesla'],
  'musk': ['musk', 'elon', 'tesla'], 'vitalik': ['ethereum', 'vitalik'],
  'zuck': ['zuckerberg', 'meta'], 'zuckerberg': ['zuckerberg', 'meta'],
  // AI
  'ai': ['artificial intelligence', 'openai', 'chatgpt', 'ai model'],
  'openai': ['openai', 'chatgpt', 'gpt'], 'chatgpt': ['chatgpt', 'openai'],
  'claude': ['anthropic', 'claude'], 'gemini ai': ['gemini', 'google ai'],
  // Politics/Events
  'war': ['war', 'military', 'strike', 'invasion'],
  'election': ['election', 'president', 'vote', 'nominee'],
  'eleccion': ['election', 'president'], 'elecciones': ['election'],
  'oscar': ['oscar', 'academy award', 'best picture'],
  'oscars': ['oscar', 'academy award', 'best picture'],
  'oscares': ['oscar', 'academy award'], 'academia': ['academy award'],
  'superbowl': ['super bowl', 'nfl'], 'super bowl': ['super bowl', 'nfl'],
  'grammy': ['grammy', 'grammys'], 'grammys': ['grammy'],
  'world cup': ['world cup', 'fifa'], 'mundial': ['world cup', 'fifa'],
  // Economy
  'fed': ['fed', 'federal reserve', 'interest rate'],
  'recession': ['recession', 'gdp', 'economy'],
  'inflation': ['inflation', 'cpi', 'price'],
  'tariff': ['tariff', 'trade war'], 'tariffs': ['tariff', 'trade war'],
  // Countries
  'mexico': ['mexico', 'mexican'], 'usa': ['united states', 'america'],
  'china': ['china', 'chinese'], 'russia': ['russia', 'russian', 'ukraine'],
  'ukraine': ['ukraine', 'russia'], 'iran': ['iran', 'iranian'],
  'israel': ['israel', 'gaza', 'palestine'], 'gaza': ['gaza', 'israel'],
  // Entertainment
  'taylor swift': ['taylor swift'], 'drake': ['drake'],
  'beyonce': ['beyonce'], 'rihanna': ['rihanna'],
  'netflix': ['netflix'], 'disney': ['disney'],
  'marvel': ['marvel'], 'star wars': ['star wars'],
  // Weather/Science
  'rain': ['weather', 'rain', 'temperature'],
  'lluvia': ['weather', 'rain'], 'clima': ['weather'],
  'earthquake': ['earthquake', 'seismic'], 'terremoto': ['earthquake'],
  'hurricane': ['hurricane', 'storm'], 'huracan': ['hurricane'],
  // Spanish common queries
  'quien gana': ['winner', 'champion'],
  'quien ganara': ['winner', 'champion'],
  'campeon': ['champion', 'winner'],
  'ganador': ['winner'],
  'precio': ['price'],
}

// Detect gibberish / nonsensical queries that won't match anything
function isGibberish(query: string): boolean {
  const q = query.toLowerCase().trim()
  // Too short (single char)
  if (q.length <= 1) return true
  // Check consonant-only strings (no vowels = likely gibberish)
  const stripped = q.replace(/\s+/g, '')
  if (stripped.length >= 4 && !/[aeiouáéíóúy]/i.test(stripped)) return true
  // Repeating chars (aaaa, xxxx)
  if (/(.)\1{3,}/.test(stripped)) return true
  return false
}

// Stop words that are too common to be meaningful for matching
const STOP_WORDS = new Set([
  'will', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'can', 'could', 'would', 'should',
  'may', 'might', 'shall', 'must', 'it', 'its', 'this', 'that', 'these', 'those',
  'what', 'which', 'who', 'whom', 'how', 'when', 'where', 'why',
  'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'for', 'with', 'from',
  'into', 'onto', 'upon', 'about', 'above', 'below', 'between', 'through',
  'during', 'before', 'after', 'of', 'at', 'by', 'on', 'in', 'to', 'up',
  // Spanish
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'que', 'como',
  'por', 'para', 'con', 'sin', 'sobre', 'entre', 'hay', 'ser', 'estar',
  'del', 'al', 'es', 'son', 'fue', 'era', 'va',
])

// Score how well an event title matches a query (0 = no match)
function scoreMatch(title: string, query: string): number {
  const t = title.toLowerCase()
  const q = query.toLowerCase().trim()
  const words = q.split(/\s+/).filter(w => w.length > 1)

  if (words.length === 0) return 0

  // Exact multi-word query in title = best match
  if (q.length > 3 && t.includes(q)) return 100

  // Filter out stop words — these match everything and cause false positives
  const meaningfulWords = words.filter(w => w.length >= 3 && !STOP_WORDS.has(w))
  if (meaningfulWords.length === 0) return 0

  // For multi-word queries (like "taylor swift"), require ALL meaningful words to match
  // to prevent false positives like "Marjorie Taylor Greene" matching "taylor swift"
  if (meaningfulWords.length >= 2) {
    const allPresent = meaningfulWords.every(w => t.includes(w))
    return allPresent ? 80 : 0
  }

  // Single meaningful word — require exact word match (not substring)
  // e.g. "rain" should not match "training"
  const word = meaningfulWords[0]
  const wordRegex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
  return wordRegex.test(t) ? 60 : 0
}

export async function searchMarkets(query: string, limit = 10): Promise<EventInfo[]> {
  console.log(`[Search] query="${query}" limit=${limit}`)

  if (!query) {
    console.log(`[Search] Path: trending (no query)`)
    return fetchEvents(new URLSearchParams({
      _limit: String(limit), active: 'true', closed: 'false',
      order: 'volume24hr', ascending: 'false',
    }))
  }

  // 0. Check for BTC/ETH/SOL Up/Down 5-minute markets
  //    These rotate every 5 min with dynamic slugs and never appear in trending.
  const updown5mPrefix = detectUpDown5m(query)
  if (updown5mPrefix) {
    console.log(`[Search] Path: Up/Down 5m, prefix="${updown5mPrefix}"`)
    const events = await fetchUpDown5mEvent(updown5mPrefix)
    if (events.length > 0) return events.slice(0, limit)
    // Fall through to general search if no active 5m event found
  }

  // 1. Check if query maps to a sports league ("liga mx", "nba", "f1")
  const leagueSlug = detectLeague(query)
  if (leagueSlug) {
    // Find which league keyword matched so we can detect extra words
    const qNormLeague = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
    const matchedKey = Object.keys(LEAGUE_MAP).sort((a, b) => b.length - a.length).find(k => qNormLeague.includes(k)) || ''
    const extraWords = qNormLeague.replace(matchedKey, '').trim().split(/\s+/).filter(w => w.length > 2)

    if (extraWords.length === 0) {
      // Pure league query ("nba", "liga mx") → return top events unfiltered
      console.log(`[Search] Path: league tag="${leagueSlug}" (pure)`)
      return fetchEvents(new URLSearchParams({
        _limit: '20', active: 'true', closed: 'false',
        tag_slug: leagueSlug, order: 'volume24hr', ascending: 'false',
      }))
    }

    // League + extra words ("nba champion", "nba finals") → fetch then filter
    console.log(`[Search] Path: league tag="${leagueSlug}" + filter="${extraWords.join(' ')}"`)
    const leagueEvents = await fetchEvents(new URLSearchParams({
      _limit: '20', active: 'true', closed: 'false',
      tag_slug: leagueSlug, order: 'volume24hr', ascending: 'false',
    }))

    const scored = leagueEvents.map(e => {
      const titleLower = e.title.toLowerCase()
      const marketQuestions = e.markets.map(m => m.question.toLowerCase())
      // Check if extra words appear in title or any market question
      const titleHits = extraWords.filter(w => titleLower.includes(w)).length
      const marketHits = extraWords.filter(w => marketQuestions.some(q => q.includes(w))).length
      const score = Math.max(titleHits, marketHits)
      return { event: e, score }
    })

    const filtered = scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score || b.event.volume - a.event.volume)
      .map(s => s.event)

    console.log(`[Search] League+filter: ${filtered.length}/${leagueEvents.length} match "${extraWords.join(' ')}"`)
    if (filtered.length > 0) return filtered.slice(0, limit)
    // Fallback: return unfiltered if no matches
    return leagueEvents.slice(0, limit)
  }

  // 2. Check if query matches a team name ("Pumas", "Chivas", "Lakers")
  //    Also detect "X vs Y" patterns to extract both teams
  const vsMatch = query.match(/(.+?)\s+(?:vs\.?|versus|contra|v)\s+(.+)/i)
  const teamMatch = detectTeamLeague(query)
  console.log(`[Search] Path: team=${teamMatch?.league || 'none'}, vs=${vsMatch ? `${vsMatch[1]} vs ${vsMatch[2]}` : 'none'}`)

  if (teamMatch) {
    // Gamma API caps at 20 results per request
    // Fetch TWO pages in parallel: by volume (catches high-profile events) +
    // by endDate ASC (catches today's/tonight's games that end soonest)
    // This ensures low-volume daily games don't get pushed out by high-volume futures
    const [byVolume, byEndDate] = await Promise.all([
      fetchEvents(new URLSearchParams({
        _limit: '20', active: 'true', closed: 'false',
        tag_slug: teamMatch.league, order: 'volume24hr', ascending: 'false',
      })),
      fetchEvents(new URLSearchParams({
        _limit: '20', active: 'true', closed: 'false',
        tag_slug: teamMatch.league, order: 'endDate', ascending: 'true',
      })),
    ])

    // Merge and dedupe by slug
    const seen = new Set<string>()
    const allEvents: EventInfo[] = []
    for (const e of [...byVolume, ...byEndDate]) {
      if (!seen.has(e.slug)) {
        seen.add(e.slug)
        allEvents.push(e)
      }
    }

    console.log(`[Search] tag_slug="${teamMatch.league}": ${byVolume.length} by volume + ${byEndDate.length} by endDate = ${allEvents.length} unique`)

    // Build all search terms: team variants + vs sides
    const allSearchTerms = [...teamMatch.searchTerms]
    if (vsMatch) {
      const side2 = vsMatch[2].trim().toLowerCase()
      if (!allSearchTerms.includes(side2)) allSearchTerms.push(side2)
    }

    // Filter out events whose endDate has already passed (stale games from Gamma API)
    const now = new Date()
    const liveEvents = allEvents.filter(e => !e.endDate || new Date(e.endDate) > now)

    // Score by relevance: check both event title AND sub-market questions
    // This ensures multi-outcome events (NBA Champion) surface when searching a team name
    const scored = liveEvents.map(e => {
      const titleLower = e.title.toLowerCase()
      let score = 0
      const matchCount = allSearchTerms.filter(t => titleLower.includes(t)).length
      if (matchCount >= 2) score = 100  // Both teams in title (e.g. "Celtics vs. Suns")
      else if (matchCount === 1) score = 60  // One team in title

      // Also check sub-market questions (catches "Will the Lakers win the 2026 NBA Finals?")
      if (score === 0 && e.markets.length > 0) {
        const marketMatch = e.markets.some(m =>
          allSearchTerms.some(t => m.question.toLowerCase().includes(t))
        )
        if (marketMatch) score = 50  // Team found in sub-market question
      }

      // Boost daily games only slightly (don't overshadow high-volume futures)
      if (e.slug.match(/\d{4}-\d{2}-\d{2}$/)) score += 5
      return { event: e, score }
    })

    console.log(`[Search] Scoring with terms=${JSON.stringify(allSearchTerms)}:`)
    scored.filter(s => s.score > 0).slice(0, 8).forEach(s =>
      console.log(`  [${s.score}] ${s.event.title} (${s.event.slug})`)
    )

    const filtered = scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score || b.event.volume - a.event.volume)
      .map(s => {
        const e = s.event
        // For multi-outcome events (e.g. "2026 NBA Champion" with 30 sub-markets),
        // filter to only the sub-market(s) matching the team query.
        // This way the client gets "Will the Lakers win?" instead of a random first sub-market.
        if (e.markets.length > 2) {
          const matching = e.markets.filter(m =>
            allSearchTerms.some(t => m.question.toLowerCase().includes(t))
          )
          if (matching.length > 0) {
            return { ...e, markets: matching }
          }
        }
        return e
      })

    if (filtered.length > 0) return filtered.slice(0, limit)
    return allEvents.slice(0, limit)
  }

  // 3. Smart general search — multi-strategy approach
  //    Gamma API ignores text params (title, q, question_contains all broken).
  //    Strategy: detect topic → fetch by tag, then score results against query.
  //    If no tag matches, score against top trending as last resort.

  const qNorm = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

  // Reject gibberish early
  if (isGibberish(qNorm)) {
    console.log(`[Search] Rejected gibberish query: "${query}"`)
    return []
  }

  // Build expanded search terms from our dictionary
  const expanded = QUERY_EXPAND[qNorm]
  const searchTerms = expanded ? [query, ...expanded] : [query]
  // Also expand individual words for multi-word queries
  const queryWords = qNorm.split(/\s+/).filter(w => w.length > 2)
  for (const w of queryWords) {
    const wordExpansion = QUERY_EXPAND[w]
    if (wordExpansion) searchTerms.push(...wordExpansion)
  }
  // Dedupe
  const uniqueTerms = [...new Set(searchTerms.map(t => t.toLowerCase()))]

  console.log(`[Search] Path: general, terms=${JSON.stringify(uniqueTerms)}`)

  // Detect topic tags for more targeted fetch
  const topicTags = detectTopicTags(qNorm)
  console.log(`[Search] Topic tags: ${topicTags.length > 0 ? topicTags.join(', ') : 'none'}`)

  // Fetch events from multiple sources in parallel
  const fetchPromises: Promise<EventInfo[]>[] = []

  // Always fetch top trending (base pool)
  fetchPromises.push(fetchEvents(new URLSearchParams({
    _limit: '20', active: 'true', closed: 'false',
    order: 'volume24hr', ascending: 'false',
  })))

  // Fetch from each detected topic tag
  for (const tag of topicTags) {
    fetchPromises.push(fetchEvents(new URLSearchParams({
      _limit: '20', active: 'true', closed: 'false',
      tag_slug: tag, order: 'volume24hr', ascending: 'false',
    })))
  }

  const results = await Promise.all(fetchPromises)

  // Merge and dedupe all fetched events, tracking which came from topic tags
  const seen = new Set<string>()
  const pool: EventInfo[] = []
  const taggedSlugs = new Set<string>() // events from topic tag fetches

  // First batch is always the trending pool
  for (const e of results[0] || []) {
    if (!seen.has(e.slug)) {
      seen.add(e.slug)
      pool.push(e)
    }
  }

  // Remaining batches are from topic tags — mark them
  for (let i = 1; i < results.length; i++) {
    for (const e of results[i] || []) {
      if (!seen.has(e.slug)) {
        seen.add(e.slug)
        pool.push(e)
      }
      taggedSlugs.add(e.slug)
    }
  }

  console.log(`[Search] Pool size: ${pool.length} events (${results.map(r => r.length).join(' + ')} sources), tagged: ${taggedSlugs.size}`)

  // Score each event against ALL search terms, take best score
  const scored = pool.map(event => {
    const best = Math.max(...uniqueTerms.map(term => scoreMatch(event.title, term)))
    // Also check market questions inside the event
    const marketScore = Math.max(0, ...event.markets.map(m =>
      Math.max(...uniqueTerms.map(term => scoreMatch(m.question, term)))
    ))
    let score = Math.max(best, marketScore)

    // If the event came from a topic tag fetch and has no text match,
    // give it a base relevance score (the tag IS the match).
    // e.g. "crypto" query → crypto tag → Bitcoin events ARE relevant
    if (score === 0 && taggedSlugs.has(event.slug)) {
      score = 25 // Below text-match scores but above threshold
    }

    return { event, score }
  })

  // Two-tier scoring:
  // 1. Text-matched results (score >= 60) — the query text actually appears in the title
  // 2. Tag-matched results (score = 25) — only if NO text matches exist
  const TEXT_MATCH_SCORE = 40
  const TAG_MATCH_SCORE = 25

  const textMatched = scored
    .filter(s => s.score >= TEXT_MATCH_SCORE)
    .sort((a, b) => b.score - a.score || b.event.volume - a.event.volume)
    .map(s => s.event)
    .slice(0, limit)

  if (textMatched.length > 0) {
    console.log(`[Search] Text-matched: ${textMatched.length} events`)
    scored.filter(s => s.score >= TEXT_MATCH_SCORE).slice(0, 5).forEach(s =>
      console.log(`  [${s.score}] ${s.event.title}`)
    )
    return textMatched
  }

  // No text matches — fall back to tag-matched results (sorted by volume)
  const tagMatched = scored
    .filter(s => s.score >= TAG_MATCH_SCORE)
    .sort((a, b) => b.event.volume - a.event.volume)  // By volume since all scores are equal
    .map(s => s.event)
    .slice(0, limit)

  console.log(`[Search] Tag-matched: ${tagMatched.length} events (no text matches)`)
  if (tagMatched.length > 0) {
    return tagMatched
  }

  // No matches found — return empty instead of random trending
  console.log(`[Search] No relevant results for "${query}"`)
  return []
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
