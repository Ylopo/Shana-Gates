import { checkAdminAuth } from '../../lib/admin-auth'
import { getQueuedPosts } from '../../lib/blog-redis'


export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const auth = checkAdminAuth(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

  const posts = await getQueuedPosts()
  res.setHeader('Cache-Control', 'private, no-store')
  return res.status(200).json({ posts })
}
