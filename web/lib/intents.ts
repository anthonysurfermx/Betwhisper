// Bilingual intent parser (EN/ES/PT) with synonym matching

export type IntentType = 'SEARCH_MARKET' | 'PLACE_BET' | 'TRENDING' | 'BALANCE' | 'HISTORY' | 'HELP' | 'UNKNOWN'

export interface ParsedIntent {
  type: IntentType
  query?: string
  amount?: number
  side?: 'Yes' | 'No'
  raw: string
}

// Synonym maps for fuzzy matching
const BET_WORDS = ['bet', 'bets', 'apuesta', 'apostar', 'puse', 'send', 'wager', 'put', 'want to bet', 'quiero apostar', 'apostar en', 'bet on']
const YES_WORDS = ['yes', 'si', 'sí', 'yeah', 'yep', 'a favor', 'bull', 'bullish']
const NO_WORDS = ['no', 'nah', 'nope', 'en contra', 'bear', 'bearish', 'against']
const TRENDING_WORDS = ['trending', 'hot', 'popular', 'top', 'tendencia', 'populares', 'caliente']
const SEARCH_WORDS = ['odds', 'show', 'what about', 'que hay', 'como esta', 'cómo está', 'search', 'find', 'busca', 'muestra', 'probabilidades']
const BALANCE_WORDS = ['balance', 'saldo', 'portfolio', 'portafolio', 'mis posiciones', 'my positions', 'mis apuestas', 'my bets', 'positions']
const HISTORY_WORDS = ['history', 'historial', 'transacciones', 'transactions', 'mis ordenes', 'my orders', 'orders', 'historial de transacciones', 'transaction history']
const HELP_WORDS = ['help', 'ayuda', 'ajuda']

// Patterns that look like bets but are actually topic searches
// "quiero apostar en la liga mx" = search for liga mx, not place a bet
const TOPIC_PREPOSITIONS = ['en', 'on', 'about', 'sobre', 'de', 'em']

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[?¿!¡.,]/g, '')
    .trim()
}

function containsAny(text: string, words: string[]): boolean {
  return words.some(w => text.includes(w))
}

function extractAmount(text: string): number | undefined {
  // Match: $20, 20 usdc, 0.5 mon, 20, $0.01
  const match = text.match(/\$?([\d.]+)\s*(?:usdc|mon|usd|pesos)?/i)
  return match ? parseFloat(match[1]) : undefined
}

function extractSide(text: string): 'Yes' | 'No' | undefined {
  if (containsAny(text, YES_WORDS)) return 'Yes'
  if (containsAny(text, NO_WORDS)) return 'No'
  return undefined
}

function extractQuery(text: string): string {
  // Remove known command words to isolate the search query
  let cleaned = text
  const removeWords = [
    ...BET_WORDS, ...TRENDING_WORDS, ...SEARCH_WORDS,
    'on', 'the', 'me', 'de', 'los', 'las', 'el', 'la', 'hey', 'gemini',
    'what', 'are', 'whats', 'que', 'como', 'for', 'quiero', 'want', 'i',
    'en', 'sobre', 'about', 'em',
  ]
  for (const w of removeWords) {
    cleaned = cleaned.replace(new RegExp(`\\b${w}\\b`, 'gi'), '')
  }
  return cleaned.replace(/\s+/g, ' ').trim()
}

function hasBetTopic(text: string): boolean {
  // Check if a bet-word is followed by a preposition + topic
  // e.g. "apostar en liga mx", "bet on nba", "quiero apostar sobre futbol"
  for (const prep of TOPIC_PREPOSITIONS) {
    const pattern = new RegExp(`(?:${BET_WORDS.join('|')})\\s+${prep}\\s+\\w`, 'i')
    if (pattern.test(text)) return true
  }
  return false
}

export function parseIntent(rawText: string): ParsedIntent {
  const text = normalize(rawText)

  // Check balance/portfolio (highest priority, before search fallback)
  if (containsAny(text, BALANCE_WORDS)) {
    return { type: 'BALANCE', raw: rawText }
  }

  // Check history/transactions
  if (containsAny(text, HISTORY_WORDS)) {
    return { type: 'HISTORY', raw: rawText }
  }

  // Check help
  if (containsAny(text, HELP_WORDS)) {
    return { type: 'HELP', raw: rawText }
  }

  // Check for bet words
  if (containsAny(text, BET_WORDS)) {
    // If the text has a topic after a preposition ("apostar en liga mx"),
    // treat as a search, not a direct bet placement
    if (hasBetTopic(text)) {
      return {
        type: 'SEARCH_MARKET',
        query: extractQuery(text),
        raw: rawText,
      }
    }

    // Direct bet: has a side (yes/no) or amount, no topic
    const side = extractSide(text)
    const amount = extractAmount(text)
    if (side || amount) {
      return {
        type: 'PLACE_BET',
        amount,
        side,
        raw: rawText,
      }
    }

    // Bare "quiero apostar" / "want to bet" with no topic = ask what they want
    return {
      type: 'SEARCH_MARKET',
      query: extractQuery(text),
      raw: rawText,
    }
  }

  // Check for trending
  if (containsAny(text, TRENDING_WORDS)) {
    return { type: 'TRENDING', raw: rawText }
  }

  // Check for search
  if (containsAny(text, SEARCH_WORDS)) {
    return {
      type: 'SEARCH_MARKET',
      query: extractQuery(text),
      raw: rawText,
    }
  }

  // Default: treat as search query if there's meaningful text
  const query = extractQuery(text)
  if (query.length > 1) {
    return {
      type: 'SEARCH_MARKET',
      query,
      raw: rawText,
    }
  }

  return { type: 'UNKNOWN', raw: rawText }
}
