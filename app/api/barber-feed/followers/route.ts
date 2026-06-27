import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { group_id } = await req.json()
    if (!group_id) return NextResponse.json({ error: 'group_id required' }, { status: 400 })

    const admin = createAdminClient()

    // Check group exists
    const { data: group } = await admin.from('profiles').select('id').eq('id', group_id).single()
    if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

    // Insert follow
    await (admin.from('feed_followers') as any).insert({
      user_id: user.id,
      group_id,
    })

    return NextResponse.json({ success: true, following: true })
  } catch (e: any) {
    // Duplicate follow is OK
    if (e.message.includes('unique')) {
      return NextResponse.json({ success: true, following: true })
    }
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const group_id = req.nextUrl.searchParams.get('group_id')
    if (!group_id) return NextResponse.json({ error: 'group_id required' }, { status: 400 })

    const admin = createAdminClient()

    // Delete follow
    await admin.from('feed_followers').delete().eq('user_id', user.id).eq('group_id', group_id)

    return NextResponse.json({ success: true, following: false })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
