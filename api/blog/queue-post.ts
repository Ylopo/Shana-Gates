import { checkAdminAuth } from '../../lib/admin-auth'
import { getPostBySlug } from '../../lib/blog-redis'
import { getFHResult } from '../../lib/fair-housing'


export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const auth = checkAdminAuth(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

  const { slug } = req.query
  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'slug required' })
  }

  const post = await getPostBySlug(slug)
  if (!post) return res.status(404).json({ error: 'Post not found' })

  const fairHousing = await getFHResult(slug).catch(() => null)

  res.setHeader('Cache-Control', 'private, no-store')
  return res.status(200).json({ post, fairHousing })
}
