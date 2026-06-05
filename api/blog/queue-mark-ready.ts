import { checkAdminAuth } from '../../lib/admin-auth'
import { markPostReady, uploadImageAsset } from '../../lib/blog-redis'


export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = checkAdminAuth(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

  const { slug, socialCopy, heroImageBase64, heroImageUrl, title, videoScript, videoUrl, videoThumbnailUrl, captions } = req.body ?? {}
  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'slug required' })
  }

  let finalHeroImageUrl: string | undefined = heroImageUrl || undefined

  // If a new thumbnail was uploaded as base64, upload it to Vercel Blob
  if (heroImageBase64 && typeof heroImageBase64 === 'string') {
    try {
      const base64Data = heroImageBase64.split(',')[1] ?? heroImageBase64
      const buffer = Buffer.from(base64Data, 'base64')
      finalHeroImageUrl = await uploadImageAsset(
        buffer,
        `thumbnail-${slug}-${Date.now()}.jpg`,
        'image/jpeg'
      )
    } catch (err: any) {
      return res.status(500).json({ error: `Image upload failed: ${err?.message}` })
    }
  }

  try {
    await markPostReady(
      slug,
      socialCopy ?? '',
      finalHeroImageUrl,
      title ?? undefined,
      videoScript ?? undefined,
      videoUrl ?? undefined,
      videoThumbnailUrl ?? undefined,
      captions && typeof captions === 'object' ? captions : undefined,
    )
    return res.status(200).json({ ok: true })
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? 'Failed to mark ready' })
  }
}
