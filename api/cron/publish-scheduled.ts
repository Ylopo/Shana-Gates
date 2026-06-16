import { getDueScheduledPosts, getPostBySlug, publishQueuedPost, setYouTubeUrl, markSocialPublished } from '../../lib/blog-redis'
import { scheduleVideoNow, getYouTubeChannelId } from '../../lib/oneup-client'
import { findNewestVideoSince } from '../../lib/youtube-rss'
import { SITE_URL } from '../../lib/publish-service'

export const config = { maxDuration: 300 }

// Wait for a new YouTube video to appear on Shana's channel after the
// submission timestamp. Cron uses a 90-second cap (9 × 10 s) to keep
// multi-post runs predictable. If RSS hasn't reflected the upload yet,
// the blog still publishes — the youtubeUrl can be backfilled later via
// /api/blog/set-youtube-url once it lands.
async function waitForYouTubeRss(
  slug: string,
  since: string,
  channelId: string,
  maxAttempts = 9,
  intervalMs = 10000,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs))
    try {
      const video = await findNewestVideoSince(channelId, since)
      if (video) {
        await setYouTubeUrl(slug, video.url).catch((err) => {
          console.error(`[publish-scheduled] setYouTubeUrl ${slug} failed:`, err)
        })
        return { ok: true, url: video.url }
      }
    } catch (err: any) {
      // Transient — keep polling
    }
  }
  return { ok: false, error: 'YouTube RSS did not reflect a new video within 90s — blog publishing anyway' }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.authorization
    const bodySecret = req.body?.secret
    const querySecret = req.query?.secret
    if (
      authHeader !== `Bearer ${cronSecret}` &&
      bodySecret !== cronSecret &&
      querySecret !== cronSecret
    ) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  const due = await getDueScheduledPosts()
  console.log(`[publish-scheduled] ${due.length} post(s) due`)
  if (due.length === 0) return res.status(200).json({ ok: true, published: 0 })

  const results: Array<{ slug: string; ok: boolean; error?: string; youtubeUrl?: string }> = []
  const channelId = process.env.ONEUP_YOUTUBE_CHANNEL_ID ? getYouTubeChannelId() : null

  for (const summary of due) {
    try {
      const post = await getPostBySlug(summary.slug)
      if (!post) { results.push({ slug: summary.slug, ok: false, error: 'not found' }); continue }

      const articleUrl = `${SITE_URL}/blog/post.html?slug=${post.slug}`
      const captionBase = (post.socialCopy && post.socialCopy.trim())
        || (post.excerpt && post.excerpt.trim())
        || post.title

      // ── Social FIRST (when video present), then blog ─────────────────────
      // Submit to OneUp (one call → all 4 connected accounts in Shana's
      // category). Wait for the YouTube upload to land via channel RSS, then
      // publish the blog so the page renders with the embed in place.
      if (post.videoUrl && process.env.ONEUP_API_KEY) {
        if (post.socialPublishedAt) {
          // Already submitted to OneUp — likely a re-run of the cron after a
          // partial failure on a previous tick. Skip the social blast to
          // avoid duplicates and proceed to publish the blog.
          console.log(`[publish-scheduled] ${summary.slug} social already published at ${post.socialPublishedAt}, skipping OneUp re-submission`)
        } else {
          const since = new Date().toISOString()
          const submission = await scheduleVideoNow({
            title: post.title,
            content: `${captionBase}\n\n${articleUrl}`,
            videoUrl: post.videoUrl,
            thumbnailUrl: post.videoThumbnailUrl,
          })

          if (!submission.ok) {
            console.warn(`[publish-scheduled] ${summary.slug} OneUp submission failed:`, submission.message)
          } else {
            await markSocialPublished(summary.slug).catch((err) => {
              console.error(`[publish-scheduled] ${summary.slug} markSocialPublished failed:`, err)
            })
            if (channelId) {
              const ytWait = await waitForYouTubeRss(summary.slug, since, channelId)
              if (!ytWait.ok) {
                console.warn(`[publish-scheduled] ${summary.slug} YouTube wait: ${ytWait.error}`)
              }
            }
          }
        }
      }

      // Now publish the blog. youtubeUrl will already be on the post if
      // the RSS wait succeeded; otherwise it can be backfilled later.
      await publishQueuedPost(summary.slug)

      const finalPost = await getPostBySlug(summary.slug)
      results.push({
        slug: summary.slug,
        ok: true,
        youtubeUrl: finalPost?.youtubeUrl,
      })
    } catch (err: any) {
      results.push({ slug: summary.slug, ok: false, error: err?.message ?? 'unknown' })
    }
  }

  return res.status(200).json({ ok: true, published: results.filter(r => r.ok).length, results })
}
