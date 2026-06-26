import { checkAdminAuth } from '../../lib/admin-auth'
import { generateHeyGenVideo } from '../../lib/heygen-client'
import { normalizeScriptForSpeech } from '../../lib/normalize-speech'


export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = checkAdminAuth(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

  const { script } = req.body ?? {}
  if (!script?.trim()) return res.status(400).json({ error: 'script is required' })

  // Run the script through the spoken-English normalizer before HeyGen sees
  // it. Years, prices, percentages, square footage, etc. get rewritten so
  // the avatar reads them naturally instead of robotically saying "twenty
  // twenty-six" as "two zero two six," "$1.5M" as "dollar sign one point
  // five em," and so on. URLs / hashtags / @-handles / emails are
  // preserved verbatim.
  const normalizedScript = normalizeScriptForSpeech(script.trim())

  try {
    const videoId = await generateHeyGenVideo(normalizedScript)
    return res.status(200).json({ videoId, normalizedScript })
  } catch (err: any) {
    console.error('[generate-heygen-video]', err)
    return res.status(500).json({ error: err?.message ?? 'Failed to start video generation' })
  }
}
