import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { post_id } = await req.json()
    if (!post_id) return NextResponse.json({ error: 'post_id required' }, { status: 400 })

    const admin = createAdminClient()

    // Insert like
    await (admin.from('feed_post_likes') as any).insert({
      user_id: user.id,
      post_id,
    })

    // Increment like count
    const { data: post } = await admin.from('barber_feed_posts').select('like_count').eq('id', post_id).single()
    const newCount = (post?.like_count || 0) + 1

    await (admin.from('barber_feed_posts') as any).update({ like_count: newCount }).eq('id', post_id)

    return NextResponse.json({ success: true, like_count: newCount })
  } catch (e: any) {
    // Duplicate like is OK
    if (e.message.includes('unique')) {
      return NextResponse.json({ success: true, like_count: 0 })
    }
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const post_id = req.nextUrl.searchParams.get('post_id')
    if (!post_id) return NextResponse.json({ error: 'post_id required' }, { status: 400 })

    const admin = createAdminClient()

    // Delete like
    await admin.from('feed_post_likes').delete().eq('user_id', user.id).eq('post_id', post_id)

    // Decrement like count
    const { data: post } = await admin.from('barber_feed_posts').select('like_count').eq('id', post_id).single()
    const newCount = Math.max(0, (post?.like_count || 1) - 1)

    await (admin.from('barber_feed_posts') as any).update({ like_count: newCount }).eq('id', post_id)

    return NextResponse.json({ success: true, like_count: newCount })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
