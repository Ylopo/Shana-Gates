import { checkAdminAuth } from '../../lib/admin-auth'
import { getPostBySlug, publishQueuedPost } from '../../lib/blog-redis'
import {
  publishToFacebook, publishToInstagram, publishToLinkedIn,
  publishToX, publishToThreads,
} from '../../lib/blotato-client'
import {
  generatePlatformCaptions,
  buildLinkedInCaption, buildXCaption,
  buildThreadsCaption, buildInstagramCaption,
  SITE_URL,
} from '../../lib/publish-service'

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
    // Publish to website
    await publishQueuedPost(slug)

    // Publish to social platforms when the post has a hero image and Blotato is configured
    let social: Record<string, unknown> = {}
    if (post.heroImageUrl && process.env.BLOTATO_API_KEY) {
      const articleUrl = `${SITE_URL}/blog/post.html?slug=${post.slug}`

      const stored = post.captions
      const captions = stored
        ? {
            facebook:  stored.facebook  || post.socialCopy || post.excerpt,
            linkedin:  stored.linkedin  || post.socialCopy || post.excerpt,
            twitter:   stored.twitter   || post.title,
            threads:   stored.threads   || post.socialCopy || post.excerpt,
            instagram: stored.instagram || post.socialCopy || post.excerpt,
          }
        : post.socialCopy
        ? {
            facebook:  post.socialCopy,
            linkedin:  post.socialCopy,
            twitter:   post.title,
            threads:   post.socialCopy,
            instagram: post.socialCopy,
          }
        : await generatePlatformCaptions(post)

      const fbCopy = `${captions.facebook}\n\n${articleUrl}`
      const liCopy = buildLinkedInCaption(captions.linkedin, post.category, articleUrl)
      const twCopy = buildXCaption(captions.twitter, post.category, articleUrl)
      const thCopy = buildThreadsCaption(captions.threads, articleUrl)
      const igCopy = buildInstagramCaption(captions.instagram, post.category, articleUrl)

      const [fbOut, liOut, twOut, thOut, igOut] = await Promise.allSettled([
        publishToFacebook(fbCopy,   post.heroImageUrl),
        publishToLinkedIn(liCopy,   post.heroImageUrl),
        publishToX(twCopy,          post.heroImageUrl),
        publishToThreads(thCopy,    post.heroImageUrl),
        publishToInstagram(igCopy,  post.heroImageUrl),
      ])

      function outcome(r: PromiseSettledResult<{ postSubmissionId: string }>, label: string) {
        return r.status === 'fulfilled'
          ? { postSubmissionId: r.value.postSubmissionId }
          : { error: r.reason instanceof Error ? r.reason.message : `${label} failed` }
      }

      social = {
        facebook:  outcome(fbOut, 'Facebook'),
        linkedin:  outcome(liOut, 'LinkedIn'),
        twitter:   outcome(twOut, 'X / Twitter'),
        threads:   outcome(thOut, 'Threads'),
        instagram: outcome(igOut, 'Instagram'),
      }
    }

    return res.status(200).json({ ok: true, social })
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? 'Publish failed' })
  }
}
