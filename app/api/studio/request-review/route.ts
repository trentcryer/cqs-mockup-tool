import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/api-auth'
import { sendReviewRequestEmail } from '@/lib/resend'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { designId } = await req.json()
  if (!designId) return NextResponse.json({ error: 'designId is required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: design } = await admin.from('designs').select('*').eq('id', designId).single() as { data: any }
  if (!design || design.user_id !== user.id) {
    return NextResponse.json({ error: 'Design not found' }, { status: 404 })
  }

  const { data: profile } = await admin.from('profiles').select('email, quartet_name').eq('id', user.id).single() as { data: any }

  const { error: updateError } = await (admin.from('designs') as any)
    .update({ status: 'review_requested' })
    .eq('id', designId)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  try {
    await sendReviewRequestEmail({
      to: process.env.TRENT_EMAIL || 'trent@example.com',
      quartetName: profile?.quartet_name || 'A group',
      userEmail: profile?.email || user.email || 'unknown',
      designId,
      productTitle: design.product_title,
      placement: design.placement,
      color: design.color,
      notes: design.notes,
      mockupUrls: (design.mockup_urls as any[])?.map((m: any) => m.mockup_url) || [],
    })
  } catch (e) {
    console.error('Review request email failed', e)
  }

  return NextResponse.json({ ok: true })
}
