import Anthropic from '@anthropic-ai/sdk'
import { tavily } from '@tavily/core'
import type { WeeklyTopic } from './blog-store'

// ── Categories for weekly original content ────────────────────────────────

const WEEKLY_CATEGORIES = [
  {
    key: 'local-area',
    label: 'Local Area Topic',
    description: 'Seasonal events, local amenities, lifestyle features, things to do in specific Coachella Valley cities. Lean into the current season — in summer prefer indoor activities, new air-conditioned venues, golf simulators, restaurants/bars; in winter prefer snowbird events, holiday markets.',
    searchQuery: 'Coachella Valley Palm Springs events lifestyle amenities 2026',
  },
  {
    key: 'market-insight',
    label: 'Market Insight',
    description: 'Current MLS data analysis, price trends, inventory interpretation for the valley. Strongly prefer mid-year / half-year / quarterly recaps and forward-looking forecasts when the calendar fits (mid-year report in June/July, year-end wrap in December).',
    searchQuery: 'Coachella Valley Palm Springs housing market data inventory mid-year forecast 2026',
  },
  {
    key: 'buying-tips',
    label: 'Buyer/Seller Advice',
    description: 'Desert-specific buying or selling tips, pricing strategies, staging, seasonal timing',
    searchQuery: 'Palm Springs desert home buying selling tips real estate advice',
  },
  {
    key: 'community-spotlight',
    label: 'Community Spotlight',
    description: 'Deep-dive on one Coachella Valley city — lifestyle, market, what makes it unique',
    searchQuery: 'Coachella Valley city neighborhood guide Palm Springs Palm Desert La Quinta',
  },
  {
    key: 'investment',
    label: 'Investment',
    description: 'STR ROI analysis, vacation property buying guide, desert market investment outlook',
    searchQuery: 'Coachella Valley Palm Springs vacation rental investment Airbnb ROI 2026',
  },
  {
    key: 'development-watch',
    label: 'Development & Community Investment',
    description: 'New construction projects, major venue openings, infrastructure investments, civic projects — framed from a homeowner perspective: "here\'s what\'s being built and what it means for long-term value." Examples: pickleball stadium breaking ground, new school construction, hotel/resort expansion, hospital projects.',
    searchQuery: 'Coachella Valley new development project construction breaking ground investment 2026',
  },
  {
    key: 'homeowner-impact',
    label: 'Homeowner Impact',
    description: 'Practical informational content for homeowners: water restrictions, CVWD rate changes, new HOA rules, CA legislation, insurance changes, ordinance updates. Non-sales tone — community service journalism. "Here\'s what changed, here\'s what you should know."',
    searchQuery: 'Coachella Valley water restrictions HOA rules homeowner law changes 2026',
  },
]

// ── Tavily search ─────────────────────────────────────────────────────────

interface TavilyResult {
  title: string
  url: string
  content: string
}

async function searchTavily(query: string): Promise<TavilyResult[]> {
  const client = tavily({ apiKey: process.env.TAVILY_API_KEY! })
  const result = await client.search(query, {
    searchDepth: 'basic',
    maxResults: 5,
  })
  return (result.results ?? []) as TavilyResult[]
}

// ── Claude Opus topic generation ──────────────────────────────────────────

