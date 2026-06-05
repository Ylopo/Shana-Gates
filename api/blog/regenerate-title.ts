import { checkAdminAuth } from '../../lib/admin-auth'
import Anthropic from '@anthropic-ai/sdk'
import { getPostBySlug } from '../../lib/blog-redis'


export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = checkAdminAuth(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

  const { slug } = req.body ?? {}
  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'slug required' })
  }

  const post = await getPostBySlug(slug)
  if (!post) return res.status(404).json({ error: 'Post not found' })

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content: `Generate 5 alternative headline options for this Coachella Valley real estate blog post.

Current headline: "${post.title}"
Category: ${post.category}
Excerpt: ${post.excerpt ?? ''}

Requirements:
- Each headline must be specific — include key details from the content (event names, locations, dates, market figures, etc.)
- SEO-friendly: include terms people actually search for (e.g. "farmers market", "Palm Springs events", "Coachella Valley homes")
- 8–14 words long
- Conversational and direct — not clickbait, not vague
- Vary the angle: some informational, some curiosity-driven, some local-expert perspective

Return ONLY a valid JSON array of 5 strings, no markdown, no explanation. Example format:
["Headline one here","Headline two here","Headline three here","Headline four here","Headline five here"]`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]'
    let titles: string[]
    try {
      titles = JSON.parse(text)
      if (!Array.isArray(titles)) throw new Error('not array')
      titles = titles.filter((t) => typeof t === 'string' && t.trim()).slice(0, 5)
    } catch {
      return res.status(500).json({ error: 'Failed to parse headline suggestions' })
    }

    res.setHeader('Cache-Control', 'private, no-store')
    return res.status(200).json({ titles })
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? 'Failed to generate titles' })
  }
}
