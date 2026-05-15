/**
 * api/blog/seed-history-ideas.ts
 *
 * Injects pre-curated Palm Springs history/celebrity story articles
 * directly into the blog picker's daily_articles store so they appear
 * alongside Tavily research results.
 *
 * Auth: ?secret=ADMIN_SECRET
 * Method: POST or GET
 */

import { getDailyArticles, storeDailyArticles } from '../../lib/blog-store'
import { getHistoryAsScoredArticles } from '../../lib/history-seeds'

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
    const today = new Date().toISOString().split('T')[0]

    // Get whatever is already stored for today (may be empty)
    const existing = await getDailyArticles(today)
    const existingIds = new Set(existing.map((a) => a.id))

    // Merge history articles in — skip any already present
    const historyArticles = getHistoryAsScoredArticles().filter((a) => !existingIds.has(a.id))
    const merged = [...existing, ...historyArticles]

    await storeDailyArticles(today, merged)

    return res.status(200).json({
      ok: true,
      date: today,
      existingCount: existing.length,
      historyAdded: historyArticles.length,
      total: merged.length,
    })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
}
