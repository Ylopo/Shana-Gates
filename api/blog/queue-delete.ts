import { checkAdminAuth } from '../../lib/admin-auth'
import { deleteQueuedPost } from '../../lib/blog-redis'


export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = checkAdminAuth(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

  const { slug } = req.body ?? {}
  if (!slug || typeof slug !== 'string') return res.status(400).json({ error: 'slug required' })

  try {
    await deleteQueuedPost(slug)
    return res.status(200).json({ ok: true })
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? 'Delete failed' })
  }
}
