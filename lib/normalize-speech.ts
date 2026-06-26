/**
 * lib/normalize-speech.ts
 *
 * normalizeScriptForSpeech(script) — converts numerals, prices, dates, years,
 * percentages, decimals, and large numbers into natural spoken English so the
 * HeyGen avatar reads them like a real person.
 *
 * Examples:
 *   1950             → "nineteen fifty"
 *   2026             → "twenty twenty-six"
 *   $1,500,000       → "one million five hundred thousand dollars"
 *   $750K            → "seven hundred fifty thousand dollars"
 *   $1.5M            → "one point five million dollars"
 *   3.5%             → "three point five percent"
 *   1,250 sq ft      → "twelve hundred fifty square feet"
 *   0.25 acres       → "zero point two five acres"
 *   5–7 minutes      → "five to seven minutes"
 *   2 bed / 2 bath   → "two bed, two bath"
 *   911              → "nine one one"
 *   90210            → "nine zero two one zero"
 *
 * URLs, emails, hashtags, @-handles, file paths, and inline-code spans are
 * preserved verbatim — they get parked in placeholders during the rewrite
 * passes and restored at the end.
 *
 * Pure regex implementation — no external API calls, fully deterministic, so
 * the output is identical across runs and machine-testable in isolation.
 */

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
const TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

function under100(n: number): string {
  if (n < 10) return ONES[n]
  if (n < 20) return TEENS[n - 10]
  const t = Math.floor(n / 10)
  const o = n % 10
  return o === 0 ? TENS[t] : `${TENS[t]}-${ONES[o]}`
}

function under1000(n: number): string {
  if (n < 100) return under100(n)
  const h = Math.floor(n / 100)
  const rest = n % 100
  if (rest === 0) return `${ONES[h]} hundred`
  return `${ONES[h]} hundred ${under100(rest)}`
}

export function intToWords(n: number): string {
  if (!Number.isFinite(n)) return String(n)
  const i = Math.trunc(n)
  if (i < 0) return `negative ${intToWords(-i)}`
  if (i === 0) return 'zero'
  if (i < 1000) return under1000(i)
  if (i < 1_000_000) {
    const k = Math.floor(i / 1000)
    const rest = i % 1000
    if (rest === 0) return `${under1000(k)} thousand`
    return `${under1000(k)} thousand ${under1000(rest)}`
  }
  if (i < 1_000_000_000) {
    const m = Math.floor(i / 1_000_000)
    const rest = i % 1_000_000
    if (rest === 0) return `${under1000(m)} million`
    return `${under1000(m)} million ${intToWords(rest)}`
  }
  const b = Math.floor(i / 1_000_000_000)
  const rest = i % 1_000_000_000
  if (rest === 0) return `${under1000(b)} billion`
  return `${under1000(b)} billion ${intToWords(rest)}`
}

/** Spoken-year format. 1900 → "nineteen hundred", 2005 → "two thousand five",
 *  2026 → "twenty twenty-six", 1907 → "nineteen oh seven". */
export function yearToWords(y: number): string {
  if (!Number.isInteger(y) || y < 1000 || y > 9999) return intToWords(y)
  if (y >= 2000 && y < 2010) {
    if (y === 2000) return 'two thousand'
    return `two thousand ${ONES[y - 2000]}`
  }
  const century = Math.floor(y / 100)
  const yearInCentury = y % 100
  const centuryWord = under100(century)
  if (yearInCentury === 0) return `${centuryWord} hundred`
  if (yearInCentury < 10) return `${centuryWord} oh ${ONES[yearInCentury]}`
  return `${centuryWord} ${under100(yearInCentury)}`
}

/** "25" → "two five". Reads each digit individually — used for the decimal
 *  fraction after the point ("0.25" → "zero point two five"). */
function fractionToWords(decimalStr: string): string {
  return decimalStr.split('').map(d => ONES[parseInt(d, 10)] ?? d).join(' ')
}

/** "3.5" → "three point five", "0.25" → "zero point two five",
 *  "1500" (no dot) → "one thousand five hundred". */
function decimalToWords(s: string): string {
  if (!s.includes('.')) {
    const n = parseInt(s, 10)
    return Number.isFinite(n) ? intToWords(n) : s
  }
  const [intPart, fracPart] = s.split('.')
  const intN = parseInt(intPart || '0', 10)
  const intWords = intToWords(Number.isFinite(intN) ? intN : 0)
  if (!fracPart) return intWords
  return `${intWords} point ${fractionToWords(fracPart)}`
}

