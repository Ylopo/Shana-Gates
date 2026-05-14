import { VercelRequest, VercelResponse } from '@vercel/node'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, pdfBase64, address } = req.body || {}
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'A valid email address is required.' })
  }
  if (!pdfBase64 || typeof pdfBase64 !== 'string') {
    return res.status(400).json({ error: 'PDF data is required.' })
  }
  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Property address is required.' })
  }

  const userEmail = email.trim().toLowerCase()
  const addr = address.trim()
  const shortAddr = addr.split(',')[0]

  try {
    await resend.emails.send({
      from: process.env.FROM_EMAIL || 'shana@craftbauer.com',
      to: userEmail,
      subject: `Your Property Analysis: ${shortAddr}`,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#131313">
        <div style="background:#1A444C;padding:28px 32px;border-radius:8px 8px 0 0">
          <p style="color:#fff;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:0 0 4px">Shana Gates · Craft & Bauer | Real Broker</p>
        </div>
        <div style="background:#FAFAF8;padding:32px;border-radius:0 0 8px 8px;border:1px solid #E8E1D5">
          <h2 style="color:#131313;margin:0 0 16px;font-size:22px">Your Property Analysis Report is Ready</h2>
          <p style="margin:0 0 12px">Hi there,</p>
          <p style="margin:0 0 12px">Attached is your full analysis report for <strong>${addr}</strong>. It covers:</p>
          <ul style="margin:0 0 16px;padding-left:20px;line-height:1.8">
            <li>Comparable sales &amp; value assessment</li>
            <li>Rental income &amp; cash flow projections</li>
            <li>Neighborhood scorecard</li>
            <li>Investment strategy scenarios</li>
            <li>Current market conditions</li>
          </ul>
          <p style="margin:0 0 20px">I'm happy to walk you through any of the findings personally.</p>
          <div style="border-top:1px solid #E8E1D5;padding-top:20px">
            <p style="margin:0 0 4px"><strong>Shana Gates</strong></p>
            <p style="margin:0 0 4px;color:#666;font-size:14px">Craft &amp; Bauer | Real Broker</p>
            <p style="margin:0;font-size:14px"><a href="tel:7602324054" style="color:#1A444C">760.232.4054</a> &nbsp;·&nbsp; <a href="mailto:shana@craftbauer.com" style="color:#1A444C">shana@craftbauer.com</a></p>
          </div>
          <p style="font-size:10px;color:#999;margin-top:24px;line-height:1.5">For educational purposes only. Not financial or investment advice. All estimates are AI-generated approximations based on publicly available data. Always verify with a licensed real estate professional. CalDRE #02224632.</p>
        </div>
      </div>`,
      attachments: [{
        filename: `Property-Analysis-${shortAddr.replace(/\s+/g, '-')}.pdf`,
        content: pdfBase64,
      }],
    })

    await resend.emails.send({
      from: process.env.FROM_EMAIL || 'shana@craftbauer.com',
      to: 'shana@craftbauer.com',
      subject: `New lead — Property Analysis: ${shortAddr}`,
      html: `<p><strong>${userEmail}</strong> requested a property analysis report for:</p>
        <p><strong>${addr}</strong></p>
        <p>Requested at: ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PT</p>`,
    })

    return res.status(200).json({ success: true })
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to send email' })
  }
}
