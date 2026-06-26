/**
 * POST /api/blog/fh-resolve
 *
 * Resolves a single Fair Housing violation on a queued post from the VA editor.
 *
 * Body: { slug: string, violationId: string, action: 'fix' | 'ignore' }
 *
 *   fix    — replace the offending phrase (violation.excerpt) with the AI's
 *            compliant suggestion across the post title, excerpt, body, and any
 *            existing captions/socialCopy, then mark the violation 'fixed'.
 *   ignore — mark the violation 'ignored' (left in the content as-is).
 *
 * After either action the result's top-level severity is recomputed and saved.
 * Publishing stays blocked (see queue-publish) while any hard violation is
 * still 'open'.
 */
import { checkAdminAuth } from '../../lib/admin-auth'
import { getPostBySlug, applyContentEdit, type PlatformCaptions } from '../../lib/blog-redis'
import { getFHResult, saveFHResult, recomputeSeverity } from '../../lib/fair-housing'

function replaceAll(haystack: string, find: string, replace: string): string {
  if (!find) return haystack
  return haystack.split(find).join(replace)
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = checkAdminAuth(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

  const { slug, violationId, action } = req.body ?? {}
  if (!slug || typeof slug !== 'string') return res.status(400).json({ error: 'slug required' })
  if (!violationId || typeof violationId !== 'string') {
    return res.status(400).json({ error: 'violationId required' })
  }
  if (action !== 'fix' && action !== 'ignore') {
    return res.status(400).json({ error: "action must be 'fix' or 'ignore'" })
  }

  const result = await getFHResult(slug)
  if (!result) return res.status(404).json({ error: 'No Fair Housing result for this post' })

  const violation = result.violations.find((v) => v.id === violationId)
  if (!violation) return res.status(404).json({ error: 'Violation not found' })

  let updatedPost = null

  if (action === 'fix') {
    const post = await getPostBySlug(slug)
    if (!post) return res.status(404).json({ error: 'Post not found' })

    const { excerpt, suggestion } = violation
    const captions: PlatformCaptions = { ...(post.captions || {}) }
    for (const k of Object.keys(captions) as (keyof PlatformCaptions)[]) {
      if (typeof captions[k] === 'string') captions[k] = replaceAll(captions[k] as string, excerpt, suggestion)
    }

    updatedPost = await applyContentEdit(slug, {
      title: replaceAll(post.title, excerpt, suggestion),
      excerpt: replaceAll(post.excerpt, excerpt, suggestion),
      body: replaceAll(post.body, excerpt, suggestion),
      socialCopy: post.socialCopy ? replaceAll(post.socialCopy, excerpt, suggestion) : undefined,
      captions: post.captions ? captions : undefined,
    })
    violation.status = 'fixed'
  } else {
    violation.status = 'ignored'
  }

  result.severity = recomputeSeverity(result.violations)
  await saveFHResult(slug, result)

  return res.status(200).json({
    ok: true,
    fairHousing: result,
    post: updatedPost
      ? { title: updatedPost.title, excerpt: updatedPost.excerpt, body: updatedPost.body }
      : null,
  })
}
