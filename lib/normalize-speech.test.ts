/**
 * lib/normalize-speech.test.ts
 *
 * Run with:  npx tsx lib/normalize-speech.test.ts
 *
 * Self-contained — uses Node's built-in `assert` and a tiny eq() helper. No
 * test framework dependency. Process exits non-zero if any case fails.
 *
 * Each case is a [label, input, expected] triple. Add new cases by appending
 * to CASES — they run in order and each is reported independently.
 */
import { strict as assert } from 'node:assert'
import { normalizeScriptForSpeech, intToWords, yearToWords, intToOrdinal } from './normalize-speech'

type Case = readonly [label: string, input: string, expected: string]

const CASES: Case[] = [
  // ── Years ────────────────────────────────────────────────────────────────
  ['year 1950', '1950', 'nineteen fifty'],
  ['year 1999', '1999', 'nineteen ninety-nine'],
  ['year 2005', '2005', 'two thousand five'],
  ['year 2024', '2024', 'twenty twenty-four'],
  ['year 2026', '2026', 'twenty twenty-six'],
  ['year 1907 (oh)', 'Built in 1907.', 'Built in nineteen oh seven.'],
  ['year in context', 'Built in 1950, the home stunned.', 'Built in nineteen fifty, the home stunned.'],

  // ── Money ────────────────────────────────────────────────────────────────
  ['price $1,500,000', '$1,500,000', 'one million five hundred thousand dollars'],
  ['price $750K', 'Listed at $750K today', 'Listed at seven hundred fifty thousand dollars today'],
  ['price $1.5M', 'closed for $1.5M', 'closed for one point five million dollars'],
  ['price $450K', '$450K asking', 'four hundred fifty thousand dollars asking'],
  ['price $1.5 million (word suffix)', 'asking $1.5 million flat', 'asking one point five million dollars flat'],
  ['price $1,200.50', '$1,200.50', 'one thousand two hundred dollars and fifty cents'],

  // ── Percentages ──────────────────────────────────────────────────────────
  ['percent 3.5%', 'rate is 3.5%', 'rate is three point five percent'],
  ['percent 6.75%', '6.75% APR', 'six point seven five percent APR'],

  // ── Measurements ─────────────────────────────────────────────────────────
  ['sq ft 1,250', '1,250 sq ft', 'one thousand two hundred fifty square feet'],
  ['sq ft 2,400', '2,400 sq ft of living space', 'two thousand four hundred square feet of living space'],
  ['sq ft 3,400 (spec example)', '3,400 square feet', 'three thousand four hundred square feet'],
  ['acres 0.25', 'sits on 0.25 acres', 'sits on zero point two five acres'],
  ['acres 1', 'just 1 acre', 'just one acre'],
  ['miles plain', '5 miles east of town', 'five miles east of town'],
  ['miles decimal', '2.5 miles to the airport', 'two point five miles to the airport'],
  ['acres spec example', 'purchased 25,000 acres', 'purchased twenty-five thousand acres'],

  // ── Ordinals (1st → first, 250th → two hundred fiftieth) ─────────────────
  ['ordinal 1st', 'finished 1st place', 'finished first place'],
  ['ordinal 2nd', 'her 2nd home purchase', 'her second home purchase'],
  ['ordinal 3rd', 'on the 3rd floor', 'on the third floor'],
  ['ordinal 25th', 'celebrating its 25th anniversary', 'celebrating its twenty-fifth anniversary'],
  ['ordinal 250th', 'the 250th property to sell', 'the two hundred fiftieth property to sell'],
  ['ordinal 21st', 'this 21st century landmark', 'this twenty-first century landmark'],
  ['ordinal 100th', 'the 100th day on market', 'the one hundredth day on market'],
  ['ordinal 1000th', 'the 1000th sale of the year', 'the one thousandth sale of the year'],

  // ── Dates (July 4, 2026 → July fourth, twenty twenty-six) ────────────────
  ['date full', 'on July 4, 2026', 'on July fourth, twenty twenty-six'],
  ['date no year', 'celebrate December 25 with us', 'celebrate December twenty-fifth with us'],
  ['date short month', 'closed Dec 25, 2026', 'closed Dec twenty-fifth, twenty twenty-six'],
  ['date with ordinal', 'on July 4th, 2026', 'on July fourth, twenty twenty-six'],
  ['date 1st of month', 'open house March 1, 2026', 'open house March first, twenty twenty-six'],

  // ── Times (7:30 AM → seven thirty A.M.) ──────────────────────────────────
  ['time 7:30 AM', 'open at 7:30 AM', 'open at seven thirty A.M.'],
  ['time 12:00 PM (noon)', 'lunch at 12:00 PM', 'lunch at noon'],
  ['time 12:00 AM (midnight)', 'cutoff at 12:00 AM', 'cutoff at midnight'],
  ['time 12:30 PM', 'showing at 12:30 PM', 'showing at twelve thirty P.M.'],
  ['time 7:05 AM (oh five)', 'arrived at 7:05 AM', 'arrived at seven oh five A.M.'],
  ['time 7:00 PM (zero minutes)', 'event at 7:00 PM', 'event at seven P.M.'],

  // ── Ranges ───────────────────────────────────────────────────────────────
  ['range 5–7 minutes', '5–7 minutes drive', 'five to seven minutes drive'],
  ['range hyphen 10-15', '10-15 days out', 'ten to fifteen days out'],
  ['range years 1999–2024', '1999–2024 was hot', 'nineteen ninety-nine to twenty twenty-four was hot'],

  // ── Bed / bath shorthand ─────────────────────────────────────────────────
  ['bed/bath 2 / 2', '2 bed / 2 bath', 'two bed, two bath'],
  ['bed/bath 3 BR / 2 BA', '3 BR / 2 BA', 'three bed, two bath'],

  // ── Phone / ZIP / N11 codes ──────────────────────────────────────────────
  ['N11 code 911', 'call 911 immediately', 'call nine one one immediately'],
  ['ZIP 90210', 'ZIP 90210 includes the most expensive', 'ZIP nine zero two one zero includes the most expensive'],

  // ── Preservation ─────────────────────────────────────────────────────────
  ['preserve URL', 'Visit https://shanasells.com for more', 'Visit https://shanasells.com for more'],
  ['preserve hashtag', 'Tag #PalmSprings2026 for reach', 'Tag #PalmSprings2026 for reach'],
  ['preserve @-handle', 'Follow @shanagatesrealtor today', 'Follow @shanagatesrealtor today'],
  ['preserve email', 'Email shana@craftbauer.com to book', 'Email shana@craftbauer.com to book'],
  ['preserve inline code', 'Use the `1950` literal', 'Use the `1950` literal'],

  // ── No-op (sentence without numbers) ─────────────────────────────────────
  ['no numbers', 'Call us today to schedule a private tour.', 'Call us today to schedule a private tour.'],

  // ── Mixed real-estate script ─────────────────────────────────────────────
  [
    'mixed script',
    'Built in 1950 and listed at $1.5M, this 2,400 sq ft estate features 3 bed / 2 bath at a 3.5% rate.',
    'Built in nineteen fifty and listed at one point five million dollars, this two thousand four hundred square feet estate features three bed, two bath at a three point five percent rate.',
  ],

  // ── User's spec example (from the prompt) ────────────────────────────────
  [
    'spec example — Howard Hughes',
    'Howard Hughes purchased 25,000 acres in 1950 for $3,500,000. By 2026, homes in the area were selling for over $1,500,000.',
    'Howard Hughes purchased twenty-five thousand acres in nineteen fifty for three million five hundred thousand dollars. By twenty twenty-six, homes in the area were selling for over one million five hundred thousand dollars.',
  ],

  // ── Plain decimals + small integers ──────────────────────────────────────
  ['plain decimal', 'the score was 3.5', 'the score was three point five'],
  ['small int 7', 'just 7 days to go', 'just seven days to go'],
] as const

