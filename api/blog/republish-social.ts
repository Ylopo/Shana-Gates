/**
 * POST /api/blog/republish-social
 * Body: { slug: string, mode?: 'image' | 'video' | 'both' }
 *
 * Re-fires the Blotato social-publish for an already-published post — used
 * to recover when a post went live on the website but the Blotato calls
 * silently failed (missing env var, account disconnected, earlier 401,
 * etc.).
 *
 * Also returns a `diagnostics` block listing which BLOTATO_* env vars are
 * set, the post's heroImageUrl + videoUrl, and the per-platform Blotato
 * response (or error message) so the operator can see exactly what
 * happened for each platform without needing to dig in Vercel logs.
 */
import { checkAdminAuth } from '../../lib/admin-auth'
import { getPostBySlug } from '../../lib/blog-redis'
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

export const config = { maxDuration: 60 }

const BLOTATO_ENV_VARS = [
  'BLOTATO_API_KEY',
  'BLOTATO_FACEBOOK_ACCOUNT_ID',
  'BLOTATO_FACEBOOK_PAGE_ID',
  'BLOTATO_YOUTUBE_ACCOUNT_ID',
  'BLOTATO_TIKTOK_ACCOUNT_ID',
  'BLOTATO_LINKEDIN_ACCOUNT_ID',
  'BLOTATO_X_ACCOUNT_ID',
  'BLOTATO_THREADS_ACCOUNT_ID',
  'BLOTATO_INSTAGRAM_ACCOUNT_ID',
] as const

type ModeOption = 'image' | 'video' | 'both'

function outcome(r: PromiseSettledResult<{ postSubmissionId: string }>, label: string) {
  return r.status === 'fulfilled'
    ? { ok: true,  postSubmissionId: r.value.postSubmissionId }
    : { ok: false, error: r.reason instanceof Error ? r.reason.message : `${label} failed` }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = checkAdminAuth(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

  const { slug, mode = 'both' } = (req.body ?? {}) as { slug?: string; mode?: ModeOption }
  if (!slug) return res.status(400).json({ error: 'slug is required' })

  // ── Diagnostics: which env vars are set? ─────────────────────────────────
  const envStatus: Record<string, boolean> = {}
  for (const k of BLOTATO_ENV_VARS) envStatus[k] = !!process.env[k]
  const missingEnv = BLOTATO_ENV_VARS.filter((k) => !process.env[k])

  const post = await getPostBySlug(slug)
  if (!post) return res.status(404).json({ error: 'Post not found', diagnostics: { envStatus, missingEnv } })

  const articleUrl = `${SITE_URL}/blog/post.html?slug=${post.slug}`

  // ── Build captions (per-platform stored values → socialCopy fallback → generated) ──
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

  // Hard-fail early when BLOTATO_API_KEY is missing so the UI shows the real cause
  if (missingEnv.includes('BLOTATO_API_KEY')) {
    return res.status(200).json({
      ok: false,
      error: 'BLOTATO_API_KEY is not set in Vercel env vars — nothing was published.',
      diagnostics: { envStatus, missingEnv, post: { slug: post.slug, status: post.workflowStatus, heroImageUrl: post.heroImageUrl, videoUrl: post.videoUrl } },
    })
  }

  const wantImage = mode === 'image' || mode === 'both'
  const wantVideo = mode === 'video' || mode === 'both'
  const haveImage = !!post.heroImageUrl
  const haveVideo = !!post.videoUrl

  const results: Record<string, any> = {}

  // ── Image-based platforms (5) — run if we want image mode and have a hero ──
  if (wantImage && haveImage) {
    const fbCopy = `${captions.facebook}\n\n${articleUrl}`
    const liCopy = buildLinkedInCaption(captions.linkedin, post.category, articleUrl)
    const twCopy = buildXCaption(captions.twitter, post.category, articleUrl)
    const thCopy = buildThreadsCaption(captions.threads, articleUrl)
    const igCopy = buildInstagramCaption(captions.instagram, post.category, articleUrl)

    const [fbOut, liOut, twOut, thOut, igOut] = await Promise.allSettled([
      publishToFacebook(fbCopy,   post.heroImageUrl!),
      publishToLinkedIn(liCopy,   post.heroImageUrl!),
      publishToX(twCopy,          post.heroImageUrl!),
      publishToThreads(thCopy,    post.heroImageUrl!),
      publishToInstagram(igCopy,  post.heroImageUrl!),
    ])
    results.facebook  = outcome(fbOut, 'Facebook')
    results.linkedin  = outcome(liOut, 'LinkedIn')
    results.twitter   = outcome(twOut, 'X / Twitter')
    results.threads   = outcome(thOut, 'Threads')
    results.instagram = outcome(igOut, 'Instagram')
  } else if (wantImage && !haveImage) {
    results._imageSkipped = 'Post has no heroImageUrl — image publish skipped.'
  }

  // ── Video-based platforms (7) — run if we want video mode and have a video URL ──
  if (wantVideo && haveVideo) {
    const fbCopy = `${captions.facebook}\n\n${articleUrl}`
    const ytDesc = `${captions.youtube}\n\n${articleUrl}`
    const liCopy = buildLinkedInCaption(captions.linkedin, post.category, articleUrl)
    const twCopy = buildXCaption(captions.twitter, post.category, articleUrl)
    const ttCopy = buildTikTokCaption(captions.tiktok, post.category, articleUrl)
    const thCopy = buildThreadsCaption(captions.threads, articleUrl)
    const igCopy = buildInstagramCaption(captions.instagram, post.category, articleUrl)

    const [reelOut, ytOut, ttOut, liOut, twOut, thOut, igOut] = await Promise.allSettled([
      publishToFacebookReel(fbCopy, post.videoUrl!),
      publishToYouTube(post.title, ytDesc, post.videoUrl!, post.videoThumbnailUrl),
      publishToTikTok(ttCopy, post.videoUrl!),
      publishToLinkedIn(liCopy, post.videoUrl!),
      publishToX(twCopy, post.videoUrl!),
      publishToThreads(thCopy, post.videoUrl!),
      publishToInstagramReel(igCopy, post.videoUrl!),
    ])
    results.facebookReel  = outcome(reelOut, 'Facebook Reel')
    results.youtube       = outcome(ytOut,   'YouTube')
    results.tiktok        = outcome(ttOut,   'TikTok')
    results.linkedinVideo = outcome(liOut,   'LinkedIn (video)')
    results.twitterVideo  = outcome(twOut,   'X / Twitter (video)')
    results.threadsVideo  = outcome(thOut,   'Threads (video)')
    results.instagramReel = outcome(igOut,   'Instagram Reel')
  } else if (wantVideo && !haveVideo) {
    results._videoSkipped = 'Post has no videoUrl — video publish skipped.'
  }

  return res.status(200).json({
    ok: true,
    results,
    diagnostics: {
      envStatus,
      missingEnv,
      post: {
        slug: post.slug,
        title: post.title,
        status: post.workflowStatus,
        heroImageUrl: post.heroImageUrl,
        videoUrl: post.videoUrl,
        videoThumbnailUrl: post.videoThumbnailUrl,
        hasStoredCaptions: !!post.captions,
      },
      mode,
    },
  })
}
