import { getDueScheduledPosts, getPostBySlug, publishQueuedPost, setYouTubeUrl } from '../../lib/blog-redis'
import {
  publishToFacebook, publishToInstagram, publishToLinkedIn,
  publishToX, publishToThreads,
  publishToFacebookReel, publishToYouTube, publishToTikTok,
  publishToInstagramReel,
  getPostStatus,
} from '../../lib/blotato-client'
import {
  generatePlatformCaptions,
  buildLinkedInCaption, buildXCaption,
  buildThreadsCaption, buildInstagramCaption,
  buildTikTokCaption,
  SITE_URL,
} from '../../lib/publish-service'

export const config = { maxDuration: 300 }

// Wait for Blotato to confirm a YouTube publish, capture the watch URL,
// and persist it on the blog post. Best-effort with a 90-second cap to
// keep cron runtime predictable when multiple posts are due.
async function waitForYouTubePublish(
  slug: string,
  postSubmissionId: string,
  maxAttempts = 9,
  intervalMs = 10000,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs))
    try {
      const status = await getPostStatus(postSubmissionId)
      if (status.status === 'published' && status.postUrl) {
        await setYouTubeUrl(slug, status.postUrl, postSubmissionId).catch((err) => {
          console.error(`[publish-scheduled] setYouTubeUrl ${slug} failed:`, err)
        })
        return { ok: true, url: status.postUrl }
      }
      if (status.status === 'failed') {
        return { ok: false, error: status.errorMessage || 'YouTube publish failed' }
      }
    } catch (err: any) {
      // Transient — keep polling
    }
  }
  return { ok: false, error: 'YouTube did not confirm publish within 90s — blog publishing anyway' }
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

  const results: Array<{ slug: string; ok: boolean; error?: string }> = []

  for (const summary of due) {
    try {
      const post = await getPostBySlug(summary.slug)
      if (!post) { results.push({ slug: summary.slug, ok: false, error: 'not found' }); continue }

      const articleUrl = `${SITE_URL}/blog/post.html?slug=${post.slug}`
      const stored = post.captions
      const captions = stored
        ? {
            facebook:  stored.facebook  || post.socialCopy || post.excerpt,
            youtube:   stored.youtube   || post.socialCopy || post.excerpt,
            linkedin:  stored.linkedin  || post.socialCopy || post.excerpt,
            twitter:   stored.twitter   || post.title,
            tiktok:    stored.tiktok    || post.socialCopy || post.excerpt,
            threads:   stored.threads   || post.socialCopy || post.excerpt,
            instagram: stored.instagram || post.socialCopy || post.excerpt,
          }
        : post.socialCopy
        ? {
            facebook: post.socialCopy, youtube: post.socialCopy, linkedin: post.socialCopy,
            twitter: post.title, tiktok: post.socialCopy, threads: post.socialCopy, instagram: post.socialCopy,
          }
        : await generatePlatformCaptions(post)

      const videoUrl = post.videoUrl
      const videoThumb = post.videoThumbnailUrl

      // ── Social FIRST (when video present), then blog ─────────────────────
      // Mirror of the editor.html publish flow: submit to all platforms,
      // wait for YouTube to confirm + capture the watch URL onto the post,
      // THEN publish the blog so the page renders with the embed in place.
      // Cron uses a 90s YouTube cap to keep multi-post runs bounded; if it
      // misses the window, the blog still publishes (best-effort).
      if (videoUrl && process.env.BLOTATO_API_KEY) {
        const fbCopy = `${captions.facebook}\n\n${articleUrl}`
        const ytDesc = `${captions.youtube}\n\n${articleUrl}`
        const liCopy = buildLinkedInCaption(captions.linkedin, post.category, articleUrl)
        const twCopy = buildXCaption(captions.twitter, post.category, articleUrl)
        const ttCopy = buildTikTokCaption(captions.tiktok, post.category, articleUrl)
        const thCopy = buildThreadsCaption(captions.threads, articleUrl)
        const igCopy = buildInstagramCaption(captions.instagram, post.category, articleUrl)

        const submissions = await Promise.allSettled([
          publishToFacebookReel(fbCopy, videoUrl),
          publishToYouTube(post.title, ytDesc, videoUrl, videoThumb),
          publishToTikTok(ttCopy, videoUrl),
          publishToLinkedIn(liCopy, videoUrl),
          publishToX(twCopy, videoUrl),
          publishToThreads(thCopy, videoUrl),
          publishToInstagramReel(igCopy, videoUrl),
        ])

        // submissions[1] is the YouTube call. Wait for it to confirm so we
        // can stamp the watch URL onto the post before the blog goes live.
        const ytSub = submissions[1]
        if (ytSub.status === 'fulfilled' && ytSub.value?.postSubmissionId) {
          const ytWait = await waitForYouTubePublish(summary.slug, ytSub.value.postSubmissionId)
          if (!ytWait.ok) {
            console.warn(`[publish-scheduled] ${summary.slug} YouTube wait: ${ytWait.error}`)
          }
        } else if (ytSub.status === 'rejected') {
          console.warn(`[publish-scheduled] ${summary.slug} YouTube submission failed:`, ytSub.reason)
        }
      } else if (post.heroImageUrl && process.env.BLOTATO_API_KEY) {
        // Image publish path — 5 platforms, no YouTube to gate on
        const fbCopy = `${captions.facebook}\n\n${articleUrl}`
        const liCopy = buildLinkedInCaption(captions.linkedin, post.category, articleUrl)
        const twCopy = buildXCaption(captions.twitter, post.category, articleUrl)
        const thCopy = buildThreadsCaption(captions.threads, articleUrl)
        const igCopy = buildInstagramCaption(captions.instagram, post.category, articleUrl)

        await Promise.allSettled([
          publishToFacebook(fbCopy,   post.heroImageUrl),
          publishToLinkedIn(liCopy,   post.heroImageUrl),
          publishToX(twCopy,          post.heroImageUrl),
          publishToThreads(thCopy,    post.heroImageUrl),
          publishToInstagram(igCopy,  post.heroImageUrl),
        ])
      }

      // Now publish the blog — with youtubeUrl already on the post record
      // if we caught it during the YouTube wait above.
      await publishQueuedPost(summary.slug)

      results.push({ slug: summary.slug, ok: true })
    } catch (err: any) {
      results.push({ slug: summary.slug, ok: false, error: err?.message ?? 'unknown' })
    }
  }

  return res.status(200).json({ ok: true, published: results.filter(r => r.ok).length, results })
}
