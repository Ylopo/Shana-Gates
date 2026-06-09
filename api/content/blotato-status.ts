import { checkAdminAuth } from '../../lib/admin-auth'
import { getPostStatus } from '../../lib/blotato-client'
import { setYouTubeUrl } from '../../lib/blog-redis'


export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const auth = checkAdminAuth(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

  const postSubmissionId = req.query?.postSubmissionId
  if (!postSubmissionId || typeof postSubmissionId !== 'string') {
    return res.status(400).json({ error: 'postSubmissionId is required' })
  }

  // Optional context — when the editor polls the YouTube submission specifically,
  // it passes the blog post slug + platform=youtube. On a 'published' response we
  // persist the watch URL onto the post so the blog page can embed it.
  const slug = typeof req.query?.slug === 'string' ? req.query.slug : null
  const platform = typeof req.query?.platform === 'string' ? req.query.platform : null

  try {
    const result = await getPostStatus(postSubmissionId)

    if (
      result.status === 'published' &&
      result.postUrl &&
      slug &&
      platform === 'youtube'
    ) {
      // Fire-and-forget capture — the poll response should still return promptly
      // even if Redis is slow. Errors are logged but don't fail the status call.
      setYouTubeUrl(slug, result.postUrl, postSubmissionId).catch((err) => {
        console.error('[blotato-status] setYouTubeUrl failed:', err)
      })
    }

    return res.status(200).json(result)
  } catch (err: any) {
    console.error('[blotato-status]', err)
    return res.status(500).json({ error: err?.message ?? 'Status check failed' })
  }
}
