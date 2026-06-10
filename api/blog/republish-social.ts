/**
 * POST /api/blog/republish-social
 * Body: { slug: string }
 *
 * Retry tool — re-fires the OneUp social publish for an already-published
 * post. Useful when the original publish-video call failed silently
 * (missing env var, OneUp temporarily down, etc.) or when an operator
 * wants to re-push the existing video to all 4 connected accounts.
 *
 * Returns diagnostics so the operator can see exactly what happened
 * without digging in Vercel logs.
 */
import { checkAdminAuth } from '../../lib/admin-auth'
import { getPostBySlug } from '../../lib/blog-redis'
import { scheduleVideoNow } from '../../lib/oneup-client'
import { SITE_URL } from '../../lib/publish-service'

export const config = { maxDuration: 30 }

const ONEUP_ENV_VARS = [
  'ONEUP_API_KEY',
  'ONEUP_CATEGORY_ID',
  'ONEUP_YOUTUBE_CHANNEL_ID',
] as const

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

  const envCheck: Record<string, boolean> = {}
  for (const k of ONEUP_ENV_VARS) envCheck[k] = Boolean(process.env[k])

  const diagnostics = {
    slug,
    workflowStatus: post.workflowStatus ?? null,
    heroImageUrl: post.heroImageUrl ?? null,
    videoUrl: post.videoUrl ?? null,
    youtubeUrl: post.youtubeUrl ?? null,
    env: envCheck,
  }

  if (!post.videoUrl) {
    return res.status(400).json({
      error: 'No videoUrl on this post — OneUp republish requires a video.',
      diagnostics,
    })
  }

  if (!process.env.ONEUP_API_KEY) {
    return res.status(500).json({
      error: 'ONEUP_API_KEY is not set on the server.',
      diagnostics,
    })
  }

  const articleUrl = `${SITE_URL}/blog/post.html?slug=${post.slug}`
  const captionBase = (post.socialCopy && post.socialCopy.trim())
    || (post.excerpt && post.excerpt.trim())
    || post.title

  const result = await scheduleVideoNow({
    title: post.title,
    content: `${captionBase}\n\n${articleUrl}`,
    videoUrl: post.videoUrl,
    thumbnailUrl: post.videoThumbnailUrl,
  })

  return res.status(result.ok ? 200 : 502).json({
    ok: result.ok,
    message: result.message,
    raw: result.raw,
    diagnostics,
  })
}
