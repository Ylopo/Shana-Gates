/**
 * OneUp API client — replaces lib/blotato-client.ts as the social
 * publishing backend.
 *
 * Base URL: https://www.oneupapp.io/api/
 * Auth:     ?apiKey={key} query param
 * Docs:     https://docs.oneupapp.io/docs/overview
 *
 * Env vars required:
 *   ONEUP_API_KEY                 — API key from oneupapp.io/api-access
 *   ONEUP_CATEGORY_ID             — Shana's "Shana Gates" category (179200)
 *   ONEUP_YOUTUBE_CHANNEL_ID      — YouTube channel UC...
 *
 * Architectural notes vs Blotato:
 *   - OneUp posts to ALL connected accounts in the category in a single
 *     call (social_network_id=ALL). Shana's category has YouTube,
 *     Instagram, TikTok, and Facebook connected — no Google Business
 *     Profile, so ALL is safe.
 *   - OneUp does NOT return a postSubmissionId — there is no
 *     status-by-id endpoint. To capture the YouTube watch URL we poll
 *     Shana's YouTube channel RSS feed separately (lib/youtube-rss.ts).
 *   - OneUp accepts ONE shared `content` text + a separate `title`
 *     (used by YouTube + Reddit). We map post.socialCopy → content
 *     and post.title → title.
 */

const BASE_URL = 'https://www.oneupapp.io/api'

function getApiKey(): string {
  const key = process.env.ONEUP_API_KEY
  if (!key) throw new Error('ONEUP_API_KEY env var is not set')
  return key
}

function getCategoryId(): string {
  const id = process.env.ONEUP_CATEGORY_ID
  if (!id) throw new Error('ONEUP_CATEGORY_ID env var is not set')
  return id
}

export function getYouTubeChannelId(): string {
  const id = process.env.ONEUP_YOUTUBE_CHANNEL_ID
  if (!id) throw new Error('ONEUP_YOUTUBE_CHANNEL_ID env var is not set')
  return id
}

export interface OneUpScheduleResult {
  ok: boolean
  message: string
  raw?: any
}

// Format a Date as "YYYY-MM-DD HH:MM" in **US Pacific Time**.
//
// OneUp interprets scheduled_date_time in the account's local timezone.
// Shana's connected accounts + OneUp account preferences are set to
// Pacific (she's in Coachella Valley, CA), so we format in PT. If we
// send the timestamp in any other zone, OneUp reads the same clock-face
// digits as Pacific and the post lands several hours in the future —
// sitting in the scheduled queue until that wall-clock time arrives.
//
// Vercel functions run in UTC, so we explicitly convert via Intl.
function formatOneUpDateTime(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
}

/**
 * Schedule a video post to fire ~immediately across all connected
 * accounts in the "Shana Gates" category.
 *
 * - `videoUrl` must be a publicly accessible MP4 URL (Vercel Blob is fine).
 * - `title` is used by YouTube as the video title.
 * - `content` is the shared caption across all networks. We rely on the
 *   master `socialCopy` field for this; per-platform caption tuning is
 *   not supported in the OneUp text payload (OneUp only exposes per-
 *   platform JSON options like isReel, playlist_id, music — not text).
 */
export async function scheduleVideoNow(params: {
  title: string
  content: string
  videoUrl: string
  thumbnailUrl?: string
}): Promise<OneUpScheduleResult> {
  const apiKey = getApiKey()
  const categoryId = getCategoryId()

  // Per OneUp docs: "For immediate publishing, set scheduled_date_time
  // to the current timestamp." Past timestamps are NOT treated as
  // immediate — they sit in the scheduled queue indefinitely. We format
  // the exact current moment in US Eastern (OneUp's account timezone).
  const scheduledAt = formatOneUpDateTime(new Date())

  const form = new URLSearchParams()
  form.set('apiKey', apiKey)
  form.set('category_id', categoryId)
  form.set('social_network_id', 'ALL')
  form.set('scheduled_date_time', scheduledAt)
  form.set('title', params.title)
  form.set('content', params.content)
  form.set('video_url', params.videoUrl)
  if (params.thumbnailUrl) form.set('thumbnail_url', params.thumbnailUrl)

  const res = await fetch(`${BASE_URL}/schedulevideopost`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  })

  const raw = await res.text()
  let data: any = null
  try { data = JSON.parse(raw) } catch { /* non-JSON */ }

  if (!res.ok) {
    return { ok: false, message: data?.message ?? raw ?? `HTTP ${res.status}`, raw: data ?? raw }
  }

  if (data?.error) {
    return { ok: false, message: data?.message ?? 'OneUp returned error=true', raw: data }
  }

  return { ok: true, message: data?.message ?? 'OK', raw: data }
}
