import { createHmac } from 'crypto'
import { markPostScheduled, cancelPostSchedule, getPostBySlug } from '../../lib/blog-redis'

const COOKIE_NAME = 'sg_assistant_session'

function parseCookies(h: string | undefined): Record<string, string> {
  if (!h) return {}
  return Object.fromEntries(h.split(';').map(c => { const [k, ...v] = c.trim().split('='); return [k.trim(), v.join('=')] }))
}
function verifyToken(token: string, secret: string): boolean {
  const dot = token.lastIndexOf('.')
  if (dot === -1) return false
  return createHmac('sha256', secret).update(token.slice(0, dot)).digest('hex') === token.slice(dot + 1)
}

export default async function handler(req: any, res: any) {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return res.status(500).json({ error: 'Not configured' })

  const cookies = parseCookies(req.headers.cookie)
  const token = cookies[COOKIE_NAME]
  if (!token || !verifyToken(token, secret)) return res.status(401).json({ error: 'Unauthorized' })

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
