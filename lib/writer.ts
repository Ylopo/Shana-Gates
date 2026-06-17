import Anthropic from '@anthropic-ai/sdk'
import type { ScoredArticle, WeeklyTopic } from './blog-store'
import type { IdeaCandidate, BlogPostDraft, PortableTextBlock, PortableTextSpan } from './types'
import { detectCity } from './blog-image-gen'
import { autoLinkEntities } from './blog-entity-links'
import { FAIR_HOUSING_RULES } from './fair-housing'

// ── Content-mode routing ──────────────────────────────────────────────────────
// AI-optimized categories get the citation-friendly, definitions-first prompt
// (Track A). All others get the storytelling, video-script-friendly prompt
// (Track B). Resolved at write time and persisted on the post so downstream
// tooling (drift analysis, video-script extraction) can branch on it.

const AI_OPTIMIZED_CATEGORIES = new Set([
  'market-update', 'investor-tips', 'seller-tips', 'homeowner-impact',
])

export type ContentMode = 'ai-optimized' | 'entertainment'

export function contentModeFor(category: string | undefined): ContentMode {
  return category && AI_OPTIMIZED_CATEGORIES.has(category) ? 'ai-optimized' : 'entertainment'
}

// Both prompts share these META TAG rules so the publish pipeline can extract
// the writer's chosen metaTitle / metaDescription from HTML comments at the
// top of the markdown output (regex-safe, survives any body content).
const META_TAG_RULES = `META TAGS (emit at the very top of your output, before the # title):
<!-- META_TITLE: [SEO title, under 60 chars, includes the target keyword] -->
<!-- META_DESCRIPTION: [120-160 char meta description, includes the target keyword + a hook] -->

These are stripped from the body at save time and used for the page <title> and og:description.`

// ── Track A: AI-optimized (informational / citation-friendly) ────────────────
// Used for: market-update, investor-tips, seller-tips, homeowner-impact.
// Per Google's AI Optimization Guide: write for humans first, but lean into
// authoritative, definition-first phrasing so AI assistants can cite cleanly.

const AI_OPTIMIZED_SYSTEM = `You are writing blog posts for Shana Gates, REALTOR® at Craft & Bauer | Real Broker — a respected Coachella Valley real estate professional. These posts are designed to be both read by humans AND cited by generative AI assistants (ChatGPT, Claude, Gemini, Google's AI Overviews).

EDITORIAL APPROACH (Track A — AI-optimized):
- Write for humans first; AI citation is a side effect of clarity and authority.
- Use definitions-first phrasing on key terms ("Palm Springs Ordinance 2118 limits short-term rentals to..." NOT "If you're thinking about renting out...").
- State facts plainly with specific numbers, dates, named regulations, and named neighborhoods. Vague generalities get filtered out by AI rankers.
- Authoritative but warm — Shana is an expert AND a local who lives here.
- Quotable lines: write sentences AI can lift verbatim into a summary without rewriting.
- Always tie advice back to the Coachella Valley / Palm Springs market with specific city names.

${META_TAG_RULES}

POST STRUCTURE (follow exactly):
1. # [Use the exact title provided — do not change it]
2. **TL;DR:** [2–3 sentence summary that answers the article's core question. Quotable. AI assistants cite this verbatim. Include the target keyword once.]
3. ## [Heading phrased as a common Google query: "What is X?", "How does Y work?", "When should I Z?"]
   [2–3 paragraphs — definition-first, specific facts, named entities]
4. ## [Second query-phrased heading]
   [2–3 paragraphs]
5. ## [Optional third heading if the topic warrants it]
6. ## Key Takeaways
   - [3–5 short, quotable bullets. Each should stand alone as a fact AI could cite.]
7. ## What This Means For You
   - [3–4 bullets connecting the topic to action a CV homeowner/buyer/investor can take]
8. [Closing paragraph — actionable takeaway, ties back to the local market]
9. ## Frequently Asked Questions
   ### [Question 1 — phrase as a real search query]
   [2–3 sentence answer with specific facts]
   ### [Question 2]
   [Answer]
   ### [Question 3]
   [Answer]
10. *Ready to make your move in the Coachella Valley? Reach out to Shana Gates at Craft & Bauer — she knows this market inside and out. [Contact Shana →](mailto:shana@craftbauer.com)*

LENGTH: 700–1100 words.

${FAIR_HOUSING_RULES}

Return ONLY the META TAGS comments followed by the blog post in markdown. No JSON, no preamble, no closing remarks.`

