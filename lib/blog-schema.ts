/**
 * lib/blog-schema.ts
 *
 * Builds schema.org JSON-LD for blog post pages. Per Google's AI
 * Optimization Guide structured data isn't strictly required for AI
 * visibility, but it's useful for rich-result eligibility and gives
 * AI assistants a clean, unambiguous data model to cite from.
 *
 * Emits a `@graph` of:
 *   - Article (or NewsArticle for trending-topics)
 *   - FAQPage    — only if the post has structured or extractable FAQ
 *   - BreadcrumbList
 *   - VideoObject — only if the post has a youtubeUrl
 *
 * Author + publisher data comes from lib/author.ts so a per-client fork
 * only changes one file.
 *
 * The whole build is wrapped in a top-level try/catch in the caller so a
 * malformed post can never break the page render.
 */

import type { BlogPostFull, BlogPostSummary } from './blog-redis'
import { AUTHOR, PUBLISHER } from './author'

const CATEGORY_LABELS: Record<string, string> = {
  'market-update':   'Market Update',
  'investor-tips':   'Investor Tips',
  'seller-tips':     'Seller Tips',
  'community':       'Community',
  'trending-topics': 'Trending',
  'local-history':   'Local History',
  'local-interest':  'Local Interest',
  'homeowner-impact': 'Homeowner Impact',
}

// Trending and breaking-news posts get NewsArticle (Google's News surfaces
// treat NewsArticle differently from Article in terms of freshness signals).
const NEWS_CATEGORIES = new Set(['trending-topics', 'market-update'])

function articleType(post: { category?: string }): 'Article' | 'NewsArticle' {
  return post.category && NEWS_CATEGORIES.has(post.category) ? 'NewsArticle' : 'Article'
}

