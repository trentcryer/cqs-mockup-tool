/**
 * Resend email client for CQS Studio review alerts
 * Server-only
 */
import { Resend } from 'resend'

let _resend: Resend | null = null

function getResend() {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY
    if (!key) throw new Error('RESEND_API_KEY is not set')
    _resend = new Resend(key)
  }
  return _resend
}

interface ReviewRequestEmailParams {
  to: string
  quartetName: string
  userEmail: string
  designId: string
  productTitle: string
  placement: string
  color?: string | null
  notes?: string | null
  logoUrl?: string | null
  mockupUrls?: string[] | null
}

export async function sendReviewRequestEmail(params: ReviewRequestEmailParams) {
  const resend = getResend()
  const from = process.env.RESEND_FROM_EMAIL || 'CQS Studio <studio@customquartetstuff.com>'

  const subject = `🎵 Review Request: ${params.quartetName} — ${params.productTitle}`

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; background: #f7f3ee; color: #1c1412;">
      <div style="background: #1c1412; color: #f7f3ee; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <h1 style="margin:0; font-size: 22px; letter-spacing: 0.5px;">Custom Quartet Stuff</h1>
        <p style="margin: 4px 0 0; opacity: 0.85; font-size: 13px; letter-spacing: 2px;">MOCKUP STUDIO • REVIEW REQUEST</p>
      </div>

      <div style="background: white; padding: 28px 24px; border-radius: 0 0 8px 8px; border: 1px solid #d4c5b0;">
        <h2 style="margin-top:0; color: #9b1c1c; font-size: 18px;">
          ${params.quartetName} submitted a design for review
        </h2>

        <table style="width:100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
          <tr><td style="padding:6px 0; color:#666; width:120px;">Product</td><td><strong>${params.productTitle}</strong></td></tr>
          <tr><td style="padding:6px 0; color:#666;">Placement</td><td>${params.placement}${params.color ? ` • ${params.color}` : ''}</td></tr>
          <tr><td style="padding:6px 0; color:#666;">Submitted by</td><td>${params.userEmail}</td></tr>
          <tr><td style="padding:6px 0; color:#666;">Design ID</td><td><code style="background:#f7f3ee;padding:2px 6px;border-radius:3px;">${params.designId}</code></td></tr>
        </table>

        ${params.notes ? `
          <div style="margin: 18px 0;">
            <div style="font-weight:600; color:#9b1c1c; font-size:12px; letter-spacing:0.5px; margin-bottom:4px;">CUSTOMER NOTES</div>
            <div style="background:#f7f3ee; padding:12px 16px; border-radius:6px; white-space:pre-wrap;">${params.notes}</div>
          </div>
        ` : ''}

        ${params.mockupUrls && params.mockupUrls.length > 0 ? `
          <div style="margin-top:24px;">
            <div style="font-weight:600; color:#9b1c1c; font-size:12px; letter-spacing:0.5px; margin-bottom:8px;">MOCKUPS</div>
            <div style="display:flex; gap:12px; flex-wrap:wrap;">
              ${params.mockupUrls.map(u => `<img src="${u}" width="160" style="border-radius:6px; box-shadow:0 2px 8px rgba(0,0,0,0.1);"/>`).join('')}
            </div>
          </div>
        ` : ''}

        <div style="margin-top:32px; padding-top:20px; border-top:1px solid #d4c5b0;">
          <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/admin?design=${params.designId}" 
             style="display:inline-block; background:#1c1412; color:#f7f3ee; padding:12px 28px; border-radius:6px; text-decoration:none; font-weight:600; letter-spacing:0.5px;">
            OPEN IN ADMIN DASHBOARD →
          </a>
        </div>
      </div>

      <p style="text-align:center; font-size:11px; color:#8a7660; margin-top:20px;">
        Sent from CQS Mockup Studio • Private customer workspace
      </p>
    </div>
  `

  const result = await resend.emails.send({
    from,
    to: params.to,
    subject,
    html,
  })

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`)
  }
  return result
}