const TOPIC_SYSTEM = `You are a blog content strategist for Shana Gates, REALTOR® at Craft & Bauer | Real Broker in the Coachella Valley, CA.

Your job: generate original, high-value blog post topic ideas for each content category. These are NOT news articles — they are original posts Shana's team will write to build local authority, attract buyers and sellers, and serve the broader homeowner community.

WRITING VOICE: Shana Gates — knowledgeable Coachella Valley local FIRST, REALTOR® second. Posts should read as informative community service from someone who lives here and tracks what's happening, NOT as marketing copy. The reader should think "Shana is the person who knows what's going on in our valley." Sales-y "list with me" angles are weaker; "here's what you should know" angles are stronger.

MARKET: Palm Springs, Palm Desert, Rancho Mirage, Indian Wells, La Quinta, Indio, Cathedral City, Desert Hot Springs, Coachella

SEASONAL AWARENESS — strongly factor in the current month when generating topics:
- May–September (summer in the desert, extreme heat 100-115°F): Indoor activities, air-conditioned venues, golf simulators, new indoor restaurants/bars, wellness/spa escapes, museum/gallery visits, summer market slowdown analysis, "best time to buy in summer" angles. AVOID outdoor activity recommendations during these months.
- October–November (shoulder season, snowbirds arriving): Snowbird relocation guides, market-warming-up signals, holiday event preview, Q4 market wrap.
- December–February (winter peak season for desert tourism): Winter event calendar, holiday markets, snowbird-buying guides, end-of-year tax/market analysis, January forecasts.
- March–April (festival season, Coachella + Stagecoach): Festival housing demand, STR-investor topics, spring market kickoff, Q1 wrap.

The post-generation system should look at the current date and emphasize seasonally-appropriate angles within each category. A "Local Area Topic" generated in July should be about indoor escapes, NOT about hiking trails.

TOPIC RULES:
- Each topic must be specific and actionable — not generic
- Use real Coachella Valley context (specific cities, landmarks, events, market dynamics)
- Topics should answer questions real buyers, sellers, or homeowners are Googling
- Tie in current market conditions, seasonal patterns, or timely local angles when possible
- For "development-watch" topics: frame the project as a long-term-value signal. "$50M pickleball stadium breaking ground in Indian Wells is a sign that investors see this market continuing to grow."
- For "homeowner-impact" topics: write as community service. "CVWD just changed tier-2 rates — here's what it means for your bill." No "call me to list your home" angle.

EVERGREEN HIGH-PERFORMING FORMATS — at least 1 of every 3 topics you generate (across all categories combined) MUST follow one of these proven templates, rotating through CV cities and pairs so the same template isn't repeated for the same city in consecutive weeks:
1. "What Does It Cost to Buy a Home in [City] in 2026?" — fits market-update
2. "What Does It Cost to Sell a Home in [City]?" — fits seller-tips / buying-tips
3. "How Do California Property Taxes Work for [City] Home Buyers?" — fits market-update
4. "[City A] vs. [City B]: Which Is Better for Buyers/Investors in 2026?" — fits market-insight or investment
5. "Is 2026 a Good Time to Buy in [Neighborhood/City]?" — fits market-update
6. "What Happens After Your Offer Is Accepted in California?" — fits market-update / buying-tips
7. "What Do Flood Zones Mean for Home Buyers in [Area]?" — fits market-update

City rotation pool: Palm Springs, Palm Desert, Rancho Mirage, Indian Wells, La Quinta, Indio, Cathedral City, Desert Hot Springs, Coachella.
City-vs-city pairs: Palm Springs vs. Palm Desert · La Quinta vs. Indian Wells · Rancho Mirage vs. Indian Wells · Indio vs. Coachella · Cathedral City vs. Desert Hot Springs.
Notable neighborhoods for Template 5: Movie Colony, Old Las Palmas, PGA West, Bighorn, Mission Hills, Andreas Hills, Sunrise Park, Vista Las Palmas.

When using these templates, fill in the slot with a different city than recent weeks. The titles you return should be the FINAL, CV-specific title (e.g. "What Does It Cost to Buy a Home in La Quinta in 2026?") — not the template with placeholders.

COMPLIANCE — never generate topics that mention:
- School quality, ratings, or test scores
- Safety of neighborhoods or demographic composition
- Any language that could be seen as steering or profiling`

async function generateTopicsForCategory(
  category: { key: string; label: string; description: string },
  context: TavilyResult[]
): Promise<WeeklyTopic[]> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const contextText = context
    .slice(0, 3)
    .map((r) => `- ${r.title}: ${r.content.slice(0, 300)}`)
    .join('\n')

  const prompt = `Generate 3 original blog post topic ideas for the category: **${category.label}**

Category description: ${category.description}

Recent context from the web:
${contextText}

Return a JSON array of exactly 3 topic ideas:
[{
  "id": "${category.key}-1",
  "category": "${category.key}",
  "title": "Engaging blog post headline (ready to publish)",
  "angle": "2-3 sentence description of what this post will cover and why readers will value it",
  "researchContext": "Key facts, data points, or talking points Claude should use when writing this post",
  "keywords": ["primary keyword", "secondary keyword", "long-tail keyword"]
}]

Return ONLY valid JSON, no markdown fences, no commentary.`

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
    system: TOPIC_SYSTEM,
  })

  const raw = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()

  try {
    return JSON.parse(text) as WeeklyTopic[]
  } catch {
    const match = text.match(/\[[\s\S]*\]/)
    if (match) return JSON.parse(match[0]) as WeeklyTopic[]
    return []
  }
}

// ── Main weekly research function ─────────────────────────────────────────

export async function runWeeklyResearch(): Promise<WeeklyTopic[]> {
  // Search all categories in parallel
  const results = await Promise.all(
    WEEKLY_CATEGORIES.map(async (cat) => {
      const context = await searchTavily(cat.searchQuery).catch(() => [])
      const topics = await generateTopicsForCategory(cat, context)
      return topics
    })
  )

  return results.flat()
}
