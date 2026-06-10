/**
 * YouTube channel RSS helper.
 *
 * Used to capture the watch URL of newly uploaded videos after OneUp
 * submits them. OneUp doesn't return a postSubmissionId; YouTube's
 * channel RSS is the cheapest authoritative source — no API key, no
 * rate limit concerns at our publishing volume.
 *
 * Feed URL: https://www.youtube.com/feeds/videos.xml?channel_id=UC...
 *
 * RSS typically reflects new uploads within 1–5 minutes; can take up to
 * 15 min on slow days. Callers should poll with a reasonable timeout.
 */

export interface YouTubeVideo {
  id: string                  // 11-char video ID
  title: string
  url: string                 // https://www.youtube.com/watch?v=...
  publishedAt: string         // ISO 8601
}

const FEED_URL = (channelId: string) =>
  `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`

/**
 * Fetch the channel's most-recent uploads as an ordered list (newest
 * first). Returns up to 15 entries (YouTube's default feed size).
 */
export async function fetchChannelVideos(channelId: string): Promise<YouTubeVideo[]> {
  const res = await fetch(FEED_URL(channelId), {
    headers: {
      // YouTube sometimes 403s requests without a UA. Pretending to be a
      // generic feed reader is the conventional workaround.
      'User-Agent': 'Mozilla/5.0 (compatible; shanasells-bot/1.0; +https://shanasells.com)',
    },
    // Avoid Vercel caching stale RSS at the edge.
    cache: 'no-store' as any,
  })
  if (!res.ok) throw new Error(`YouTube RSS fetch failed: HTTP ${res.status}`)
  const xml = await res.text()

  // Each <entry> in the RSS has yt:videoId, title, link href, published.
  // We use a simple regex parser — no xml libs needed and the feed shape
  // is stable.
  const videos: YouTubeVideo[] = []
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g
  let m: RegExpExecArray | null
  while ((m = entryRe.exec(xml)) !== null) {
    const block = m[1]
    const id = (block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [, ''])[1].trim()
    const title = decodeEntities((block.match(/<title>([^<]+)<\/title>/) || [, ''])[1].trim())
    const publishedAt = (block.match(/<published>([^<]+)<\/published>/) || [, ''])[1].trim()
    if (!id) continue
    videos.push({
      id,
      title,
      url: `https://www.youtube.com/watch?v=${id}`,
      publishedAt,
    })
  }
  return videos
}

/**
 * Find the most recent channel video uploaded after `since` (ISO date).
 * Returns null if no newer video is available yet.
 */
export async function findNewestVideoSince(
  channelId: string,
  since: string,
): Promise<YouTubeVideo | null> {
  const videos = await fetchChannelVideos(channelId)
  if (videos.length === 0) return null
  const sinceMs = new Date(since).getTime()
  // RSS is in newest-first order. Find the most recent entry with
  // publishedAt > sinceMs.
  for (const v of videos) {
    const pubMs = new Date(v.publishedAt).getTime()
    if (pubMs > sinceMs) return v
  }
  return null
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
}
