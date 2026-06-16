import Anthropic from '@anthropic-ai/sdk'
import { tavily } from '@tavily/core'
import type { ScoredArticle } from './blog-store'
import type { IdeaCandidate, IdeaAudience, ArticleCategory } from './types'
import { computeTimeliness, computeSourceCredibility, computeNovelty, assembleScore, SCORE_THRESHOLD } from './scoring'
import { sourceTypeLabel } from './source-rules'
import { saveIdea, getCoveredTopics, buildWeekId } from './idea-store'
import { seedEvergreenHistoryIdeas } from './history-seeds'
import { seedEvergreenContentIdeas } from './evergreen-seeds'

// ── Coachella Valley topic queries ───────────────────────────────────────────
// 8 real estate queries rotate daily from this pool; 2 history slots are always
// filled from HISTORY_QUERIES so local history surfaces every single day.

const TOPIC_QUERIES = [
  // Market Updates
  'Coachella Valley real estate market trends 2026',
  'Palm Springs home prices housing market',
  'Palm Desert real estate news',
  'La Quinta Indian Wells Rancho Mirage housing market',
  'California real estate law changes 2026',
  'Palm Springs housing inventory buyers market',
  'California mortgage rates affordability 2026',
  'Desert real estate appreciation forecast',
  'Southern California housing market forecast',
  'Cathedral City Indio Coachella housing market',
  'California HOA law changes homeowners',
  'California property tax Prop 19 homeowners',
  // Market Updates — mid-year & seasonal forecasts
  'Coachella Valley mid-year housing market report 2026 forecast',
  'Palm Springs second half 2026 real estate outlook',
  'Coachella Valley summer real estate market slowdown trends',
  // Investor Tips
  'Palm Springs short-term rental ordinance Airbnb',
  'Coachella Valley investment property vacation rental ROI',
  'Desert Hot Springs real estate investment',
  'Coachella Valley STR permit regulations 2026',
  'Airbnb VRBO vacation rental income Coachella Valley',
  'Rancho Mirage Indian Wells luxury market investment',
  // Seller Tips
  'home selling tips pricing strategy Coachella Valley 2026',
  'California home staging tips desert properties',
  'best time to sell home Palm Springs market',
  'Coachella Valley luxury home sales seller tips',
  'how to price home desert real estate market',
  // Homeowner Impact — laws, restrictions, community changes
  // (these flow into market-update or community in scoring)
  'Coachella Valley water restrictions drought rules homeowner 2026',
  'Palm Springs HOA new rules ordinance change 2026',
  'California new homeowner law affecting Palm Springs residents 2026',
  'Coachella Valley desert landscape water conservation rules',
  'Palm Springs Palm Desert noise ordinance short term rental enforcement',
  'CVWD Coachella Valley Water District rate changes 2026',
  'California insurance changes homeowners desert wildfire',
  // Community — events, lifestyle, things to do
  'Coachella Valley events things to do 2026',
  'Palm Springs community events farmers market 2026',
  'Palm Desert La Quinta local events activities',
  'Coachella Valley lifestyle amenities outdoor recreation',
  'Coachella Festival Stagecoach housing demand event impact',
  'Palm Springs snowbird season community events',
  'Coachella Valley new restaurant development lifestyle',
  // Community — seasonal / summer indoor activities
  'Palm Springs indoor activities summer hot weather things to do',
  'Coachella Valley new indoor entertainment venue 2026 air conditioning',
  'Palm Desert golf simulator indoor sports new venue 2026',
  'Palm Springs new restaurant bar opening 2026 review',
  'Coachella Valley indoor family activities kids summer cooling',
  'Palm Springs spa wellness escape summer heat',
  'Coachella Valley museum art gallery exhibition 2026',
  // Trending Topics — celebrity & viral
  'celebrity real estate news 2026 famous home sale',
  'viral real estate trends 2026 interesting housing story',
  'luxury celebrity estate auction notable home',
  'California housing news trending real estate story',
  // Trending Topics — Big Developments & Investment Signals
  // High value: shows the market believes in long-term growth.
  // Shana posts about these from a homeowner POV: "more investment = more confidence"
  'Coachella Valley new development construction breaking ground 2026',
  'Palm Springs major construction announcement investment 2026',
  'Coachella Valley pickleball facility stadium sports complex construction',
  'Palm Desert La Quinta new school college campus construction',
  'Coachella Valley convention center hotel resort expansion 2026',
  'Palm Springs major infrastructure transit project investment',
  'Coachella Valley billion million dollar development project announced',
  'Palm Springs revitalization redevelopment investment downtown',
  'Coachella Valley hospital healthcare expansion construction 2026',
]

