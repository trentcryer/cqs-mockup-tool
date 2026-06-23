import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/api-auth'
import { sendMagicLinkEmail } from '@/lib/resend'

export async function POST(req: NextRequest) {
  if (!await isAdminUser(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { email } = await req.json()
  const cleanEmail = email?.trim().toLowerCase()
  if (!cleanEmail) return NextResponse.json({ error: 'No email on file' }, { status: 400 })

  const admin = createAdminClient()

  const { data: linkData, error: linkErr } = await (admin.auth.admin as any).generateLink({
    type: 'magiclink',
    email: cleanEmail,
  })
  if (linkErr || !linkData?.properties?.action_link) {
    return NextResponse.json({ error: linkErr?.message ?? 'Failed to generate link' }, { status: 500 })
  }

  await sendMagicLinkEmail({
    to: cleanEmail,
    magicLink: linkData.properties.action_link,
    isNewAccount: false,
  }).catch(e => console.error('[CQS EMAIL] failed to send magic link:', e.message))

  return NextResponse.json({ magicLink: linkData.properties.action_link })
}
