import { checkAdminAuth } from '../../lib/admin-auth'
import { getPostBySlug } from '../../lib/blog-redis'
import {
  publishToFacebookReel, publishToYouTube, publishToTikTok,
  publishToLinkedIn, publishToX, publishToThreads, publishToInstagramReel,
} from '../../lib/blotato-client'
import {
  generatePlatformCaptions,
  buildTikTokCaption, buildLinkedInCaption, buildXCaption,
  buildThreadsCaption, buildInstagramCaption,
  SITE_URL,
} from '../../lib/publish-service'

export const config = { maxDuration: 60 }

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
        facebook:  post.socialCopy,
        youtube:   post.socialCopy,
        linkedin:  post.socialCopy,
        twitter:   post.title,
        tiktok:    post.socialCopy,
        threads:   post.socialCopy,
        instagram: post.socialCopy,
      }
    : await generatePlatformCaptions(post)

  const fbCopy    = `${captions.facebook}\n\n${articleUrl}`
  const ytDesc    = `${captions.youtube}\n\n${articleUrl}`
  const liCopy    = buildLinkedInCaption(captions.linkedin, post.category, articleUrl)
  const twCopy    = buildXCaption(captions.twitter, post.category, articleUrl)
  const ttCopy    = buildTikTokCaption(captions.tiktok, post.category, articleUrl)
  const thCopy    = buildThreadsCaption(captions.threads, articleUrl)
  const igCopy    = buildInstagramCaption(captions.instagram, post.category, articleUrl)

  const [reelOut, ytOut, ttOut, liOut, twOut, thOut, igOut] = await Promise.allSettled([
    publishToFacebookReel(fbCopy, videoUrl),
    publishToYouTube(post.title, ytDesc, videoUrl, videoThumbnailUrl),
    publishToTikTok(ttCopy, videoUrl),
    publishToLinkedIn(liCopy, videoUrl),
    publishToX(twCopy, videoUrl),
    publishToThreads(thCopy, videoUrl),
    publishToInstagramReel(igCopy, videoUrl),
  ])

  function outcome(r: PromiseSettledResult<{ postSubmissionId: string }>, label: string) {
    return r.status === 'fulfilled'
      ? { postSubmissionId: r.value.postSubmissionId }
      : { error: r.reason instanceof Error ? r.reason.message : `${label} failed` }
  }

  return res.status(200).json({
    ok: true,
    facebookReel:   outcome(reelOut, 'Facebook Reel'),
    youtube:        outcome(ytOut,   'YouTube'),
    tiktok:         outcome(ttOut,   'TikTok'),
    linkedin:       outcome(liOut,   'LinkedIn'),
    twitter:        outcome(twOut,   'X / Twitter'),
    threads:        outcome(thOut,   'Threads'),
    instagramReel:  outcome(igOut,   'Instagram Reel'),
  })
}
