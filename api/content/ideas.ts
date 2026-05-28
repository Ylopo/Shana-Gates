/**
 * GET  /api/content/ideas          — list pending ideas (sorted by score)
 * PATCH /api/content/ideas         — update idea status { id, status }
 * POST  /api/content/ideas         — write + publish an approved idea { id }
 */

import { getPendingIdeas, getAllIdeas, getIdea, updateIdeaStatus, addCoveredTopic } from '../../lib/idea-store'
import { writePostFromIdea, type BlogPostOutput } from '../../lib/writer'
import { checkFairHousing, saveFHResult } from '../../lib/fair-housing'
import { publishBlogPost } from '../../lib/blog-redis'
import { generateHeroImage } from '../../lib/blog-images'
import { getLearnings } from '../../lib/learnings'
import type { PortableTextBlock } from '../../lib/types'

// Convert Sanity-style PortableText blocks back to markdown for the Redis blog store
function portableTextToMarkdown(blocks: PortableTextBlock[]): string {
  return blocks.map((b) => {
    const text = (b.children || []).map((c) => c.text || '').join('')
    if (b.style === 'h2') return `## ${text}`
    if (b.style === 'h3') return `### ${text}`
    if (b.style === 'blockquote') return `> ${text}`
    return text
  }).join('\n\n')
}

export const config = { maxDuration: 120 }

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {}
  return Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=')
      return [k.trim(), v.join('=')]
    })
  )
}

function isAuthed(req: any): boolean {
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret) return true
  if (req.query?.secret === adminSecret) return true
  const cookies = parseCookies(req.headers?.cookie)
  return !!cookies['sg_assistant_session']
}

export default async function handler(req: any, res: any) {
  if (!isAuthed(req)) return res.status(401).json({ error: 'Unauthorized' })

  // ── GET: list ideas ────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const filter = req.query?.filter as string | undefined
      const ideas = filter === 'all' ? await getAllIdeas() : await getPendingIdeas()
      return res.status(200).json({ ideas })
    } catch (err) {
      console.error('[ideas] GET error:', err)
      return res.status(500).json({ error: 'Failed to load ideas' })
    }
  }

  // ── PATCH: update status ───────────────────────────────────────────────────
  if (req.method === 'PATCH') {
    const { id, status } = req.body ?? {}
    if (!id || !status) return res.status(400).json({ error: 'id and status required' })
    if (!['approved', 'skipped', 'deferred', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }
    try {
      await updateIdeaStatus(id, status)
      return res.status(200).json({ ok: true })
    } catch (err) {
      console.error('[ideas] PATCH error:', err)
      return res.status(500).json({ error: 'Failed to update idea' })
    }
  }

  // ── POST: write + publish ──────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { id } = req.body ?? {}
    if (!id) return res.status(400).json({ error: 'id required' })

    try {
      const idea = await getIdea(id)
      if (!idea) return res.status(404).json({ error: 'Idea not found' })

      // Mark approved up-front so single-click "Approve & Write" works from pending state
      if (idea.status !== 'approved') {
        await updateIdeaStatus(id, 'approved')
      }

      // Write post
      const learnings = await getLearnings()
      const draft = await writePostFromIdea(idea, learnings)

      // Fair housing check (block on violation, warn otherwise)
      const markdownBody = portableTextToMarkdown(draft.body)
      const fhResult = await checkFairHousing(markdownBody, 'blog-post')

      if (fhResult.severity === 'violation') {
        await saveFHResult(id, fhResult)
        return res.status(422).json({
          error: 'Fair Housing violation detected — post not published',
          violations: fhResult.violations,
        })
      }

      // Build a BlogPostOutput for the Redis Media Queue (matches the article path)
      const post: BlogPostOutput = {
        title: draft.title,
        slug: draft.slug,
        excerpt: draft.excerpt,
        body: markdownBody,
        category: draft.category,
        sourceUrl: draft.sourceUrl || '',
        sourceTitle: draft.sourceTitle || '',
        pipeline: 'daily',
        city: idea.cityTarget,
      }
      const heroImage = await generateHeroImage(
        post.title,
        idea.whyItMatters || post.excerpt,
        post.category,
        post.sourceUrl,
        post.body,
      )

      // Publish to Redis as media_pending — lands in the VA / Media Queue
      const published = await publishBlogPost(post, heroImage)
      await saveFHResult(id, fhResult)
      await addCoveredTopic(post.slug)

      return res.status(200).json({
        ok: true,
        sanityId: published._id, // kept as `sanityId` for client back-compat
        title: post.title,
        slug: post.slug,
        fhSeverity: fhResult.severity,
      })
    } catch (err: any) {
      console.error('[ideas] POST error:', err)
      return res.status(500).json({ error: err?.message ?? 'Failed to write post' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
