/**
 * HeyGen API client — uses the v3 endpoint to force the newer Avatar V engine.
 *
 * Videos are 9:16 vertical at 720p — optimised for YouTube Shorts, TikTok,
 * Instagram Reels.
 *
 * Why v3 + avatar_v:
 *   HeyGen's older v2 endpoint (/v2/video/generate) defaults to the Avatar IV
 *   engine, which in HeyGen's UI shows up as "model 3" / older quality. The
 *   newer Avatar V engine ("model 5" — significantly better lipsync and
 *   identity preservation for digital twins) is ONLY available through the
 *   v3 endpoint (/v3/videos) with an explicit `engine: { type: "avatar_v" }`
 *   field. Without forcing this, HeyGen falls back to the older Avatar IV
 *   model and the operator has to bump it manually in the HeyGen UI after
 *   each render — wasted clicks.
 *
 * Per-client portability:
 *   The avatar look must support avatar_v (check via GET /v3/avatars/looks/{id}
 *   — its supported_api_engines list should include "avatar_v"). If a new
 *   client's avatar doesn't support v5 yet, set HEYGEN_ENGINE=avatar_iv in
 *   that client's Vercel env to fall back to the previous engine.
 *
 * Env vars required:
 *   HEYGEN_API_KEY         — HeyGen API key
 *   HEYGEN_AVATAR_LOOK_ID  — Avatar look ID (specific outfit/appearance variant)
 *   HEYGEN_VOICE_ID        — Voice ID to use for speech synthesis
 *
 * Env vars optional:
 *   HEYGEN_ENGINE          — "avatar_v" (default) or "avatar_iv"
 */

const BASE_URL = 'https://api.heygen.com'

function getHeaders(): Record<string, string> {
  const key = process.env.HEYGEN_API_KEY
  if (!key) throw new Error('HEYGEN_API_KEY env var is not set')
  return {
    'X-Api-Key': key,
    'Content-Type': 'application/json',
  }
}

export type HeyGenVideoStatus =
  | { status: 'processing' }
  | { status: 'completed'; videoUrl: string; duration?: number }
  | { status: 'failed'; error?: string }

export async function generateHeyGenVideo(script: string): Promise<string> {
  const avatarLookId = process.env.HEYGEN_AVATAR_LOOK_ID
  const voiceId = process.env.HEYGEN_VOICE_ID
  const engine = process.env.HEYGEN_ENGINE || 'avatar_v'

  if (!avatarLookId) throw new Error('HEYGEN_AVATAR_LOOK_ID env var is not set')
  if (!voiceId) throw new Error('HEYGEN_VOICE_ID env var is not set')

  const res = await fetch(`${BASE_URL}/v3/videos`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      type: 'avatar',
      avatar_id: avatarLookId,
      script,
      voice_id: voiceId,
      engine: { type: engine },
      aspect_ratio: '9:16',
      resolution: '720p',
      voice_settings: { speed: 1.0 },
      title: 'Shana Gates blog video',
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    const msg = data?.error?.message ?? data?.message ?? JSON.stringify(data)
    throw new Error(`HeyGen generate failed (${res.status}): ${msg}`)
  }

  const videoId = data?.data?.video_id
  if (!videoId) throw new Error(`HeyGen response missing video_id: ${JSON.stringify(data)}`)
  return String(videoId)
}

export async function getHeyGenVideoStatus(videoId: string): Promise<HeyGenVideoStatus> {
  const res = await fetch(`${BASE_URL}/v3/videos/${encodeURIComponent(videoId)}`, {
    method: 'GET',
    headers: getHeaders(),
  })

  const data = await res.json()
  if (!res.ok) {
    const msg = data?.error?.message ?? data?.message ?? JSON.stringify(data)
    throw new Error(`HeyGen status check failed (${res.status}): ${msg}`)
  }
  const status = data?.data?.status

  if (status === 'completed') {
    const videoUrl = data?.data?.video_url
    if (!videoUrl) throw new Error('HeyGen completed but no video_url returned')
    return { status: 'completed', videoUrl, duration: data?.data?.duration }
  }

  if (status === 'failed') {
    // v3 surfaces failure as failure_message / failure_code; older v1 used
    // data.error. Try both so messages stay informative across versions.
    const errMsg = data?.data?.failure_message
      ?? (typeof data?.data?.error === 'object' ? JSON.stringify(data.data.error) : data?.data?.error)
      ?? 'Unknown error'
    return { status: 'failed', error: String(errMsg) }
  }

  // v3 statuses include "waiting", "pending", "processing" — all map to in-flight.
  return { status: 'processing' }
}
