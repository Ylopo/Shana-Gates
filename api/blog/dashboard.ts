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

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const auth = checkAdminAuth(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

  const raw = await redis.get<string>('blog_posts_index')
  const allPosts: BlogPostSummary[] = raw
    ? (typeof raw === 'string' ? JSON.parse(raw) : raw)
    : []

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

  const gaReady = !!(process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.GOOGLE_ANALYTICS_PROPERTY_ID)
  if (gaReady) {
    const [sessionRows, priorSessionRows, topPagesRows, blogPostRows] = await Promise.all([
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
    ])

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

  res.setHeader('Cache-Control', 'private, no-store')
  return res.status(200).json({
    totalPosts: allPosts.length,
    recentPosts: recent.length,
    postsPerWeek,
    byCat,
    byPipeline,
    gaMeasurementId: process.env.GA_MEASUREMENT_ID || 'G-X2N2M3LDKS',
    gaPropertyId: process.env.GOOGLE_ANALYTICS_PROPERTY_ID || null,
    gaConnected: gaReady,
    siteTraffic,
    ylopoClicks,
    topYlopoPages,
    posts,
    generatedAt: new Date().toISOString(),
  })
}
