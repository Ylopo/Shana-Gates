/**
 * api/blog/dashboard.ts
 * Content performance dashboard data endpoint.
 *
 * GET /api/blog/dashboard  → blog stats + per-post GA4 pageviews + site traffic
 * Auth: shared checkAdminAuth() — accepts HMAC session cookie OR ?secret=ADMIN_SECRET.
 */

import { redis } from '../../lib/blog-store'
import type { BlogPostSummary } from '../../lib/blog-redis'
import { runGA4Report } from '../../lib/ga4-client'
import { checkAdminAuth } from '../../lib/admin-auth'
import { fetchAllPlatforms } from '../../lib/oneup-analytics'

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const auth = checkAdminAuth(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

  const raw = await redis.get<string>('blog_posts_index')
  const allPosts: BlogPostSummary[] = raw
    ? (typeof raw === 'string' ? JSON.parse(raw) : raw)
    : []

  // "Since we started" baseline = the earliest published post's date. The
  // dashboard's Growth section frames the cumulative narrative around this
  // anchor: how the engine has compounded organic reach since day one.
  const allDates = allPosts.map((p) => p.publishedAt).sort()
  const launchDate = allDates[0] ? allDates[0].slice(0, 10) : null

  // Last 90 days
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)
  const recent = allPosts.filter((p) => new Date(p.publishedAt) >= cutoff)

  // Posts per week (over last 90 days = 12.86 weeks)
  const postsPerWeek = recent.length > 0 ? (recent.length / 12.86).toFixed(1) : '0.0'

  // Category breakdown
  const byCat: Record<string, number> = {}
  recent.forEach((p) => { byCat[p.category] = (byCat[p.category] || 0) + 1 })

  // Pipeline breakdown
  const byPipeline: Record<string, number> = {}
  allPosts.forEach((p) => { byPipeline[p.pipeline || 'unknown'] = (byPipeline[p.pipeline || 'unknown'] || 0) + 1 })

  // Per-post list with age in days
  const now = Date.now()
  const postsMap: Record<string, {
    slug: string; title: string; category: string; pipeline: string | undefined;
    city: string | null; publishedAt: string; ageDays: number; hasImage: boolean;
    heroImageUrl?: string | null;
    pageviews?: number; avgEngagementTime?: number;
  }> = {}
  recent.forEach((p) => {
    postsMap[p.slug] = {
      slug: p.slug,
      title: p.title,
      category: p.category,
      pipeline: p.pipeline,
      city: p.city || null,
      publishedAt: p.publishedAt,
      ageDays: Math.floor((now - new Date(p.publishedAt).getTime()) / 86400000),
      hasImage: !!p.heroImageUrl,
      heroImageUrl: p.heroImageUrl || null,
    }
  })

  let siteTraffic: { sessions: string | null; users: string | null; priorSessions: string | null } | null = null
  let ylopoClicks: { total: number } | null = null
  let topYlopoPages: { page: string; clicks: number }[] | null = null
  let cumulativeTraffic: { sessions: number; users: number; pageviews: number; sinceDate: string } | null = null
  let growthByMonth: { month: string; sessions: number; users: number; pageviews: number; posts: number; cumulativeSessions: number; cumulativeUsers: number; cumulativePageviews: number; cumulativePosts: number }[] = []
  // Diagnostic so the dashboard can tell at a glance which GA4 queries
  // returned data and which came back empty. Surfaced in the response.
  const gaDiagnostic: Record<string, number> = {}

  const gaReady = !!(process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.GOOGLE_ANALYTICS_PROPERTY_ID)
  if (gaReady) {
    // GA4 fetches: existing 30-day stats + two new queries for the Growth section
    // (cumulative-since-launch totals + monthly time-series for the climbing-curve chart).
    const sinceLaunch = launchDate || '90daysAgo'
    const [sessionRows, priorSessionRows, topPagesRows, blogPostRows, cumulativeRows, monthlyRows] = await Promise.all([
      // 30-day sessions / users
      runGA4Report({
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
      }),
      // Prior 30-day sessions (60-30 days ago) for period-over-period delta
      runGA4Report({
        dateRanges: [{ startDate: '60daysAgo', endDate: '31daysAgo' }],
        dimensions: [],
        metrics: [{ name: 'sessions' }],
      }),
      // Top YLOPO property clicks
      runGA4Report({
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'customEvent:page_slug' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: {
          filter: { fieldName: 'eventName', stringFilter: { value: 'idx_property_click' } },
        },
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 10,
      }),
      // Per-blog-post pageviews + engagement (last 30 days)
      // pagePath looks like "/blog/post.html?slug=sunnylands-..." or "/blog/post/sunnylands-..."
      runGA4Report({
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'userEngagementDuration' },
        ],
        dimensionFilter: {
          filter: { fieldName: 'pagePath', stringFilter: { matchType: 'BEGINS_WITH', value: '/blog/post' } },
        },
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 50,
      }),
      // Cumulative since launch — the headline "since we started" total.
      runGA4Report({
        dateRanges: [{ startDate: sinceLaunch, endDate: 'today' }],
        dimensions: [],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'screenPageViews' }],
      }),
      // Monthly time-series since launch — feeds the cumulative growth-curve chart.
      runGA4Report({
        dateRanges: [{ startDate: sinceLaunch, endDate: 'today' }],
        dimensions: [{ name: 'yearMonth' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'screenPageViews' }],
        orderBys: [{ dimension: { dimensionName: 'yearMonth' } }],
      }),
    ])

    gaDiagnostic.session30d = sessionRows.length
    gaDiagnostic.priorSession = priorSessionRows.length
    gaDiagnostic.topPages = topPagesRows.length
    gaDiagnostic.blogPosts = blogPostRows.length
    gaDiagnostic.cumulative = cumulativeRows.length
    gaDiagnostic.monthly = monthlyRows.length

    if (sessionRows.length > 0) {
      siteTraffic = {
        sessions: sessionRows[0]?.metricValues[0]?.value ?? null,
        users: sessionRows[0]?.metricValues[1]?.value ?? null,
        priorSessions: priorSessionRows[0]?.metricValues[0]?.value ?? null,
      }
    }

    if (topPagesRows.length > 0) {
      const pages = topPagesRows.map((r) => ({
        page: r.dimensionValues[0].value,
        clicks: parseInt(r.metricValues[0].value, 10),
      }))
      ylopoClicks = { total: pages.reduce((sum, p) => sum + p.clicks, 0) }
      topYlopoPages = pages
    } else {
      ylopoClicks = { total: 0 }
      topYlopoPages = []
    }

    // Cumulative-since-launch totals — prefer the dedicated cumulative query;
    // fall back to combining the 30-day + prior-30-day rows so the Climb
    // section still renders something when the cumulative query times out
    // or the GA4 property is too new to have a full launch-to-today range.
    if (cumulativeRows.length > 0 && launchDate) {
      cumulativeTraffic = {
        sessions: parseInt(cumulativeRows[0]?.metricValues[0]?.value ?? '0', 10) || 0,
        users: parseInt(cumulativeRows[0]?.metricValues[1]?.value ?? '0', 10) || 0,
        pageviews: parseInt(cumulativeRows[0]?.metricValues[2]?.value ?? '0', 10) || 0,
        sinceDate: launchDate,
      }
    } else if (sessionRows.length > 0 && launchDate) {
      // Fallback synthesis: combine last-30 + prior-30 as an approximation.
      const recent30 = parseInt(sessionRows[0]?.metricValues[0]?.value ?? '0', 10) || 0
      const recentUsers = parseInt(sessionRows[0]?.metricValues[1]?.value ?? '0', 10) || 0
      const prior30 = parseInt(priorSessionRows[0]?.metricValues[0]?.value ?? '0', 10) || 0
      cumulativeTraffic = {
        sessions: recent30 + prior30,
        users: recentUsers,                // approximation — users overlap so this slightly undercounts
        pageviews: recent30 + prior30,     // approximation — same shape as sessions when pageviews query failed
        sinceDate: launchDate,
      }
      gaDiagnostic.cumulativeFallback = 1
    }

    // Monthly time-series — combine GA4 traffic with the per-month post count
    // from Redis, then accumulate so each entry carries running totals (the
    // shape the growth-curve chart consumes directly).
    if (monthlyRows.length > 0) {
      const postsByMonth: Record<string, number> = {}
      allPosts.forEach((p) => {
        const m = p.publishedAt.slice(0, 7).replace('-', '') // "202604"
        postsByMonth[m] = (postsByMonth[m] || 0) + 1
      })

      let runSessions = 0, runUsers = 0, runPageviews = 0, runPosts = 0
      growthByMonth = monthlyRows.map((row) => {
        const ym = row.dimensionValues[0].value // "202604"
        const month = `${ym.slice(0, 4)}-${ym.slice(4, 6)}`
        const sessions = parseInt(row.metricValues[0].value, 10) || 0
        const users = parseInt(row.metricValues[1].value, 10) || 0
        const pageviews = parseInt(row.metricValues[2].value, 10) || 0
        const posts = postsByMonth[ym] || 0
        runSessions += sessions
        runUsers += users
        runPageviews += pageviews
        runPosts += posts
        return {
          month,
          sessions, users, pageviews, posts,
          cumulativeSessions: runSessions,
          cumulativeUsers: runUsers,
          cumulativePageviews: runPageviews,
          cumulativePosts: runPosts,
        }
      })
    }

    // Synthesize a minimal 2-point growth curve if the monthly query failed
    // but the 30-day baseline still works. Two-point curves still climb;
    // a single dot reads as flat.
    if (growthByMonth.length === 0 && sessionRows.length > 0 && launchDate) {
      const recent30 = parseInt(sessionRows[0]?.metricValues[0]?.value ?? '0', 10) || 0
      const recentUsers = parseInt(sessionRows[0]?.metricValues[1]?.value ?? '0', 10) || 0
      const prior30 = parseInt(priorSessionRows[0]?.metricValues[0]?.value ?? '0', 10) || 0
      const today = new Date()
      const monthAgo = new Date(today); monthAgo.setMonth(monthAgo.getMonth() - 1)
      const ymKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      growthByMonth = [
        {
          month: ymKey(monthAgo),
          sessions: prior30, users: 0, pageviews: prior30, posts: 0,
          cumulativeSessions: prior30, cumulativeUsers: 0,
          cumulativePageviews: prior30, cumulativePosts: 0,
        },
        {
          month: ymKey(today),
          sessions: recent30, users: recentUsers, pageviews: recent30, posts: 0,
          cumulativeSessions: prior30 + recent30, cumulativeUsers: recentUsers,
          cumulativePageviews: prior30 + recent30, cumulativePosts: 0,
        },
      ]
      gaDiagnostic.growthFallback = 1
    }

    // Merge per-post pageviews into the posts map. pagePath examples:
    //   "/blog/post.html?slug=sunnylands-annenberg-estate-rancho-mirage-presidents"
    //   "/blog/post/sunnylands-annenberg-estate-rancho-mirage-presidents"
    blogPostRows.forEach((row) => {
      const path = row.dimensionValues[0].value
      let slug: string | null = null
      const qMatch = path.match(/[?&]slug=([^&#]+)/)
      if (qMatch) slug = decodeURIComponent(qMatch[1])
      else {
        const pMatch = path.match(/\/blog\/post\/([^/?#]+)/)
        if (pMatch) slug = decodeURIComponent(pMatch[1])
      }
      if (!slug || !postsMap[slug]) return
      const views = parseInt(row.metricValues[0].value, 10) || 0
      const engagement = parseFloat(row.metricValues[1].value) || 0
      // Multiple pagePaths can map to the same post (e.g. with/without trailing slash).
      // Sum views, average engagement weighted by views.
      const cur = postsMap[slug]
      const prevViews = cur.pageviews ?? 0
      const prevEng = cur.avgEngagementTime ?? 0
      const totalViews = prevViews + views
      cur.pageviews = totalViews
      cur.avgEngagementTime = totalViews > 0
        ? Math.round((prevEng * prevViews + engagement) / totalViews)
        : 0
    })
  }

  const posts = Object.values(postsMap)

  // OneUp social analytics — runs in parallel with everything else above
  // via the lib; doesn't block on individual platform failure (returns {}).
  const social = await fetchAllPlatforms()

  res.setHeader('Cache-Control', 'private, no-store')
  return res.status(200).json({
    totalPosts: allPosts.length,
    recentPosts: recent.length,
    postsPerWeek,
    launchDate,
    byCat,
    byPipeline,
    gaMeasurementId: process.env.GA_MEASUREMENT_ID || 'G-X2N2M3LDKS',
    gaPropertyId: process.env.GOOGLE_ANALYTICS_PROPERTY_ID || null,
    gaConnected: gaReady,
    gaDiagnostic,
    siteTraffic,
    cumulativeTraffic,
    growthByMonth,
    ylopoClicks,
    topYlopoPages,
    posts,
    social,
    generatedAt: new Date().toISOString(),
  })
}