// Strip markdown formatting from a string for use in JSON-LD plain-text
// fields (descriptions, FAQ answers). We don't need a full markdown parser
// — just remove the syntax characters AI / Google parsers would otherwise
// surface verbatim as text.
function stripMarkdown(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')   // links → just the text
    .replace(/[*_`#>]+/g, '')                  // bold/italic/code/heading markers
    .replace(/\n+/g, ' ')                       // collapse newlines
    .replace(/\s+/g, ' ')                       // collapse whitespace
    .trim()
}

// Regex-extract a FAQ from a post's markdown body. Used as a fallback when
// post.faq isn't set (legacy posts before the structured-field migration).
// Returns [] if no FAQ section is found or it can't be parsed.
export function extractFaqFromMarkdown(body: string): { question: string; answer: string }[] {
  if (!body) return []
  // Find the "Frequently Asked Questions" section (case-insensitive H2).
  const match = body.match(/##+\s*Frequently Asked Questions\s*\n([\s\S]*?)(?=\n##\s|\n#\s|$)/i)
  if (!match) return []
  const section = match[1]
  // Q&A pairs: "### Question" followed by answer paragraph(s) until the next "###" or end.
  const pairs: { question: string; answer: string }[] = []
  const qRegex = /###\s+(.+?)\n+([\s\S]*?)(?=\n###\s+|$)/g
  let m: RegExpExecArray | null
  while ((m = qRegex.exec(section)) !== null) {
    const question = m[1].trim().replace(/[*_]/g, '')
    const answer = stripMarkdown(m[2]).trim()
    if (question && answer) pairs.push({ question, answer })
  }
  return pairs
}

function absoluteUrl(url: string | undefined, siteUrl: string): string | undefined {
  if (!url) return undefined
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/')) return siteUrl.replace(/\/$/, '') + url
  return url
}

function readTimeMinutes(body: string): number {
  if (!body) return 1
  const words = body.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 220))   // 220 wpm average
}

function extractYouTubeId(url: string | undefined): string | undefined {
  if (!url) return undefined
  const m = url.match(/[?&]v=([^&#]+)/) || url.match(/youtu\.be\/([^?&#]+)/)
  return m ? m[1] : undefined
}

interface SchemaInput extends BlogPostSummary {
  body?: string                        // Full body, used for FAQ fallback
  faq?: { question: string; answer: string }[]
  tldr?: string
  metaDescription?: string
  youtubeUrl?: string
}

export function buildBlogPostSchema(post: SchemaInput, siteUrl: string): string {
  try {
    const site = siteUrl.replace(/\/$/, '')
    const pageUrl = `${site}/blog/post.html?slug=${encodeURIComponent(post.slug)}`
    const image = absoluteUrl(post.heroImageUrl || undefined, site)
    const description = post.tldr || post.metaDescription || post.excerpt || post.title
    const categoryLabel = CATEGORY_LABELS[post.category] || post.category

    // Author entity — used by both the Article and any other entities that
    // reference it. Including sameAs links is per Google's E-E-A-T guidance.
    const authorNode = {
      '@type': 'Person',
      'name': AUTHOR.name,
      'url': AUTHOR.profileUrl,
      'jobTitle': AUTHOR.title,
      'description': AUTHOR.bioShort,
      'image': absoluteUrl(AUTHOR.headshotUrl, site),
      'worksFor': {
        '@type': 'Organization',
        'name': AUTHOR.brokerage,
      },
      'sameAs': AUTHOR.sameAs,
    }

    const publisherNode = {
      '@type': 'Organization',
      'name': PUBLISHER.name,
      'url': PUBLISHER.url,
      'logo': {
        '@type': 'ImageObject',
        'url': PUBLISHER.logo,
      },
    }

    const articleNode: Record<string, unknown> = {
      '@type': articleType(post),
      'headline': post.title,
      'description': description,
      'datePublished': post.publishedAt,
      'dateModified': post.publishedAt,
      'author': authorNode,
      'publisher': publisherNode,
      'mainEntityOfPage': pageUrl,
      'articleSection': categoryLabel,
      'wordCount': post.body ? post.body.split(/\s+/).filter(Boolean).length : undefined,
      'inLanguage': 'en-US',
    }
    if (image) articleNode.image = image

    // FAQ — prefer structured field, fall back to regex extraction.
    const faqItems = (post.faq && post.faq.length > 0)
      ? post.faq
      : extractFaqFromMarkdown(post.body || '')
    const faqNode = faqItems.length > 0 ? {
      '@type': 'FAQPage',
      'mainEntity': faqItems.map((item) => ({
        '@type': 'Question',
        'name': item.question,
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': item.answer,
        },
      })),
    } : null

    const breadcrumbsNode = {
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': `${site}/` },
        { '@type': 'ListItem', 'position': 2, 'name': 'Blog', 'item': `${site}/blog/` },
        { '@type': 'ListItem', 'position': 3, 'name': categoryLabel, 'item': `${site}/blog/?category=${encodeURIComponent(post.category)}` },
        { '@type': 'ListItem', 'position': 4, 'name': post.title, 'item': pageUrl },
      ],
    }

    // VideoObject only if a YouTube URL is set. Treats the embed as a
    // first-class object Google can index alongside the article.
    const ytId = extractYouTubeId(post.youtubeUrl)
    const videoNode = ytId ? {
      '@type': 'VideoObject',
      'name': post.title,
      'description': description,
      'thumbnailUrl': `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
      'uploadDate': post.publishedAt,
      'embedUrl': `https://www.youtube.com/embed/${ytId}`,
      'contentUrl': `https://www.youtube.com/watch?v=${ytId}`,
      'publisher': publisherNode,
    } : null

    const graph: object[] = [articleNode, breadcrumbsNode]
    if (faqNode) graph.push(faqNode)
    if (videoNode) graph.push(videoNode)

    const jsonLd = {
      '@context': 'https://schema.org',
      '@graph': graph,
    }

    // Inline-safe: escape </ so the JSON can't break out of the <script> tag.
    const serialized = JSON.stringify(jsonLd).replace(/<\/(script)/gi, '<\\/$1')
    return `<script type="application/ld+json">${serialized}</script>`
  } catch (err) {
    // Never break the page over a schema failure. Log + return nothing.
    console.error('[blog-schema] buildBlogPostSchema failed:', err)
    return ''
  }
}

// Read-time helper exported so the page renderer can show "N min read"
// next to the byline without re-computing.
export function readTime(body: string): number {
  return readTimeMinutes(body)
}