function priceWithSuffix(numStr: string, suffix: string): string {
  const numWords = decimalToWords(numStr)
  const unit = suffix.toUpperCase() === 'K' ? 'thousand'
             : suffix.toUpperCase() === 'M' ? 'million'
             : suffix.toUpperCase() === 'B' ? 'billion'
             : ''
  return `${numWords}${unit ? ' ' + unit : ''} dollars`
}

function priceFull(rawNumStr: string): string {
  const clean = rawNumStr.replace(/,/g, '')
  if (!clean.includes('.')) {
    return `${intToWords(parseInt(clean, 10))} dollars`
  }
  const [dollars, cents] = clean.split('.')
  const dollarsN = parseInt(dollars || '0', 10)
  const dollarsWord = intToWords(Number.isFinite(dollarsN) ? dollarsN : 0)
  if (!cents || cents.replace(/0/g, '') === '') return `${dollarsWord} dollars`
  const centsNum = parseInt(cents.padEnd(2, '0').slice(0, 2), 10)
  if (centsNum === 0) return `${dollarsWord} dollars`
  return `${dollarsWord} dollars and ${intToWords(centsNum)} cents`
}

// Common N11 service codes — read digit-by-digit (911, 411, 311, etc.)
const N11_CODES = new Set(['211', '311', '411', '511', '611', '711', '811', '911'])

function digitByDigit(s: string): string {
  return s.split('').map(c => ONES[parseInt(c, 10)] ?? c).join(' ')
}

/** Real-estate convention: 1,250 sq ft reads as "twelve hundred fifty"
 *  (not "one thousand two hundred fifty"). Only applies inside a measurement
 *  context — outside that context this function isn't called. */
function sqFtToWords(n: number): string {
  if (n >= 1000 && n < 10000) {
    const hundreds = Math.floor(n / 100)
    const rest = n % 100
    const hundredsWord = under100(hundreds)
    if (rest === 0) return `${hundredsWord} hundred`
    return `${hundredsWord} hundred ${under100(rest)}`
  }
  return intToWords(n)
}

const PH_OPEN = 'PH'
const PH_CLOSE = ''

