import { checkAdminAuth } from '../../lib/admin-auth'
import { markPostScheduled, cancelPostSchedule, getPostBySlug } from '../../lib/blog-redis'


export default async function handler(req: any, res: any) {
  const auth = checkAdminAuth(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

  if (req.method === 'POST') {
    const { slug, scheduledPublishAt, videoUrl, videoThumbnailUrl } = req.body ?? {}
    if (!slug) return res.status(400).json({ error: 'slug is required' })
    if (!scheduledPublishAt) return res.status(400).json({ error: 'scheduledPublishAt is required' })
    if (new Date(scheduledPublishAt).getTime() <= Date.now()) {
      return res.status(400).json({ error: 'scheduledPublishAt must be in the future' })
    }

    const post = await getPostBySlug(slug)
    if (!post) return res.status(404).json({ error: 'Post not found' })

    const ok = ['media_pending', 'media_ready', 'scheduled'].includes(post.workflowStatus ?? '')
    if (!ok) return res.status(400).json({ error: `Cannot schedule from status: ${post.workflowStatus}` })

    try {
      await markPostScheduled(slug, scheduledPublishAt, videoUrl, videoThumbnailUrl)
      return res.status(200).json({ ok: true, scheduledPublishAt })
    } catch (err: any) {
      return res.status(500).json({ error: err?.message ?? 'Failed to schedule' })
    }
  }

  if (req.method === 'DELETE') {
    const { slug } = req.body ?? {}
    if (!slug) return res.status(400).json({ error: 'slug is required' })
    try {
      await cancelPostSchedule(slug)
      return res.status(200).json({ ok: true })
    } catch (err: any) {
      return res.status(500).json({ error: err?.message ?? 'Failed to cancel' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
