/**
 * Shared admin auth check for the /api/blog/* and /api/content/* endpoints
 * used by the Idea Review + Media Queue admin UI.
 *
 * Accepts EITHER:
 *   - sg_assistant_session HMAC cookie (set by /api/assistant/auth login)
 *   - ?secret=ADMIN_SECRET URL query param (used by bookmarked admin links)
 *
 * Both auth methods grant the same access. The URL-secret path is what lets
 * a VA work from a single shareable link without going through the
 * /admin/assistant/login.html flow.
 */
import { createHmac } from 'crypto'

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

export type AuthResult = { ok: boolean; status: number; error?: string }

export function checkAdminAuth(req: any): AuthResult {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return { ok: false, status: 500, error: 'ADMIN_SECRET env var is not set' }

  // URL-secret first — cheapest check
  if (req.query?.secret === secret) return { ok: true, status: 200 }

  // Then HMAC cookie
  const cookies = parseCookies(req.headers?.cookie)
  const token = cookies[COOKIE_NAME]
  if (token && verifyToken(token, secret)) return { ok: true, status: 200 }

  return { ok: false, status: 401, error: 'Unauthorized' }
}
