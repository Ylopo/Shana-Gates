import { checkAdminAuth } from '../../lib/admin-auth'
import { getPostStatus } from '../../lib/blotato-client'


export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const auth = checkAdminAuth(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

  const postSubmissionId = req.query?.postSubmissionId
  if (!postSubmissionId || typeof postSubmissionId !== 'string') {
    return res.status(400).json({ error: 'postSubmissionId is required' })
  }

  try {
    const result = await getPostStatus(postSubmissionId)
    return res.status(200).json(result)
  } catch (err: any) {
    console.error('[blotato-status]', err)
    return res.status(500).json({ error: err?.message ?? 'Status check failed' })
  }
}
