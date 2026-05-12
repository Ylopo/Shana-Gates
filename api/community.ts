/**
 * GET /api/community?slug=palm-springs
 * Returns community page override data (stats, images, headlines) from Sanity.
 * Returns {} when no override document exists — community pages fall back to
 * hardcoded HTML values.
 */

import { getCommunityOverride } from '../lib/sanity'

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const slug = req.query?.slug as string | undefined
  if (!slug) return res.status(400).json({ error: 'slug required' })

  try {
    const data = await getCommunityOverride(slug)
    // Sanity CDN already caches aggressively; this header is for Vercel's edge
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
    return res.status(200).json(data ?? {})
  } catch (err) {
    console.error('[community] Sanity error:', err)
    return res.status(500).json({})
  }
}
