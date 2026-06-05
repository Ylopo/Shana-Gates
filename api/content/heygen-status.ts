import { checkAdminAuth } from '../../lib/admin-auth'
import { put } from '@vercel/blob'
import { getHeyGenVideoStatus } from '../../lib/heygen-client'


export const config = { maxDuration: 60 }

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const auth = checkAdminAuth(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

  const videoId = req.query?.videoId
  if (!videoId || typeof videoId !== 'string') return res.status(400).json({ error: 'videoId is required' })

  try {
    const result = await getHeyGenVideoStatus(videoId)

    if (result.status !== 'completed') {
      return res.status(200).json(result)
    }

    // Stream the video from HeyGen into Vercel Blob for a permanent URL
    const videoRes = await fetch(result.videoUrl, { signal: AbortSignal.timeout(50000) })
    if (!videoRes.ok) throw new Error(`Failed to fetch HeyGen video (${videoRes.status})`)

    const blob = await put(`heygen-${videoId}.mp4`, videoRes.body!, {
      access: 'public',
      contentType: 'video/mp4',
    })

    return res.status(200).json({
      status: 'completed',
      videoUrl: blob.url,
      duration: result.duration,
    })
  } catch (err: any) {
    console.error('[heygen-status]', err)
    return res.status(500).json({ error: err?.message ?? 'Status check failed' })
  }
}
