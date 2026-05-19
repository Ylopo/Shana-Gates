import { VercelRequest, VercelResponse } from '@vercel/node'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, pdfBase64, historyPdfBase64, address } = req.body || {}
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'A valid email address is required.' })
  }
  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Property address is required.' })
  }

  const hasAnalysis = typeof pdfBase64 === 'string' && pdfBase64.length > 0
  const hasHistory = typeof historyPdfBase64 === 'string' && historyPdfBase64.length > 0
  if (!hasAnalysis && !hasHistory) {
    return res.status(400).json({ error: 'At least one report PDF is required.' })
  }

  const userEmail = email.trim().toLowerCase()
  const addr = address.trim()
  const shortAddr = addr.split(',')[0]
  const safeAddr = shortAddr.replace(/\s+/g, '-')

  // Build subject + intro based on which reports were requested.
  let subject: string
  let intro: string
  let bullets: string
  if (hasAnalysis && hasHistory) {
    subject = `Your Property Reports: ${shortAddr}`
    intro = `Attached are your two reports for <strong>${addr}</strong>:`
    bullets = `
      <p style="margin:0 0 6px"><strong>1. Buyers Analysis Report</strong></p>
      <ul style="margin:0 0 16px;padding-left:20px;line-height:1.7">
        <li>Comparable sales &amp; value assessment</li>
        <li>Rental income &amp; cash flow projections</li>
        <li>Neighborhood scorecard</li>
        <li>Investment strategy scenarios</li>
        <li>Current market conditions</li>
      </ul>
      <p style="margin:0 0 6px"><strong>2. Property History Report</strong></p>
      <ul style="margin:0 0 16px;padding-left:20px;line-height:1.7">
        <li>Construction &amp; architecture</li>
        <li>Ownership timeline</li>
        <li>Permits &amp; remodels</li>
        <li>Public records &amp; notable events</li>
      </ul>`
  } else if (hasAnalysis) {
    subject = `Your Property Analysis: ${shortAddr}`
    intro = `Attached is your full analysis report for <strong>${addr}</strong>. It covers:`
    bullets = `
      <ul style="margin:0 0 16px;padding-left:20px;line-height:1.8">
        <li>Comparable sales &amp; value assessment</li>
        <li>Rental income &amp; cash flow projections</li>
        <li>Neighborhood scorecard</li>
        <li>Investment strategy scenarios</li>
        <li>Current market conditions</li>
      </ul>`
  } else {
    subject = `Your Property History: ${shortAddr}`
    intro = `Attached is your property history report for <strong>${addr}</strong>. It covers:`
    bullets = `
      <ul style="margin:0 0 16px;padding-left:20px;line-height:1.8">
        <li>Construction &amp; architecture</li>
        <li>Ownership timeline</li>
        <li>Permits &amp; remodels</li>
        <li>Public records &amp; notable events</li>
      </ul>`
  }

  const attachments: { filename: string; content: string }[] = []
  if (hasAnalysis) {
    attachments.push({ filename: `Property-Analysis-${safeAddr}.pdf`, content: pdfBase64 })
  }
  if (hasHistory) {
    attachments.push({ filename: `Property-History-${safeAddr}.pdf`, content: historyPdfBase64 })
  }

  try {
    await resend.emails.send({
      from: process.env.FROM_EMAIL || 'shana@craftbauer.com',
      to: userEmail,
      subject,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#131313">
        <div style="background:#1A444C;padding:28px 32px;border-radius:8px 8px 0 0">
          <p style="color:#fff;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:0 0 4px">Shana Gates · Craft & Bauer | Real Broker</p>
        </div>
        <div style="background:#FAFAF8;padding:32px;border-radius:0 0 8px 8px;border:1px solid #E8E1D5">
          <h2 style="color:#131313;margin:0 0 16px;font-size:22px">Your Property ${hasAnalysis && hasHistory ? 'Reports Are' : 'Report Is'} Ready</h2>
          <p style="margin:0 0 12px">Hi there,</p>
          <p style="margin:0 0 12px">${intro}</p>
          ${bullets}
          <p style="margin:0 0 20px">I'm happy to walk you through any of the findings personally.</p>
          <div style="border-top:1px solid #E8E1D5;padding-top:20px">
            <p style="margin:0 0 4px"><strong>Shana Gates</strong></p>
            <p style="margin:0 0 4px;color:#666;font-size:14px">Craft &amp; Bauer | Real Broker</p>
            <p style="margin:0;font-size:14px"><a href="tel:7602324054" style="color:#1A444C">760.232.4054</a> &nbsp;·&nbsp; <a href="mailto:shana@craftbauer.com" style="color:#1A444C">shana@craftbauer.com</a></p>
          </div>
          <p style="font-size:10px;color:#999;margin-top:24px;line-height:1.5">For educational and informational purposes only. Not financial, investment, or legal advice. All estimates are AI-generated approximations based on publicly available data. Property history is compiled from public sources and accuracy is not guaranteed. Always verify with a licensed real estate professional. CalDRE #02224632.</p>
        </div>
      </div>`,
      attachments,
    })

    const requestedLabel = hasAnalysis && hasHistory
      ? 'Analysis + History'
      : hasAnalysis ? 'Analysis' : 'History'

    await resend.emails.send({
      from: process.env.FROM_EMAIL || 'shana@craftbauer.com',
      to: 'shana@craftbauer.com',
      subject: `New lead — ${requestedLabel}: ${shortAddr}`,
      html: `<p><strong>${userEmail}</strong> requested a property report for:</p>
        <p><strong>${addr}</strong></p>
        <p>Reports requested: <strong>${requestedLabel}</strong></p>
        <p>Requested at: ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PT</p>`,
    })

    return res.status(200).json({ success: true })
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to send email' })
  }
}