const HISTORY_QUERIES = [
  'Palm Springs Coachella Valley historical anniversary milestone 2026',
  'Coachella Valley famous historical event anniversary 2026',
  'Palm Springs significant local history 50th 100th anniversary',
  'Coachella Valley famous unsolved crime murder mystery cold case',
  'Palm Springs notable politician leader local figure history legacy',
  'Coachella Valley famous storm flood disaster anniversary',
  'Palm Springs landmark history milestone anniversary 2026',
  'Coachella Valley local legend famous story notable history',
  'Palm Springs military history famous event anniversary',
  'Coachella Valley local news big story anniversary notable event',
]

function getDailyQueries(date: string): string[] {
  const seed = date.replace(/-/g, '')
  const offset = parseInt(seed.slice(-2), 10)

  // 12 real estate / community queries from rotating pool.
  // Bumped from 8 to 12 (Oct 2026) to surface more variety as the pool grew —
  // big-development announcements, homeowner-impact laws, and seasonal indoor
  // activities are now part of the pool and need rotation slots.
  const reOffset = offset % TOPIC_QUERIES.length
  const reRotated = [...TOPIC_QUERIES.slice(reOffset), ...TOPIC_QUERIES.slice(0, reOffset)]
  const reQueries = reRotated.slice(0, 12)

  // 2 history queries guaranteed every day, rotating through the history pool
  const histOffset = Math.floor(offset / 2) % HISTORY_QUERIES.length
  const histRotated = [...HISTORY_QUERIES.slice(histOffset), ...HISTORY_QUERIES.slice(0, histOffset)]
  const histQueries = histRotated.slice(0, 2)

  return [...reQueries, ...histQueries]
}

// ── Tavily search ─────────────────────────────────────────────────────────────

interface TavilyResult {
  title: string
  url: string
  content: string
  published_date?: string
  score?: number
}

async function searchTavily(query: string): Promise<TavilyResult[]> {
  const client = tavily({ apiKey: process.env.TAVILY_API_KEY! })
  const result = await client.search(query, {
    searchDepth: 'basic',
    maxResults: 10,
  })
  return (result.results ?? []) as TavilyResult[]
}

// ── Claude Opus scoring ───────────────────────────────────────────────────────

