import { checkAdminAuth } from '../../lib/admin-auth'
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client'


export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const auth = checkAdminAuth(req)
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN
  if (!blobToken) return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN not configured' })

  const filename = (req.query?.filename as string) ?? 'video.mp4'
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'mp4'
  const pathname = `videos/sg-${Date.now()}.${ext}`

  try {
    // No content-type allowlist — the admin is uploading their own marketing
    // video and Vercel Blob's narrow MIME whitelist was rejecting valid
    // formats (e.g. iPhone HEVC .mov reporting as video/mov, .mkv, etc.) with
    // a generic 403. Size cap stays at 1 GB.
    const clientToken = await generateClientTokenFromReadWriteToken({
      token: blobToken,
      pathname,
      addRandomSuffix: false,
      maximumSizeInBytes: 1024 * 1024 * 1024,
    })

    return res.status(200).json({
      token: clientToken,
      uploadUrl: `https://blob.vercel-storage.com/${pathname}`,
      pathname,
    })
  } catch (err: any) {
    console.error('[upload-token]', err)
    return res.status(500).json({ error: err?.message ?? 'Failed to generate upload token' })
  }
}
