/**
 * POST /api/content/publish-video
 *
 * Submits Shana's blog-post video to all connected social accounts in
 * her "Shana Gates" OneUp category (YouTube, Instagram, TikTok, Facebook).
 *
 * Response includes the ISO timestamp captured RIGHT BEFORE the OneUp
 * submission — this is what /api/content/youtube-wait uses as the
 * `since` cutoff when polling the YouTube channel RSS feed.
 *
 * OneUp does not return per-platform submission IDs, so this endpoint
 * cannot offer real-time status for individual platforms. The editor UI
 * shows "Submitted via OneUp" for IG/TT/FB and only gates the blog
 * publish on YouTube (which we capture via the channel RSS poller).
 */
import { checkAdminAuth } from '../../lib/admin-auth'
import { getPostBySlug } from '../../lib/blog-redis'
import { scheduleVideoNow } from '../../lib/oneup-client'
import { SITE_URL } from '../../lib/publish-service'

export const config = { maxDuration: 30 }

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = checkAdminAuth(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

  const { slug, videoUrl, videoThumbnailUrl } = req.body ?? {}
  if (!slug) return res.status(400).json({ error: 'slug is required' })
  if (!videoUrl) return res.status(400).json({ error: 'videoUrl is required' })

  const post = await getPostBySlug(slug)
  if (!post) return res.status(404).json({ error: 'Post not found' })

  const articleUrl = `${SITE_URL}/blog/post.html?slug=${post.slug}`

  // OneUp accepts ONE shared caption + title across all platforms.
  // We use post.socialCopy (the master Facebook-style caption) plus a
  // link to the blog article, and post.title as the YouTube video title.
  // Per-platform caption tuning is preserved in post.captions for
  // editor display but isn't used by OneUp (OneUp only exposes per-
  // platform JSON options for things like isReel / playlist / music).
  const captionBase = (post.socialCopy && post.socialCopy.trim())
    || (post.excerpt && post.excerpt.trim())
    || post.title
  const content = `${captionBase}\n\n${articleUrl}`

  // Capture the cutoff BEFORE submission so the RSS poller knows what
  // counts as "the new video."
  const since = new Date().toISOString()

  const result = await scheduleVideoNow({
    title: post.title,
    content,
    videoUrl,
    thumbnailUrl: videoThumbnailUrl || post.videoThumbnailUrl,
  })

  if (!result.ok) {
    return res.status(502).json({ ok: false, error: result.message, raw: result.raw })
  }

  return res.status(200).json({
    ok: true,
    message: result.message,
    since,
    // Per-platform statuses aren't available from OneUp. We expose a
    // single "submitted" envelope so the editor UI can mark each platform
    // row as queued.
    submitted: ['youtube', 'instagram', 'tiktok', 'facebook'],
  })
}