const SCORING_SYSTEM = `You are a real estate content curator for Shana Gates, REALTOR® at Craft & Bauer | Real Broker in the Coachella Valley, CA.

Your job: score and categorize news articles by their relevance and value to Shana's clients — Coachella Valley buyers, sellers, and real estate investors — AND to her broader homeowner community.

EDITORIAL VOICE — important context:
Shana's blog is informative-first, not sales-first. The strongest posts are written from a homeowner / community-member perspective: "here's what's happening, here's what it means for you." When scoring, favor articles Shana can comment on as a knowledgeable local — not as a salesperson. Articles that lend themselves to a sales angle ONLY are weaker; articles that are useful community service or "did you know this is happening" reports are stronger.

SCORING RULES:
- Score 1–10 based on relevance to the Coachella Valley / Palm Springs area market AND community
- Score 1 and DROP articles about other markets (Las Vegas, Texas, Florida, Northeast, etc.) unless they directly affect CA buyers
- Score 8–10: Directly about Coachella Valley, Palm Springs, CA real estate law with local impact, OR a CV-area development / law / event with clear homeowner impact
- Score 5–7: National trends or CA-wide news that meaningfully affects local buyers/sellers/homeowners
- Score 1–4: Tangentially relevant or mostly about other markets

CATEGORIES (pick the single best fit):
- market-update: prices, inventory, market conditions, forecasts, mortgage rates, CA law changes affecting buyers/sellers, market analysis, mid-year / quarterly reports, water-rate or insurance changes that affect home costs
- investor-tips: rental properties, ROI, STR/Airbnb, vacation homes, investment strategy, cap rates, short-term rental rules
- seller-tips: seller strategy, staging, pricing, timing, listing advice, preparing a home to sell
- community: Coachella Valley events, things to do, farmers markets, festivals, community news, city spotlights, local lifestyle, dining, outdoor recreation, indoor activities, new venue openings, seasonal activities (e.g. summer indoor escapes, snowbird-season events)
- trending-topics: celebrity real estate news, viral or pop-culture real estate stories, notable property sales, interesting housing trends making national news, MAJOR DEVELOPMENT ANNOUNCEMENTS (any large CV project breaking ground or being announced)
- local-history: historical anniversaries, significant past events, cold cases, unsolved crimes, notable local figures, landmarks, battles, disasters tied to a specific date and place in the Coachella Valley / Palm Springs area
- local-interest: local legends, famous stories, notable people born or based in the Coachella Valley, community moments that put the area on the map

HIGH-VALUE SIGNAL TOPICS — prioritize these when surfaced:

1. MAJOR DEVELOPMENT PROJECTS (category: trending-topics, score 8–10)
   - New pickleball facilities, stadiums, schools, hospitals, hotels, resorts, civic projects
   - Any large dollar-amount investment ($10M+) breaking ground or being announced
   - Major redevelopment / revitalization
   - Why it matters to Shana: it's a positive long-term growth signal. Investors and developers are putting capital into the valley because they believe in the future of these communities. Shana posts on these to position herself as someone tracking long-term value drivers — NOT as a salesperson but as an informed local watching where the smart money is going.

2. HOMEOWNER-IMPACT LAW / REGULATION CHANGES (category: market-update, score 8–10)
   - Water restrictions, drought rules, CVWD rate changes
   - HOA rule changes, noise ordinances, STR enforcement updates
   - Insurance changes affecting CA / desert homeowners (esp. wildfire)
   - New CA legislation that affects what homeowners can do with their property
   - Why it matters: practical, helpful, non-sales content the community values. Shana surfaces these as a community service — many homeowners don't know about them yet.

3. SEASONAL / TOPICAL LIFESTYLE (category: community, score 7–9)
   - In summer months: indoor activities, new air-conditioned venues, golf simulators, indoor entertainment, restaurants/bars opening
   - In winter months: snowbird-season events, holiday markets, year-end community events
   - In shoulder seasons: festivals, outdoor events
   - Why it matters: relevant + timely. Especially valuable when the article is about something NEW or trending that locals haven't tried yet.

4. MID-YEAR & QUARTERLY MARKET REPORTS (category: market-update, score 8–10)
   - Half-year recaps, summer outlook, second-half forecasts
   - Quarterly inventory / median price reports for CV cities
   - Why it matters: positions Shana as someone who tracks the data and can explain it to clients.

HIGH-VALUE LOCAL INTEREST TOPICS (does NOT need to be real estate):
- Historical anniversaries: significant events in Palm Springs / Coachella Valley history (storms, floods, civic milestones, 25th/50th/75th/100th anniversaries of major events)
- Famous local stories: notable crimes, unsolved mysteries, cold cases that locals remember, local legends
- Notable local figures: politicians, military heroes, celebrities, famous residents past and present
- Big community moments: things that put Palm Springs or the Coachella Valley on the map nationally

For local-history/local-interest articles: score based on how specific and memorable the story is to Coachella Valley residents. Score 8–10 if the event has a real date, named people, and a specific Palm Springs or CV location. Use category "local-history" or "local-interest". Do NOT drop these for being non-real-estate — they score on localRelevance (20–25 if very CV-specific) and audienceValue (10–13 if locals genuinely care).

DIVERSITY GUIDANCE: When you have many articles to score, look across the FULL set and aim for category spread. If 8 of your 10 highest-scoring articles are all category "market-update", relax slightly on borderline development / community / homeowner-impact articles so Shana has a varied digest to choose from. Repetitive blog content is the failure mode we're guarding against.

COMPLIANCE — never select or recommend articles that mention:
- School quality, ratings, or test scores
- Safety of neighborhoods or demographic composition
- Any language that could be seen as steering or profiling

Return a JSON array of scored articles. Include only articles with score >= 5.`

