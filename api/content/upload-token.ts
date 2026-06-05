/**
 * POST /api/content/upload-token
 *
 * Server side of Vercel Blob's client-upload pattern. The browser uses
 * `upload()` from @vercel/blob/client which POSTs here to negotiate a
 * tokenized upload URL, then PUTs the file directly to Blob.
 *
 * Replaces the previous manual XHR + generateClientTokenFromReadWriteToken
 * setup, which was returning bare 403s because the upload URL / Authorization
 * header format had drifted from what the Blob storage backend expects.
 */
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { checkAdminAuth } from '../../lib/admin-auth'

export const config = { maxDuration: 30 }

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = checkAdminAuth(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

  try {
    const jsonResponse = await handleUpload({
      body: req.body as HandleUploadBody,
      request: req,
      onBeforeGenerateToken: async (_pathname) => ({
        // No MIME allowlist — admin uploads only. Cap at 1 GB.
        allowedContentTypes: undefined,
        maximumSizeInBytes: 1024 * 1024 * 1024,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => { /* no-op; the client stores the URL */ },
    })
    return res.status(200).json(jsonResponse)
  } catch (err: any) {
    console.error('[upload-token]', err)
    return res.status(400).json({ error: err?.message ?? 'Upload failed' })
  }
}
