import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * POST /api/push-notifications/subscribe
 * Save or update a user's push notification subscription
 * Body: { endpoint, keys: { auth, p256dh } }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { endpoint, keys } = body

    if (!endpoint || !keys?.auth || !keys?.p256dh) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Save or update subscription
    const { error } = await (admin.from('push_subscriptions') as any).upsert({
      user_id: user.id,
      endpoint,
      auth_key: keys.auth,
      p256dh_key: keys.p256dh,
    }, { onConflict: 'user_id,endpoint' })

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[Push subscribe error]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const endpoint = req.nextUrl.searchParams.get('endpoint')
    if (!endpoint) return NextResponse.json({ error: 'endpoint required' }, { status: 400 })

    const admin = createAdminClient()
    await admin.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', endpoint)

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
