/**
 * api/blog/seed-history-ideas.ts
 *
 * One-shot endpoint to inject pre-curated Palm Springs history/celebrity
 * story ideas directly into the idea queue.
 *
 * Auth: ?secret=ADMIN_SECRET (same secret as the assistant login)
 * Method: POST or GET
 */

import { seedEvergreenHistoryIdeas } from '../../lib/history-seeds'

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const secret = process.env.ADMIN_SECRET
  const provided = req.query?.secret ?? req.body?.secret
  if (secret && provided !== secret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const count = await seedEvergreenHistoryIdeas()
    return res.status(200).json({ ok: true, seeded: count })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
}
