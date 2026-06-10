/**
 * GET /api/content/youtube-wait?slug=X&since=ISO_DATE
 *
 * Single-shot RSS check — does Shana's YouTube channel feed contain a
 * video uploaded AFTER `since`? Replaces the Blotato status-by-id
 * endpoint we used previously.
 *
 * - On found: persists post.youtubeUrl via setYouTubeUrl() and returns
 *   { found: true, url, videoId, title }.
 * - On not-yet: returns { found: false }. Client polls until found
 *   or until its own timeout.
 *
 * Client polling pattern (mirrors what we did with blotato-status):
 *   1. After /api/content/publish-video succeeds, capture the `since`
 *      timestamp it returned.
 *   2. Every 10 s call this endpoint with (slug, since).
 *   3. When found is true, the YouTube URL is already persisted onto
 *      the post — proceed to publish the blog with the embed already
 *      in place.
 */
import { checkAdminAuth } from '../../lib/admin-auth'
import { setYouTubeUrl } from '../../lib/blog-redis'
import { getYouTubeChannelId } from '../../lib/oneup-client'
import { findNewestVideoSince } from '../../lib/youtube-rss'

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

    const auth = checkAdminAuth(req)
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

    if (!process.env.ONEUP_YOUTUBE_CHANNEL_ID) {
      return res.status(500).json({
        error: 'Server missing ONEUP_YOUTUBE_CHANNEL_ID env var. Add it in Vercel → Settings → Environment Variables, then redeploy.',
      })
    }

    const slug = typeof req.query?.slug === 'string' ? req.query.slug : null
    const since = typeof req.query?.since === 'string' ? req.query.since : null
    if (!slug)  return res.status(400).json({ error: 'slug is required' })
    if (!since) return res.status(400).json({ error: 'since (ISO timestamp) is required' })

    const channelId = getYouTubeChannelId()
    const video = await findNewestVideoSince(channelId, since)
    if (!video) {
      return res.status(200).json({ found: false })
    }

    // Persist the watch URL onto the blog post so the page renders the
    // embed as soon as queue-publish fires.
    await setYouTubeUrl(slug, video.url).catch((err) => {
      console.error('[youtube-wait] setYouTubeUrl failed:', err)
    })

    return res.status(200).json({
      found: true,
      url: video.url,
      videoId: video.id,
      title: video.title,
      publishedAt: video.publishedAt,
    })
  } catch (err: any) {
    console.error('[youtube-wait]', err)
    return res.status(500).json({ error: err?.message ?? 'YouTube check failed' })
  }
}
