import { getDueScheduledPosts, getPostBySlug, publishQueuedPost } from '../../lib/blog-redis'
import {
  publishToFacebook, publishToInstagram, publishToLinkedIn,
  publishToX, publishToThreads,
  publishToFacebookReel, publishToYouTube, publishToTikTok,
  publishToInstagramReel,
} from '../../lib/blotato-client'
import {
  generatePlatformCaptions,
  buildLinkedInCaption, buildXCaption,
  buildThreadsCaption, buildInstagramCaption,
  buildTikTokCaption,
  SITE_URL,
} from '../../lib/publish-service'

export const config = { maxDuration: 120 }

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

      // Make the post live on the website first
      await publishQueuedPost(summary.slug)

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

      if (videoUrl && process.env.BLOTATO_API_KEY) {
        // Video publish path — 7 platforms
        const fbCopy = `${captions.facebook}\n\n${articleUrl}`
        const ytDesc = `${captions.youtube}\n\n${articleUrl}`
        const liCopy = buildLinkedInCaption(captions.linkedin, post.category, articleUrl)
        const twCopy = buildXCaption(captions.twitter, post.category, articleUrl)
        const ttCopy = buildTikTokCaption(captions.tiktok, post.category, articleUrl)
        const thCopy = buildThreadsCaption(captions.threads, articleUrl)
        const igCopy = buildInstagramCaption(captions.instagram, post.category, articleUrl)

        await Promise.allSettled([
          publishToFacebookReel(fbCopy, videoUrl),
          publishToYouTube(post.title, ytDesc, videoUrl, videoThumb),
          publishToTikTok(ttCopy, videoUrl),
          publishToLinkedIn(liCopy, videoUrl),
          publishToX(twCopy, videoUrl),
          publishToThreads(thCopy, videoUrl),
          publishToInstagramReel(igCopy, videoUrl),
        ])
      } else if (post.heroImageUrl && process.env.BLOTATO_API_KEY) {
        // Image publish path — 5 platforms
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

      results.push({ slug: summary.slug, ok: true })
    } catch (err: any) {
      results.push({ slug: summary.slug, ok: false, error: err?.message ?? 'unknown' })
    }
  }

  return res.status(200).json({ ok: true, published: results.filter(r => r.ok).length, results })
}
