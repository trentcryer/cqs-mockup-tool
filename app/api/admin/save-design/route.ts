import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const trentEmail = process.env.TRENT_EMAIL?.toLowerCase()
  const admin = createAdminClient()

  // Allow access for TRENT_EMAIL or any profile with is_admin=true
  const { data: profile } = await (admin.from('profiles') as any)
    .select('is_admin').eq('id', user.id).single()
  const isAdmin = user.email?.toLowerCase() === trentEmail || !!profile?.is_admin
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { asUserId, logoFile: _unused, ...designPayload } = await req.json()
  if (!asUserId) return NextResponse.json({ error: 'asUserId required' }, { status: 400 })

  // Load the target group's profile for quartet_name
  const { data: targetProfile } = await (admin.from('profiles') as any)
    .select('quartet_name').eq('id', asUserId).single()

  const payload = {
    ...designPayload,
    user_id: asUserId,
    quartet_name: targetProfile?.quartet_name || designPayload.quartet_name || 'Group',
    status: 'draft',
  }

  let result
  if (designPayload.id) {
    result = await (admin.from('designs') as any)
      .update(payload).eq('id', designPayload.id).select('id').single()
  } else {
    result = await (admin.from('designs') as any)
      .insert(payload).select('id').single()
  }

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: result.data?.id })
}