async function scoreArticles(rawArticles: TavilyResult[]): Promise<ScoredArticle[]> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const prompt = `Score and categorize these articles for relevance to the Coachella Valley real estate market:

${JSON.stringify(rawArticles.map((a, i) => ({ id: i, title: a.title, url: a.url, content: a.content.slice(0, 500) })), null, 2)}

Return JSON array with this shape for each article with score >= 5:
[{
  "id": "article-{i}",
  "url": "...",
  "title": "...",
  "source": "domain from URL",
  "publishedDate": "YYYY-MM-DD or empty string",
  "summary": "2-3 sentence summary for Shana",
  "score": 1-10,
  "category": "one of the category values",
  "whyItMatters": "1 sentence: why Coachella Valley clients should care"
}]

Return ONLY valid JSON, no markdown, no commentary.`

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
    system: SCORING_SYSTEM,
  })

  const raw = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('')
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()

  try {
    return JSON.parse(text) as ScoredArticle[]
  } catch {
    const match = text.match(/\[[\s\S]*\]/)
    if (match) return JSON.parse(match[0]) as ScoredArticle[]
    return []
  }
}

// ── IdeaCandidate generation ──────────────────────────────────────────────────

const AUDIENCE_MAP: Record<string, IdeaAudience[]> = {
  'market-update':   ['buyer', 'seller', 'investor', 'homeowner'],
  'investor-tips':   ['investor'],
  'seller-tips':     ['seller', 'homeowner'],
  'community':       ['buyer', 'local'],
  'trending-topics': ['buyer', 'seller', 'local'],
  'local-history':   ['local', 'buyer'],
  'local-interest':  ['local', 'buyer'],
}

const CONTENT_TYPE_MAP: Record<string, string> = {
  'market-update':   'Market Update',
  'investor-tips':   'Investor Tips',
  'seller-tips':     'Seller Tips',
  'community':       'Community',
  'trending-topics': 'Trending',
  'local-history':   'Local History',
  'local-interest':  'Local Interest',
}

const CV_CITIES = [
  'Palm Springs', 'Palm Desert', 'Rancho Mirage', 'Indian Wells',
  'La Quinta', 'Indio', 'Cathedral City', 'Desert Hot Springs', 'Coachella',
]

