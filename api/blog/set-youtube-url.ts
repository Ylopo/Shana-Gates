/**
 * POST /api/blog/set-youtube-url
 *
 * Manual / backfill endpoint for setting a blog post's YouTube watch URL.
 * Used for backfilling already-published posts that pre-date the auto-capture
 * flow, and for manual fixups when an operator needs to set/correct the URL.
 *
 * Body:
 *   { slug: string, youtubeUrl: string, youtubeSubmissionId?: string }
 *
 * Validates that youtubeUrl is a YouTube watch URL (rejects anything else).
 * Returns 200 { ok: true, slug, videoId } on success.
 */
import { checkAdminAuth } from '../../lib/admin-auth'
import { setYouTubeUrl } from '../../lib/blog-redis'

// Accepts standard watch URLs, youtu.be short URLs, and channel-attribution
// query strings. Returns the 11-char video ID, or null if not recognized.
function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0]
      return /^[\w-]{11}$/.test(id) ? id : null
    }
    if (u.hostname.endsWith('youtube.com') || u.hostname.endsWith('youtube-nocookie.com')) {
      // /watch?v=ID
      const v = u.searchParams.get('v')
      if (v && /^[\w-]{11}$/.test(v)) return v
      // /shorts/ID or /embed/ID or /live/ID
      const m = u.pathname.match(/\/(?:shorts|embed|live)\/([\w-]{11})/)
      if (m) return m[1]
    }
  } catch (_) {}
  return null
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = checkAdminAuth(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

  const { slug, youtubeUrl, youtubeSubmissionId } = req.body ?? {}
  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'slug required' })
  }
  if (!youtubeUrl || typeof youtubeUrl !== 'string') {
    return res.status(400).json({ error: 'youtubeUrl required' })
  }
  const videoId = extractVideoId(youtubeUrl)
  if (!videoId) {
    return res.status(400).json({ error: 'youtubeUrl is not a recognized YouTube watch URL' })
  }

  try {
    await setYouTubeUrl(
      slug,
      youtubeUrl,
      typeof youtubeSubmissionId === 'string' ? youtubeSubmissionId : undefined,
    )
    return res.status(200).json({ ok: true, slug, videoId })
  } catch (err: any) {
    console.error('[set-youtube-url]', err)
    return res.status(500).json({ error: err?.message ?? 'Failed to set youtubeUrl' })
  }
}