// ── Track B: Entertainment / Video-friendly (storytelling) ───────────────────
// Used for: community, trending-topics, local-history, local-interest.
// Scene-first hooks, sensory detail, short paragraphs — extractable as TikTok /
// YouTube video script lines.

const ENTERTAINMENT_SYSTEM = `You are writing blog posts for Shana Gates, REALTOR® at Craft & Bauer | Real Broker — a Coachella Valley local who genuinely loves this place. These posts get repurposed as TikTok and YouTube video scripts, so they need to be vivid, scene-driven, and extractable line-by-line.

EDITORIAL APPROACH (Track B — entertainment / video):
- Open with a SCENE or a SPECIFIC DETAIL, not a "Did you know..." or "Have you ever wondered..." (banned openings).
- Vivid sensory detail — what does it look like, smell like, sound like.
- Short paragraphs (1–3 sentences each). Each paragraph should work as a single line of voiceover.
- Conversational tone. First person occasionally, second person ("you") often, never salesy.
- Named places, named people, real dates — specificity is what makes a story memorable.
- Tie the story to a specific Coachella Valley neighborhood, landmark, or street so local readers recognize it.

${META_TAG_RULES}

POST STRUCTURE (loose — favor narrative flow):
1. # [Use the exact title provided — do not change it]
2. **[Hook line — a scene, a fact, a single arresting sentence in bold]**
3. [Opening paragraph — drops the reader into the moment. No "Did you know."]
4. ## [Section heading — can be a phrase, not a question]
   [Story continues. Short paragraphs. Vivid detail.]
5. ## [Next section]
6. ## [Optional third section]
7. ## Why It Still Matters Today
   [1–2 paragraphs connecting the story to living in the Coachella Valley right now]
8. [Closing — leaves the reader feeling something]

NO closing sales CTA on these posts. They're authority and entertainment content, not lead-gen — readers find Shana through her byline and bio block, not a salesy email link.

FAQ section is OPTIONAL on entertainment posts. Only add ## Frequently Asked Questions if the topic genuinely warrants Q&A (e.g. a historical post where readers commonly ask "Is the house still standing?"). If you include it, follow the same format (### question + 2-3 sentence answer, exactly 3 pairs).

LENGTH: 600–900 words.

${FAIR_HOUSING_RULES}

Return ONLY the META TAGS comments followed by the blog post in markdown. No JSON, no preamble, no closing remarks.`

// Return the system prompt that fits the content mode for a given category.
function systemPromptFor(category: string | undefined): string {
  return contentModeFor(category) === 'ai-optimized' ? AI_OPTIMIZED_SYSTEM : ENTERTAINMENT_SYSTEM
}

// ── Shared types for blog picker output ──────────────────────────────────────

