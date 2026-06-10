/**
 * POST /api/blog/queue-publish
 *
 * Marks a queued blog post as published (website-only). Social posting
 * is now handled exclusively by /api/content/publish-video (OneUp) and
 * fires BEFORE this endpoint, not from inside it.
 *
 * If you need to push images-only to social (no video case), use the
 * OneUp scheduleimagepost endpoint via a future endpoint — not via
 * this one. This file deliberately has no Blotato/OneUp coupling.
 */
import { checkAdminAuth } from '../../lib/admin-auth'
import { getPostBySlug, publishQueuedPost } from '../../lib/blog-redis'

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = checkAdminAuth(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

  const { slug } = req.body ?? {}
  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'slug required' })
  }

  const post = await getPostBySlug(slug)
  if (!post) return res.status(404).json({ error: 'Post not found' })

  if (!['media_ready', 'media_pending'].includes(post.workflowStatus ?? '')) {
    return res.status(400).json({
      error: `Post is not ready to publish (status: ${post.workflowStatus})`,
    })
  }

  try {
    await publishQueuedPost(slug)
    return res.status(200).json({ ok: true })
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? 'Publish failed' })
  }
}