/** Main entry point. */
export function normalizeScriptForSpeech(script: string): string {
  if (!script) return script

  // ── Pass 0: park URLs / emails / @-handles / hashtags / inline code / file paths ──
  // These get pulled out of the text under unique tokens so subsequent number
  // passes can't accidentally chew on them. Restored verbatim at the end.
  const parked: string[] = []
  const park = (s: string): string => {
    parked.push(s)
    return `${PH_OPEN}${parked.length - 1}${PH_CLOSE}`
  }

  let out = script

  // URLs (http / https)
  out = out.replace(/\bhttps?:\/\/\S+/g, m => park(m))
  // Email addresses
  out = out.replace(/\b[\w.+-]+@[\w.-]+\.\w{2,}\b/g, m => park(m))
  // @-handles (preceded by start-of-string or non-word/non-@)
  out = out.replace(/(^|[^\w@])(@\w+)/g, (_, prefix, handle) => `${prefix}${park(handle)}`)
  // Hashtags
  out = out.replace(/(^|[^\w])(#\w+)/g, (_, prefix, tag) => `${prefix}${park(tag)}`)
  // Inline-code spans
  out = out.replace(/`[^`\n]+`/g, m => park(m))
  // File paths (start with / or ./, end with a recognisable extension)
  out = out.replace(/(?:^|\s)(\.{0,2}\/[\w\-./]+\.[a-zA-Z]{2,5})\b/g, (_, full) => {
    const pre = _.startsWith(full) ? '' : _.slice(0, _.length - full.length)
    return `${pre}${park(full)}`
  })

  // ── Pass 1: money with K / M / B letter suffix ──
  out = out.replace(/\$(\d+(?:\.\d+)?)\s*([KkMmBb])\b/g, (_, num, suf) => priceWithSuffix(num, suf))

  // ── Pass 2: money with explicit word suffix ($1.5 million, $20 thousand) ──
  out = out.replace(/\$(\d+(?:\.\d+)?)\s+(million|billion|thousand)\b/gi,
    (_, num, suf) => `${decimalToWords(num)} ${suf.toLowerCase()} dollars`)

  // ── Pass 3: full money form ($1,500,000, $750, $1,200.50) ──
  out = out.replace(/\$\d[\d,]*(?:\.\d+)?/g, m => priceFull(m.slice(1)))

  // ── Pass 4: percentages ──
  out = out.replace(/(\d+(?:\.\d+)?)\s*%/g, (_, num) => `${decimalToWords(num)} percent`)

  // ── Pass 5: bed/bath slash shorthand ──
  // "2 bed / 2 bath" → "two bed, two bath" (replaces the slash with a comma
  // so the reader pauses naturally between the two facts).
  out = out.replace(/(\d+)\s*(bed(?:s|room)?|br|bd)\s*\/\s*(\d+)\s*(bath(?:s|room)?|ba)\b/gi,
    (_, a, aUnit, b, bUnit) => {
      const aWord = intToWords(parseInt(a, 10))
      const bWord = intToWords(parseInt(b, 10))
      const aLabel = aUnit.toLowerCase().startsWith('br') ? 'bed'
                   : aUnit.toLowerCase().startsWith('bd') ? 'bed'
                   : aUnit.toLowerCase().replace(/(?:s|room)$/i, '')
      const bLabel = bUnit.toLowerCase().startsWith('ba') ? 'bath'
                   : bUnit.toLowerCase().replace(/(?:s|room)$/i, '')
      return `${aWord} ${aLabel}, ${bWord} ${bLabel}`
    })

  // ── Pass 6: square footage ──
  out = out.replace(/(\d{1,3}(?:,\d{3})+|\d+)\s*(?:sq\s*\.?\s*ft|square\s+feet|sqft|sf)\b/gi,
    (_, num) => {
      const n = parseInt(num.replace(/,/g, ''), 10)
      return `${sqFtToWords(n)} square feet`
    })

  // ── Pass 7: acres ──
  out = out.replace(/(\d+(?:\.\d+)?)\s*acres?\b/gi, (_, num) => {
    const word = decimalToWords(num)
    const unit = parseFloat(num) === 1 ? 'acre' : 'acres'
    return `${word} ${unit}`
  })

  // ── Pass 8: ranges (5–7, 5-7, 5—7) between bare numbers ──
  out = out.replace(/(\b\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?\b)/g, (_, a, b) => {
    const aN = parseFloat(a)
    const bN = parseFloat(b)
    const bothYearLike = Number.isInteger(aN) && Number.isInteger(bN)
      && aN >= 1800 && aN <= 2099 && bN >= 1800 && bN <= 2099
    const aWord = bothYearLike ? yearToWords(aN) : decimalToWords(a)
    const bWord = bothYearLike ? yearToWords(bN) : decimalToWords(b)
    return `${aWord} to ${bWord}`
  })

  // ── Pass 9: N11 emergency codes (911 etc.) ──
  out = out.replace(/\b(\d{3})\b/g, m => N11_CODES.has(m) ? digitByDigit(m) : m)

  // ── Pass 10: 5+ digit no-comma numbers (ZIP codes, phone-like sequences) ──
  out = out.replace(/\b\d{5,}\b/g, m => digitByDigit(m))

  // ── Pass 11: years (1800–2099 standalone) ──
  out = out.replace(/\b(1[89]\d{2}|20\d{2})\b/g, (_, y) => yearToWords(parseInt(y, 10)))

  // ── Pass 12: comma-grouped numbers (general — e.g. "12,000 people") ──
  out = out.replace(/\b\d{1,3}(?:,\d{3})+\b/g, m => intToWords(parseInt(m.replace(/,/g, ''), 10)))

  // ── Pass 13: standalone decimals ──
  out = out.replace(/(\d+)\.(\d+)/g, (_, intP, fracP) => decimalToWords(`${intP}.${fracP}`))

  // ── Pass 14: remaining bare integers ──
  out = out.replace(/\b\d+\b/g, m => intToWords(parseInt(m, 10)))

  // ── Restore parked tokens ──
  out = out.replace(new RegExp(`${PH_OPEN}(\\d+)${PH_CLOSE}`, 'g'),
    (_, idx) => parked[parseInt(idx, 10)] ?? '')

  return out
}