// ── Spot-check helpers in isolation ──────────────────────────────────────────
function helperChecks(): void {
  assert.equal(intToWords(0), 'zero')
  assert.equal(intToWords(7), 'seven')
  assert.equal(intToWords(21), 'twenty-one')
  assert.equal(intToWords(100), 'one hundred')
  assert.equal(intToWords(1250), 'one thousand two hundred fifty')
  assert.equal(intToWords(1_500_000), 'one million five hundred thousand')

  assert.equal(yearToWords(1900), 'nineteen hundred')
  assert.equal(yearToWords(1950), 'nineteen fifty')
  assert.equal(yearToWords(2000), 'two thousand')
  assert.equal(yearToWords(2009), 'two thousand nine')
  assert.equal(yearToWords(2010), 'twenty ten')
  assert.equal(yearToWords(2026), 'twenty twenty-six')

  assert.equal(intToOrdinal(1), 'first')
  assert.equal(intToOrdinal(2), 'second')
  assert.equal(intToOrdinal(3), 'third')
  assert.equal(intToOrdinal(11), 'eleventh')
  assert.equal(intToOrdinal(20), 'twentieth')
  assert.equal(intToOrdinal(21), 'twenty-first')
  assert.equal(intToOrdinal(25), 'twenty-fifth')
  assert.equal(intToOrdinal(100), 'one hundredth')
  assert.equal(intToOrdinal(250), 'two hundred fiftieth')
  assert.equal(intToOrdinal(1000), 'one thousandth')
}

// ── Runner ───────────────────────────────────────────────────────────────────
let passed = 0
let failed = 0
const failures: string[] = []

try {
  helperChecks()
  console.log('  ✓ helper checks (intToWords, yearToWords)')
  passed++
} catch (err: any) {
  console.log('  ✗ helper checks: ' + err.message)
  failed++
  failures.push('helper checks')
}

for (const [label, input, expected] of CASES) {
  const actual = normalizeScriptForSpeech(input)
  if (actual === expected) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.log(`  ✗ ${label}`)
    console.log(`      input:    ${JSON.stringify(input)}`)
    console.log(`      expected: ${JSON.stringify(expected)}`)
    console.log(`      actual:   ${JSON.stringify(actual)}`)
    failed++
    failures.push(label)
  }
}

console.log('')
console.log(`${passed} passed, ${failed} failed (${CASES.length + 1} total)`)
if (failed > 0) {
  console.log('Failed cases: ' + failures.join(', '))
  process.exit(1)
}
