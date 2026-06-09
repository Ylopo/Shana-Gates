import { checkAdminAuth } from '../../lib/admin-auth'
import Anthropic from '@anthropic-ai/sdk'


export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = checkAdminAuth(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

  const { title, excerpt, category } = req.body ?? {}
  if (!title) return res.status(400).json({ error: 'title required' })

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  // Rotate opening style per script so we don't fall into a "Hey..." rut.
  // Eight distinct hook patterns; we pick one randomly and let Claude treat
  // it as the required opening style for this script. The pattern menu skews
  // editorial and polished — Shana serves luxury and second-home buyers in
  // the Coachella Valley, so the voice should read sophisticated and refined,
  // never casual or salesy.
  const HOOK_STYLES = [
    'OPEN WITH A SPECIFIC NUMBER OR DATA POINT. e.g., "Inventory in Palm Desert is up 14% year-over-year, and that single number is changing how I advise buyers this month." Name a real, recent figure.',
    'OPEN WITH A NAMED PLACE OR ADDRESS. e.g., "A Wexler home in Vista Las Palmas just changed hands for the first time in 19 years — here is what that tells me about the market." Anchor immediately to a recognizable Coachella Valley landmark, neighborhood, or architect.',
    'OPEN WITH A POLISHED QUESTION POSED TO THE VIEWER. e.g., "If you have been watching Indian Wells listings sit longer than expected, here is what is actually happening behind those numbers." Direct, elegant, not gimmicky.',
    'OPEN WITH AN INSIDER OBSERVATION. e.g., "There is something most buyers walking into a gated community in Rancho Mirage do not realize about HOA reserves..." Position Shana as the source who sees what others miss.',
    'OPEN WITH A CONTRARIAN OR COUNTERINTUITIVE STATEMENT. e.g., "Most people assume spring is the right window to list in Palm Springs. The data tells a different story." Confident, never combative.',
    'OPEN WITH A TIME-STAMPED, EDITORIAL FRAME. e.g., "As of this week, three things shifted in the Coachella Valley luxury market that are worth your attention." Treat it like a confident desk report, not breaking news theatrics.',
    'OPEN WITH A BRIEF FIRST-PERSON ANECDOTE. e.g., "I was walking a client through a Twin Palms home yesterday, and something about the pricing stopped me." One sentence of scene-setting, then pivot.',
    'OPEN WITH A DIRECT ADDRESS TO THE SPECIFIC AUDIENCE. e.g., "For anyone considering a second home in the desert this season, this is the one thing I would think through before you make an offer." Sophisticated, never "Hey" or "Hi" filler.',
  ]
  const hookStyle = HOOK_STYLES[Math.floor(Math.random() * HOOK_STYLES.length)]

  const prompt = `You are writing a video script for Shana Gates — a licensed REALTOR® and team lead at Craft & Bauer | Real Broker in the Coachella Valley, California. Shana serves the luxury and second-home market: sophisticated buyers and sellers, often relocating from coastal California or out of state, frequently in the $1M–$10M+ tier.

Shana will record a short video (45–90 seconds) for social and blog distribution. The script should sound like Shana speaking confidently and directly to a sophisticated client — not casual filler, not a press release. The voice is polished, knowledgeable, and grounded — a trusted local expert addressing buyers and sellers who value precision over hype.

ARTICLE TITLE: ${title}
EXCERPT: ${excerpt ?? 'No excerpt provided.'}
CATEGORY: ${category ?? 'general'}

REQUIRED OPENING STYLE FOR THIS SCRIPT:
${hookStyle}

Then continue the script with this structure (one continuous spoken flow, NO section labels):

1. The hook above (1 sentence).
2. Two or three talking points — what Coachella Valley buyers, sellers, or homeowners specifically need to understand about this topic. Each point is 1–2 sentences. Shana speaks from direct experience: named neighborhoods, real dollar ranges, specific architectural or market context where relevant.
3. Shana's honest take as a licensed agent: does this topic have a POSITIVE, NEGATIVE, or NEUTRAL effect on homeowners or buyers in the Coachella Valley? One clear sentence stating her verdict, then 1–2 sentences explaining why.
4. A confident, low-pressure invitation to reach out, read the full article, or search listings. Never salesy, never "click the link below" — phrased as a peer offering counsel.

NON-NEGOTIABLE TONE RULES:
- Never open with "Hey," "Hi," "Hello," or any other casual greeting. Use the required hook style above.
- First person as Shana ("I", "my clients", "we have been seeing")
- Match her sophisticated luxury clientele — refined, editorial, confident, warm
- Avoid casual filler: no "you guys", "super", "totally", "kinda", "amazing", "literally", "honestly"
- Avoid hype words: no "huge", "incredible", "game-changing", "you won't believe"
- No exclamation points unless genuinely warranted by the content
- Be specific over generic — named neighborhoods, named architects (Wexler, Krisel, Frey, Williams), defensible dollar ranges, real timeframes
- Mention the Coachella Valley or a specific city within it at least once
- Treat the viewer as intelligent and time-conscious

LENGTH:
- Simple topics: 40–50 seconds (~100 words)
- Complex topics: 75–90 seconds (~200 words)

Return ONLY the script text — one continuous flow that Shana can read straight off the page. No intro line, no explanation, no markdown, no section labels.`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })
    const script = (message.content[0] as { type: string; text: string }).text.trim()
    return res.status(200).json({ script })
  } catch (err: any) {
    console.error('[generate-script]', err)
    return res.status(500).json({ error: 'Failed to generate script' })
  }
}
