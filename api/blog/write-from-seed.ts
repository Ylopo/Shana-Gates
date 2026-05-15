/**
 * api/blog/write-from-seed.ts
 *
 * Writes a blog post directly from a history seed and adds it to the VA queue.
 * Use this when a specific curated story needs to be (re-)written with its
 * exact original title without going through the blog picker.
 *
 * Usage: POST /api/blog/write-from-seed
 * Body: { slug: "sinatra-twin-palms-estate", secret: "ADMIN_SECRET" }
 *   or: GET  /api/blog/write-from-seed?slug=sinatra-twin-palms-estate&secret=...
 */

import { PALM_SPRINGS_STORIES } from '../../lib/history-seeds'
import { writePostFromIdea } from '../../lib/writer'
import { publishBlogPost } from '../../lib/blog-redis'
import type { IdeaCandidate } from '../../lib/types'

export const config = { maxDuration: 120 }

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const secret = process.env.ADMIN_SECRET
  const provided = req.query?.secret ?? req.body?.secret
  if (secret && provided !== secret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const slug = req.query?.slug ?? req.body?.slug
  if (!slug) {
    const slugList = PALM_SPRINGS_STORIES.map((s) => s.slug)
    return res.status(400).json({ error: 'slug required', available: slugList })
  }

  const story = PALM_SPRINGS_STORIES.find((s) => s.slug === slug)
  if (!story) {
    return res.status(404).json({ error: `Seed not found: ${slug}` })
  }

  const idea: IdeaCandidate = {
    id: `history-${story.slug}`,
    weekId: new Date().toISOString().slice(0, 10).replace(/-/g, '').slice(0, 6),
    source: 'internal',
    title: story.title,
    angle: story.angle,
    whyItMatters: story.whyItMatters,
    category: 'local-history',
    audiences: ['local', 'buyer'],
    contentType: 'Local History',
    urgency: 'evergreen',
    score: {
      total: 78, localRelevance: 25, timeliness: 8,
      formatFit: 14, audienceValue: 13, sourceCredibility: 9,
      novelty: 7, seoPotential: 2,
    },
    sourceUrls: [],
    sourceDomains: [],
    sourceLabels: ['Curated — Palm Springs History'],
    researchData: story.researchData,
    targetKeyword: story.targetKeyword,
    cityTarget: story.cityTarget,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }

  try {
    const post = await writePostFromIdea(idea)
    const result = await publishBlogPost(post, { imageUrl: null })
    return res.status(200).json({ ok: true, slug: result.slug, title: story.title })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
}
