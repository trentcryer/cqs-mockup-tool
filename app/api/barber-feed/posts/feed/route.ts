import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/barber-feed/posts/feed
 * Fetch paginated barber-feed for browsing
 * Query: ?limit=20&offset=0&user_id=<optional>
 */
export async function GET(req: NextRequest) {
  try {
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '20'), 100)
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0')
    const user_id = req.nextUrl.searchParams.get('user_id')

    const supabase = await createClient()

    // Fetch posts (newest first, excluding deleted)
    const { data: posts, count } = await supabase
      .from('barber_feed_posts')
      .select('*', { count: 'exact' })
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (!posts) {
      return NextResponse.json({ posts: [], has_more: false, total_count: 0 })
    }

    // Enrich with group data and user engagement
    const postsWithDetails = await Promise.all(
      posts.map(async (post: any) => {
        // Get group info
        const { data: group } = await supabase
          .from('profiles')
          .select('quartet_name, profile_logo_path')
          .eq('id', post.group_id)
          .single()

        let liked_by_user = false
        let shared_by_user = false

        if (user_id) {
          const { data: like } = await supabase
            .from('feed_post_likes')
            .select('id')
            .eq('user_id', user_id)
            .eq('post_id', post.id)
            .single()

          const { data: share } = await supabase
            .from('feed_post_shares')
            .select('id')
            .eq('user_id', user_id)
            .eq('post_id', post.id)
            .single()

          liked_by_user = !!like
          shared_by_user = !!share
        }

        return {
          ...post,
          group_name: group?.quartet_name || 'Unknown Group',
          group_avatar_url: group?.profile_logo_path || null,
          liked_by_user,
          shared_by_user,
        }
      })
    )

    return NextResponse.json({
      posts: postsWithDetails,
      has_more: offset + limit < (count || 0),
      total_count: count || 0,
    })
  } catch (e: any) {
    console.error('[Feed error]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
