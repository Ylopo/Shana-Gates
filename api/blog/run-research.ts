/**
 * POST /api/blog/run-research?type=weekly|daily
 * Manually triggers research pipelines from the admin UI.
 * Auth: sg_assistant_session cookie OR ?secret=ADMIN_SECRET query param
 *       (matches /api/content/ideas — works regardless of how the admin
 *       page was opened).
 *
 * Imports are static (not dynamic) so Vercel's file-tracer bundles
 * lib/research.ts and lib/weekly-research.ts into /var/task. Dynamic
 * imports here previously produced ERR_MODULE_NOT_FOUND at runtime.
 */
import { createHmac } from 'crypto'
import { runWeeklyResearch } from '../../lib/weekly-research'
import { runDailyResearch } from '../../lib/research'
import { storeWeeklyTopics, storeDailyArticles, incrementShownCount } from '../../lib/blog-store'

const COOKIE_NAME = 'sg_assistant_session'

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {}
  return Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=')
      return [k.trim(), v.join('=')]
    })
  )
}

function verifyToken(token: string, secret: string): boolean {
  const lastDot = token.lastIndexOf('.')
  if (lastDot === -1) return false
  const payload = token.slice(0, lastDot)
  const sig = token.slice(lastDot + 1)
  const expected = createHmac('sha256', secret).update(payload).digest('hex')
  return sig === expected
}

function isAuthed(req: any, secret: string): boolean {
  if (req.query?.secret === secret) return true
  const cookies = parseCookies(req.headers?.cookie)
  const token = cookies[COOKIE_NAME]
  return !!(token && verifyToken(token, secret))
}

export const config = { maxDuration: 120 }

function fail(res: any, phase: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  const stack   = err instanceof Error ? err.stack  : undefined
  console.error(`[run-research] ${phase} failed:`, err)
  return res.status(500).json({ error: `${phase}: ${message}`, phase, stack })
}

export default async function handler(req: any, res: any) {
  // Wrap the entire handler so even import-time crashes return JSON instead
  // of FUNCTION_INVOCATION_FAILED.
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const secret = process.env.ADMIN_SECRET
    if (!secret) return res.status(500).json({ error: 'ADMIN_SECRET env var is not set' })

    if (!isAuthed(req, secret)) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const type = (req.query?.type ?? 'weekly') as string

    // ── Preflight: required env vars ───────────────────────────────────────
    const required = type === 'daily'
      ? ['TAVILY_API_KEY', 'ANTHROPIC_API_KEY', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']
      : ['ANTHROPIC_API_KEY', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']
    const missing = required.filter((k) => !process.env[k])
    if (missing.length) {
      return res.status(500).json({ error: `Missing env vars: ${missing.join(', ')}` })
    }

    if (type === 'weekly') {
      try {
        const topics = await runWeeklyResearch()
        if (topics.length === 0) return res.status(200).json({ ok: true, count: 0, topics: [] })
        await storeWeeklyTopics(topics)
        return res.status(200).json({ ok: true, count: topics.length, topics })
      } catch (err) { return fail(res, 'runWeeklyResearch', err) }
    }

    if (type === 'daily') {
      const today = new Date().toISOString().split('T')[0]
      let articles: any[]
      try {
        articles = await runDailyResearch(today)
      } catch (err) { return fail(res, 'runDailyResearch', err) }

      if (!articles || articles.length === 0) {
        return res.status(200).json({ ok: true, count: 0, articles: [] })
      }

      try {
        await Promise.all(articles.map((a: any) => incrementShownCount(a.id)))
      } catch (err) { return fail(res, 'incrementShownCount', err) }

      try {
        await storeDailyArticles(today, articles)
      } catch (err) { return fail(res, 'storeDailyArticles', err) }

      return res.status(200).json({ ok: true, count: articles.length, date: today })
    }

    return res.status(400).json({ error: 'type must be weekly or daily' })
  } catch (err) {
    return fail(res, 'handler', err)
  }
}
