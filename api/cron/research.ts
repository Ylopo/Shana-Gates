import { runDailyResearch } from '../../lib/research'
import { storeDailyArticles, incrementShownCount } from '../../lib/blog-store'
import { sendDailyDigest, sendIdeaDigest } from '../../lib/blog-email'
import { getPendingIdeas } from '../../lib/idea-store'

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Auth: Vercel cron sends Authorization header, or manual trigger sends secret in body/query
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.authorization
    const bodySecret = req.body?.secret
    const querySecret = req.query?.secret
    if (
      authHeader !== `Bearer ${cronSecret}` &&
      bodySecret !== cronSecret &&
      querySecret !== cronSecret
    ) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  try {
    const today = new Date().toISOString().split('T')[0]

    console.log(`[research] Running daily research for ${today}`)
    const articles = await runDailyResearch(today)
    console.log(`[research] Scored ${articles.length} articles`)

    if (articles.length === 0) {
      console.log('[research] No articles found, skipping email')
      return res.status(200).json({ ok: true, articlesFound: 0 })
    }

    // Track shown counts
    await Promise.all(articles.map((a) => incrementShownCount(a.id)))

    // Store in Redis
    await storeDailyArticles(today, articles)
    console.log(`[research] Stored ${articles.length} articles in Redis`)

    // Send article digest email (for blog picker)
    await sendDailyDigest(today, articles)
    console.log('[research] Sent daily digest email')

    // Send idea digest email (for idea review)
    const ideas = await getPendingIdeas()
    if (ideas.length > 0) {
      await sendIdeaDigest(ideas)
      console.log(`[research] Sent idea digest email (${ideas.length} ideas)`)
    }

    return res.status(200).json({ ok: true, articlesFound: articles.length, ideasQueued: ideas?.length ?? 0, date: today })
  } catch (err) {
    console.error('[research] Error:', err)
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
}
