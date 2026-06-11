/**
 * OneUp analytics client — fetches per-platform performance metrics from
 * the analyze.oneupapp.io subdomain. Normalizes YouTube / TikTok / Facebook
 * responses to a single shape consumed by /api/blog/dashboard.
 *
 * Auth: ?apiKey=ONEUP_API_KEY (same key used for publishing).
 * Plan: requires Intermediate+ on the OneUp account.
 *
 * Per-platform notes:
 *   - YouTube  metric key for "views"  = `views`,                top list = `most_viewed`
 *   - TikTok   metric key for "views"  = `views`,                top list = `most_viewed`
 *   - Facebook metric key for "reach"  = `page_total_media_view_unique`, top list = `most_reach`
 *
 * Falls back to platform `posts_performance` (typo OneUp uses for YouTube only)
 * when `post_performance` is absent.
 */

const ANALYTICS_BASE = 'https://analyze.oneupapp.io/api'

// Social-network IDs are the platform-native IDs returned by
// listcategoryaccount. They're stable per-account and safe to hardcode,
// but env-override lets us point at a different account without a redeploy.
function getNetworkId(platform: Platform): string {
  if (platform === 'youtube') {
    return process.env.ONEUP_YOUTUBE_CHANNEL_ID || 'UCw92NYQPVrW44BnRUtbl1Kg'
  }
  if (platform === 'tiktok') {
    return process.env.ONEUP_TIKTOK_ACCOUNT_ID || '_000XVBIRPN1Ts3ex20Pr9nHu1cDEbIBPWn2'
  }
  return process.env.ONEUP_FACEBOOK_ACCOUNT_ID || '195071230834035'
}

export type Platform = 'youtube' | 'tiktok' | 'facebook'

export interface TopPost {
  title: string
  views: number
  url: string
  thumbnail: string
}

export interface PlatformSummary {
  platform: Platform
  posts: number
  views: number           // primary headline number; semantics depend on platform
  viewsLabel: string      // human label — "Views" for YT/TT, "Reach" for FB
  delta: number           // period-over-period change as ratio (0.31 = +31%, -0.5 = -50%)
  followers: number
  topPost: TopPost | null
}

const VIEWS_KEY: Record<Platform, string> = {
  youtube: 'views',
  tiktok: 'views',
  facebook: 'page_total_media_view_unique',
}

const VIEWS_LABEL: Record<Platform, string> = {
  youtube: 'Views',
  tiktok: 'Views',
  facebook: 'Reach',
}

const TOP_POST_KEY: Record<Platform, string> = {
  youtube: 'most_viewed',
  tiktok: 'most_viewed',
  facebook: 'most_reach',
}

function parseDelta(percentStr: string | undefined | null): number {
  if (!percentStr) return 0
  const cleaned = String(percentStr).replace(/[,%+]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n / 100
}

async function fetchOne(platform: Platform): Promise<PlatformSummary | null> {
  const apiKey = process.env.ONEUP_API_KEY
  if (!apiKey) return null

  const id = getNetworkId(platform)
  const url = `${ANALYTICS_BASE}/${platform}/overview`
    + `?apiKey=${encodeURIComponent(apiKey)}`
    + `&social_network_id=${encodeURIComponent(id)}`
    + `&preset=last_30_days`
    + `&timezone=America%2FLos_Angeles`

  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data: any = await res.json()
    if (!data?.success || !data?.data) return null

    const metrics: Array<{ key: string; value_current_period: number; percentage_change: string }> =
      Array.isArray(data.data.metrics) ? data.data.metrics : []
    const findMetric = (key: string) => metrics.find((m) => m.key === key)

    // YouTube/Facebook use `posts`, TikTok uses `videos`
    const postsMetric = findMetric('posts') || findMetric('videos')
    const viewsMetric = findMetric(VIEWS_KEY[platform])

    // post_performance for TikTok/Facebook, posts_performance for YouTube
    const perf = data.data.post_performance ?? data.data.posts_performance ?? {}
    const topArr: any[] = Array.isArray(perf[TOP_POST_KEY[platform]])
      ? perf[TOP_POST_KEY[platform]]
      : []
    const top = topArr[0]

    let topPost: TopPost | null = null
    if (top) {
      const raw = top.caption || top.message || top.title || ''
      const title = String(raw).replace(/\s+/g, ' ').trim().slice(0, 90) || 'Untitled post'
      topPost = {
        title,
        views: top.views ?? top.reach ?? 0,
        url: top.share_url || top.permalink_url || '',
        thumbnail: top.thumbnail_url || top.full_picture || '',
      }
    }

    return {
      platform,
      posts: postsMetric?.value_current_period ?? 0,
      views: viewsMetric?.value_current_period ?? 0,
      viewsLabel: VIEWS_LABEL[platform],
      delta: parseDelta(viewsMetric?.percentage_change),
      followers: data.data.total_subscribers ?? data.data.total_followers ?? 0,
      topPost,
    }
  } catch {
    return null
  }
}

export async function fetchAllPlatforms(): Promise<Partial<Record<Platform, PlatformSummary>>> {
  if (!process.env.ONEUP_API_KEY) return {}
  const [yt, tt, fb] = await Promise.all([
    fetchOne('youtube'),
    fetchOne('tiktok'),
    fetchOne('facebook'),
  ])
  const out: Partial<Record<Platform, PlatformSummary>> = {}
  if (yt) out.youtube = yt
  if (tt) out.tiktok = tt
  if (fb) out.facebook = fb
  return out
}
