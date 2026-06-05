import { checkAdminAuth } from '../../lib/admin-auth'
import { generateHeyGenVideo } from '../../lib/heygen-client'


export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = checkAdminAuth(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

  const { script } = req.body ?? {}
  if (!script?.trim()) return res.status(400).json({ error: 'script is required' })

  try {
    const videoId = await generateHeyGenVideo(script.trim())
    return res.status(200).json({ videoId })
  } catch (err: any) {
    console.error('[generate-heygen-video]', err)
    return res.status(500).json({ error: err?.message ?? 'Failed to start video generation' })
  }
}