function detectCityTarget(text: string): string | undefined {
  const lower = text.toLowerCase()
  for (const city of CV_CITIES) {
    if (lower.includes(city.toLowerCase())) return city
  }
  return undefined
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

async function articlesToIdeas(
  articles: ScoredArticle[],
  rawResults: TavilyResult[],
): Promise<IdeaCandidate[]> {
  const coveredTopics = await getCoveredTopics()
  const weekId = buildWeekId()
  const ideas: IdeaCandidate[] = []

  for (const article of articles) {
    // Map old 1-10 score to LLM dimensions
    // localRelevance: anchored to article score (max 25)
    const localRelevance = Math.min(25, Math.round(article.score * 2.5))
    const formatFit      = 10
    const audienceValue  = 12
    const seoPotential   = article.score >= 8 ? 5 : article.score >= 6 ? 3 : 2

    const domain = extractDomain(article.url)
    const { score: timelinessScore, urgency } = computeTimeliness(article.publishedDate || undefined)
    const sourceCredibility = computeSourceCredibility([domain])
    const novelty = computeNovelty(article.title, coveredTopics)

    const assembled = assembleScore(
      { localRelevance, formatFit, audienceValue, seoPotential },
      timelinessScore,
      sourceCredibility,
      novelty,
      [domain],
      article.category,
    )

    if (assembled.total < SCORE_THRESHOLD) continue

    // Find original Tavily result for full content
    const original = rawResults.find((r) => r.url === article.url)

    const idea: IdeaCandidate = {
      id: `sgs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      weekId,
      source: 'daily-research',
      title: article.title,
      angle: article.whyItMatters,
      whyItMatters: article.summary,
      category: article.category as ArticleCategory,
      audiences: AUDIENCE_MAP[article.category] ?? ['buyer', 'seller'],
      contentType: CONTENT_TYPE_MAP[article.category] ?? 'Article',
      urgency,
      score: assembled,
      sourceUrls: [article.url],
      sourceDomains: [domain],
      sourceLabels: [sourceTypeLabel(domain)],
      researchData: original?.content?.slice(0, 3000) ?? article.summary,
      targetKeyword: article.title.split(' ').slice(0, 5).join(' '),
      cityTarget: detectCityTarget(article.title + ' ' + article.summary),
      status: 'pending',
      createdAt: new Date().toISOString(),
    }

    ideas.push(idea)
  }

  return ideas
}

// ── Main research function ────────────────────────────────────────────────────

export async function runDailyResearch(date: string): Promise<ScoredArticle[]> {
  const queries = getDailyQueries(date)

  const searchResults = await Promise.all(queries.map((q) => searchTavily(q).catch(() => [])))
  const allResults = searchResults.flat()

  // Deduplicate by URL
  const seen = new Set<string>()
  const uniqueResults = allResults.filter((r) => {
    if (seen.has(r.url)) return false
    seen.add(r.url)
    return true
  })

  // Cap scoring input — Claude Opus on 100 articles can push the function past
  // Vercel's serverless timeout on smaller plans. 40 keeps quality while staying
  // well under the 60s Hobby cap.
  const toScore = uniqueResults.slice(0, 40)
  const scored = await scoreArticles(toScore)
  const topScored = scored.sort((a, b) => b.score - a.score).slice(0, 30)

  // Generate IdeaCandidates for the idea pipeline
  try {
    const ideas = await articlesToIdeas(topScored, uniqueResults)
    await Promise.all(ideas.map((idea) => saveIdea(idea)))
    console.log(`[research] Saved ${ideas.length} idea candidates`)
  } catch (err) {
    console.error('[research] Failed to save ideas:', err)
  }

  // Always seed evergreen Palm Springs history/celebrity stories
  try {
    const historyCount = await seedEvergreenHistoryIdeas()
    console.log(`[research] Seeded ${historyCount} evergreen history ideas`)
  } catch (err) {
    console.error('[research] Failed to seed history ideas:', err)
  }

  // Seed client-curated evergreen content ideas (lifestyle guides, market
  // analysis, city deep-dives, etc.) — stable IDs so each is seeded exactly
  // once into the store and remains in the picker until Shana approves it.
  try {
    const evergreenCount = await seedEvergreenContentIdeas()
    if (evergreenCount > 0) console.log(`[research] Seeded ${evergreenCount} new evergreen content ideas`)
  } catch (err) {
    console.error('[research] Failed to seed evergreen content ideas:', err)
  }

  return topScored
}