export interface BlogPostOutput {
  title: string
  slug: string
  excerpt: string
  body: string
  category: string
  sourceUrl: string
  sourceTitle: string
  pipeline: 'daily' | 'weekly'
  city?: string
  // Structured fields extracted from the writer's markdown output. Optional
  // because legacy callers / fallback paths may not produce them.
  metaTitle?: string
  metaDescription?: string
  tldr?: string
  faq?: { question: string; answer: string }[]
  keyTakeaways?: string[]
  contentMode?: ContentMode
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cityToSlug(cityName: string): string | undefined {
  if (!cityName || cityName === 'Coachella Valley') return undefined
  return cityName.toLowerCase().replace(/\s+/g, '-')
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
    + `-${Date.now()}`
}

function extractExcerpt(body: string, maxLen = 200): string {
  const lines = body.split('\n').filter((l) => l.trim() && !l.startsWith('#') && !l.startsWith('*'))
  const text = lines[0] ?? ''
  return text.slice(0, maxLen).trim()
}

function extractTitle(body: string, fallback: string): string {
  const match = body.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : fallback
}

// ── Structured-field extraction from writer markdown output ──────────────────
// The writer prompt instructs Claude to emit certain markers at known
// positions in the output (HTML comments for meta tags, a **TL;DR:** line,
// a ## Frequently Asked Questions section, a ## Key Takeaways section).
// These helpers parse them out and return clean structured fields.

function extractMetaComments(body: string): {
  metaTitle?: string
  metaDescription?: string
  stripped: string
} {
  let stripped = body
  let metaTitle: string | undefined
  let metaDescription: string | undefined

  const titleMatch = body.match(/<!--\s*META_TITLE:\s*(.+?)\s*-->/i)
  if (titleMatch) {
    metaTitle = titleMatch[1].trim()
    stripped = stripped.replace(titleMatch[0], '')
  }
  const descMatch = body.match(/<!--\s*META_DESCRIPTION:\s*(.+?)\s*-->/i)
  if (descMatch) {
    metaDescription = descMatch[1].trim()
    stripped = stripped.replace(descMatch[0], '')
  }
  // Tidy up leading whitespace left by stripped comments
  stripped = stripped.replace(/^\s*\n+/, '')
  return { metaTitle, metaDescription, stripped }
}

function extractTldr(body: string): string | undefined {
  // Matches: **TL;DR:** Sentence one. Sentence two.
  const m = body.match(/\*\*TL;?DR:\*\*\s*([^\n]+(?:\n(?!#)[^\n]+)*)/i)
  if (!m) return undefined
  return m[1].replace(/\s+/g, ' ').trim()
}

function extractFaqMarkdown(body: string): { question: string; answer: string }[] {
  const match = body.match(/##+\s*Frequently Asked Questions\s*\n([\s\S]*?)(?=\n##\s|\n#\s|$)/i)
  if (!match) return []
  const section = match[1]
  const pairs: { question: string; answer: string }[] = []
  const qRegex = /###\s+(.+?)\n+([\s\S]*?)(?=\n###\s+|$)/g
  let m: RegExpExecArray | null
  while ((m = qRegex.exec(section)) !== null) {
    const question = m[1].trim().replace(/[*_]/g, '')
    // Light markdown strip: links → text, bold/italic markers removed
    const answer = m[2]
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*_`]/g, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (question && answer) pairs.push({ question, answer })
  }
  return pairs
}

function extractKeyTakeaways(body: string): string[] {
  const match = body.match(/##+\s*Key Takeaways\s*\n([\s\S]*?)(?=\n##\s|\n#\s|$)/i)
  if (!match) return []
  const lines = match[1].split('\n')
  return lines
    .map((l) => l.trim())
    .filter((l) => /^[-*]\s+/.test(l))
    .map((l) => l.replace(/^[-*]\s+/, '').replace(/^\*\*([^*]+)\*\*:?\s*/, '$1: ').trim())
    .filter(Boolean)
}

// Run all structured extractors against a writer markdown output.
// Returns the cleaned body (meta comments stripped) plus the structured fields.
function extractStructuredFields(rawBody: string, category: string): {
  body: string
  metaTitle?: string
  metaDescription?: string
  tldr?: string
  faq?: { question: string; answer: string }[]
  keyTakeaways?: string[]
  contentMode: ContentMode
} {
  const { metaTitle, metaDescription, stripped } = extractMetaComments(rawBody)
  const tldr = extractTldr(stripped)
  const faq = extractFaqMarkdown(stripped)
  const keyTakeaways = extractKeyTakeaways(stripped)
  return {
    body: stripped,
    metaTitle,
    metaDescription,
    tldr,
    faq: faq.length > 0 ? faq : undefined,
    keyTakeaways: keyTakeaways.length > 0 ? keyTakeaways : undefined,
    contentMode: contentModeFor(category),
  }
}

// ── Write from daily article (blog picker flow) ───────────────────────────────

export async function writeFromArticle(article: ScoredArticle): Promise<BlogPostOutput> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const mode = contentModeFor(article.category)
  const lengthHint = mode === 'ai-optimized' ? '700–1100 words' : '600–900 words'

  const prompt = `Write a complete blog post for Shana Gates based on this article:

Title: ${article.title}
Source: ${article.source}
URL: ${article.url}
Summary: ${article.summary}
Why It Matters: ${article.whyItMatters}
Category: ${article.category}

Write the full blog post now. Length: ${lengthHint}. Follow the post structure for this content mode exactly.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    system: systemPromptFor(article.category),
    messages: [{ role: 'user', content: prompt }],
  })

  const rawBody = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  // Extract structured fields BEFORE autoLinkEntities runs so the meta-tag
  // comments and structured-field markers don't get mangled by link injection.
  const extracted = extractStructuredFields(rawBody, article.category)
  const title = extractTitle(extracted.body, article.title)
  const excerpt = extractExcerpt(extracted.body)
  const city = cityToSlug(detectCity(title + ' ' + article.title + ' ' + article.summary + ' ' + (article.whyItMatters || '')))
  const enrichedBody = await autoLinkEntities(extracted.body).catch(() => extracted.body)

  return {
    title,
    slug: slugify(title),
    excerpt,
    body: enrichedBody,
    category: article.category,
    sourceUrl: article.url,
    sourceTitle: article.title,
    pipeline: 'daily',
    city,
    metaTitle: extracted.metaTitle,
    metaDescription: extracted.metaDescription,
    tldr: extracted.tldr,
    faq: extracted.faq,
    keyTakeaways: extracted.keyTakeaways,
    contentMode: extracted.contentMode,
  }
}

// ── Write from weekly topic (blog picker flow) ────────────────────────────────

export async function writeFromTopic(topic: WeeklyTopic): Promise<BlogPostOutput> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const mode = contentModeFor(topic.category)
  const lengthHint = mode === 'ai-optimized' ? '700–1100 words' : '600–900 words'

  const prompt = `Write a complete blog post for Shana Gates based on this topic:

Title: ${topic.title}
Category: ${topic.category}
Angle: ${topic.angle}
Research Context: ${topic.researchContext}
Target Keywords: ${topic.keywords.join(', ')}

Write the full blog post now. Length: ${lengthHint}. Follow the post structure for this content mode exactly.
Use the target keywords naturally in the title, first paragraph, subheadings, and closing.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    system: systemPromptFor(topic.category),
    messages: [{ role: 'user', content: prompt }],
  })

  const rawBody = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  const extracted = extractStructuredFields(rawBody, topic.category)
  const title = extractTitle(extracted.body, topic.title)
  const excerpt = extractExcerpt(extracted.body)
  const city = cityToSlug(detectCity(title + ' ' + topic.title + ' ' + (topic.angle || '') + ' ' + (topic.researchContext || '')))
  const enrichedBody = await autoLinkEntities(extracted.body).catch(() => extracted.body)

  return {
    title,
    slug: slugify(title),
    excerpt,
    body: enrichedBody,
    category: topic.category,
    sourceUrl: '',
    sourceTitle: '',
    pipeline: 'weekly',
    city,
    metaTitle: extracted.metaTitle,
    metaDescription: extracted.metaDescription,
    tldr: extracted.tldr,
    faq: extracted.faq,
    keyTakeaways: extracted.keyTakeaways,
    contentMode: extracted.contentMode,
  }
}

// ── Portable text helpers (for idea pipeline) ─────────────────────────────────

const SELLER_URL = 'https://shanasells.com'

function makeKey(): string {
  return Math.random().toString(36).slice(2, 10)
}

function lineToBlock(line: string): PortableTextBlock {
  const trimmed = line.trim()
  let style: PortableTextBlock['style'] = 'normal'
  let content = trimmed

  if (trimmed.startsWith('## '))       { style = 'h2';         content = trimmed.slice(3) }
  else if (trimmed.startsWith('### ')) { style = 'h3';         content = trimmed.slice(4) }
  else if (trimmed.startsWith('> '))   { style = 'blockquote'; content = trimmed.slice(2) }

  if (style !== 'normal') {
    return {
      _type: 'block', _key: makeKey(), style, markDefs: [],
      children: [{ _type: 'span', _key: makeKey(), text: content, marks: [] }],
    }
  }

  const expanded = content.replace(/\[SELLER_CTA:\s*([^\]]+)\]/g, (_, t) => `[${t.trim()}](${SELLER_URL})`)
  const mdLinks = [...expanded.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)]

  if (mdLinks.length === 0) {
    return {
      _type: 'block', _key: makeKey(), style: 'normal', markDefs: [],
      children: [{ _type: 'span', _key: makeKey(), text: content, marks: [] }],
    }
  }

  const markDefs: Array<{ _type: 'link'; _key: string; href: string }> = []
  const children: PortableTextSpan[] = []
  let cursor = 0

  for (const m of mdLinks) {
    const before = expanded.slice(cursor, m.index!)
    if (before) children.push({ _type: 'span', _key: makeKey(), text: before, marks: [] })
    const linkKey = makeKey()
    markDefs.push({ _type: 'link', _key: linkKey, href: m[2] })
    children.push({ _type: 'span', _key: makeKey(), text: m[1], marks: [linkKey] })
    cursor = m.index! + m[0].length
  }
  const tail = expanded.slice(cursor)
  if (tail) children.push({ _type: 'span', _key: makeKey(), text: tail, marks: [] })

  return { _type: 'block', _key: makeKey(), style: 'normal', markDefs, children }
}

function bodyTextToBlocks(bodyText: string): PortableTextBlock[] {
  const blocks: PortableTextBlock[] = []
  for (const line of bodyText.split('\n').filter((l) => l.trim())) {
    const trimmed = line.trim()
    if (trimmed.startsWith('- ')) {
      blocks.push(lineToBlock('• ' + trimmed.slice(2)))
    } else {
      blocks.push(lineToBlock(trimmed))
    }
  }
  return blocks
}

// ── Write from IdeaCandidate (idea pipeline flow) ─────────────────────────────

export async function writePostFromIdea(
  idea: IdeaCandidate,
  learningsContext: string = '',
): Promise<BlogPostDraft> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const cityFocus = idea.cityTarget ?? 'Coachella Valley'
  const keyword   = idea.targetKeyword ?? idea.title

  const researchSection = idea.researchData
    ? `\nRESEARCH / SOURCE MATERIAL:\n${idea.researchData.slice(0, 5000)}`
    : ''

  const slugifySimple = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim().slice(0, 96)

  const isLocalHistory = idea.contentType === 'Local History' || idea.contentType === 'Local Interest'

  const writingRules = isLocalHistory
    ? `WRITING RULES (LOCAL HISTORY — STORYTELLING FORMAT):
- Voice: vivid, narrative, journalistic. Shana Gates is a proud Coachella Valley local who genuinely loves the area's history. Write like you're telling a story over coffee, not like a Wikipedia article.
- Open with the most dramatic or surprising fact — a scene, a date, a specific detail that makes the reader stop. Drop them into the moment before explaining who, what, where. Example: "February 1, 1937. A desert windstorm tore through Palm Springs with enough force to strip the roofs off a dozen homes on Tahquitz Canyon Way." Then explain what happened.
- NEVER start with "Did you know..." — that's overused. Start with the scene or fact itself.
- Structure: dramatic opening hook → historical context (who, what, when, where) → 2–3 ## sections going deeper → ## Why It Still Matters Today (connect the history to living in the Coachella Valley now) → ## Frequently Asked Questions
- 600–900 words — earns longer reads because the story is genuinely interesting
- NO seller CTA for local history/interest posts — this is community authority content, not lead gen
- Tie the history back to a specific neighborhood, park, landmark, golf course, or mountain that Coachella Valley residents recognize today
- Use real names, dates, and specific details — precision builds credibility
- Avoid: vague generalities, "the Coachella Valley has a rich history", "you might be surprised to learn"`
    : `WRITING RULES:
- Voice: knowledgeable, warm, direct. Feels like advice from a trusted neighbor who knows the market cold.
- Open with 1–2 sentences that directly answer the reader's most likely question — short, factual, CV-specific. This is the featured snippet hook.
- Always tie insights back to what they mean for Coachella Valley buyers/sellers/homeowners specifically
- Structure: intro (with direct answer) → 2–3 body sections with ## headings → ## What This Means For You (3–4 bullet points) → brief closing → ## Frequently Asked Questions
- 500–700 words total
- Avoid: salesy language, generic "tips", excessive CTAs`

  const closingCta = isLocalHistory
    ? ''
    : `\n8. *Ready to make your move in the Coachella Valley? Reach out to Shana Gates at Craft & Bauer — she knows this market inside and out. [Contact Shana →](mailto:shana@craftbauer.com)*`

  // Force structured output via tool_use. Anthropic validates the response
  // against the schema, so no more text→JSON parse failures.
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    tools: [{
      name: 'submit_blog_post',
      description: 'Submit the completed blog post with all required fields.',
      input_schema: {
        type: 'object',
        properties: {
          slug: {
            type: 'string',
            description: 'URL slug (lowercase, kebab-case, 1–96 chars, alphanumerics + dashes only).',
          },
          excerpt: {
            type: 'string',
            description: '2–3 sentence summary used on the blog listing page.',
          },
          metaTitle: {
            type: 'string',
            description: 'SEO <title> under 60 characters.',
          },
          metaDescription: {
            type: 'string',
            description: 'SEO meta description, 120–160 characters.',
          },
          body: {
            type: 'string',
            description: 'Full post body as markdown. Use ## for h2, ### for h3, - for bullets, [text](url) for links. Must end with a ## Frequently Asked Questions section containing exactly 3 ### question-and-answer pairs.',
          },
        },
        required: ['slug', 'excerpt', 'metaTitle', 'metaDescription', 'body'],
      },
    }],
    tool_choice: { type: 'tool', name: 'submit_blog_post' },
    messages: [{
      role: 'user',
      content: `You are Shana Gates, writing for the Shana Gates Real Estate blog. You are an experienced Coachella Valley REALTOR® at Craft & Bauer | Real Broker. You write to genuinely inform local buyers, sellers, homeowners, and investors — not to sell, but to help them make smarter decisions.

POST BRIEF:
- Title/Angle: ${idea.title}
- Editorial framing: ${idea.angle}
- Why it matters to Coachella Valley residents: ${idea.whyItMatters}
- Category: ${idea.category}
- Content type: ${idea.contentType}
- Primary city focus: ${cityFocus}
- Target keyword: ${keyword}
- Primary audiences: ${idea.audiences.join(', ')}

BLOG LEARNINGS & STYLE GUIDE:
${learningsContext.slice(0, 4000)}
${researchSection}

${FAIR_HOUSING_RULES}

${writingRules}

SEO RULES:
1. Target keyword is: ${keyword} — use it naturally in the opening paragraph, in at least one ## heading, and 2–3 times in the body.
2. End with ## Frequently Asked Questions — exactly 3 questions as ### headings, each with a 2–3 sentence answer. Choose questions a local resident or visitor would actually search for.
3. Add 1 internal link where it genuinely helps the reader. Use markdown link syntax.
4. COMMUNITY LINK RULE: On the FIRST mention of any CV city by name, format as a markdown link: [Palm Springs](/palm-springs.html), [Palm Desert](/palm-desert.html), [Rancho Mirage](/rancho-mirage.html), [Indian Wells](/indian-wells.html), [La Quinta](/la-quinta.html), [Indio](/indio.html), [Cathedral City](/cathedral-city.html), [Desert Hot Springs](/desert-hot-springs.html), [Coachella](/coachella.html). Only the first mention of each.${closingCta}

When the post is complete, call the submit_blog_post tool with the slug, excerpt, metaTitle, metaDescription, and body fields. Do not return any other content.`,
    }],
  })

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'submit_blog_post'
  )
  if (!toolBlock) {
    throw new Error(`Claude did not call submit_blog_post (stop_reason: ${response.stop_reason}). Try approving again.`)
  }
  const raw = toolBlock.input as Record<string, string>

  const blocks = bodyTextToBlocks(raw.body ?? '')

  // Append source credit if we have a source URL
  if (idea.sourceUrls.length > 0) {
    const sourceUrl = idea.sourceUrls[0]
    const sourceName = idea.sourceDomains[0] ?? sourceUrl
    const linkKey = makeKey()
    blocks.push({
      _type: 'block', _key: makeKey(), style: 'normal',
      markDefs: [{ _type: 'link', _key: linkKey, href: sourceUrl }],
      children: [{ _type: 'span', _key: makeKey(), text: `Source: ${sourceName}`, marks: [linkKey] }],
    })
  }

  return {
    title:           idea.title,
    slug:            raw.slug  ?? slugifySimple(idea.title),
    excerpt:         raw.excerpt ?? '',
    category:        idea.category,
    metaTitle:       raw.metaTitle ?? '',
    metaDescription: raw.metaDescription ?? '',
    body:            blocks,
    sourceUrl:       idea.sourceUrls[0] ?? '',
    sourceTitle:     idea.title,
  }
}
