import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function AppHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch followed groups (limited for home)
  const { data: followedGroups } = user
    ? await supabase
        .from('feed_followers')
        .select('*, profiles(id, quartet_name, profile_logo_path)')
        .eq('user_id', user.id)
        .limit(4)
    : { data: null }

  // Fetch recent posts from followed groups
  const { data: recentPosts } = await supabase
    .from('barber_feed_posts')
    .select('*')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(6)

  return (
    <div className="space-y-12">
      {/* Hero */}
      <div className="text-center py-12">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 mb-4">
          Welcome to Barber Shopping
        </h1>
        <p className="text-lg text-zinc-600 max-w-2xl mx-auto mb-8">
          Discover the latest apparel from your favorite groups, follow creators, and explore the Barber Feed
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/app/barber-feed" className="px-8 py-3 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition font-medium">
            Explore Barber Feed
          </Link>
          <Link href="/app/shop" className="px-8 py-3 border-2 border-zinc-300 text-zinc-900 rounded-lg hover:bg-zinc-50 transition font-medium">
            Browse Shop
          </Link>
        </div>
      </div>

      {/* Followed Groups */}
      {followedGroups && followedGroups.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-zinc-900">Following</h2>
            <Link href="/app/following" className="text-sm text-zinc-600 hover:text-zinc-900 underline">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {followedGroups.map((follow: any) => (
              <Link
                key={follow.group_id}
                href={`/app/group/${follow.group_id}`}
                className="group p-4 bg-white border border-zinc-200 rounded-lg hover:border-zinc-400 transition"
              >
                {follow.profiles?.profile_logo_path && (
                  <img
                    src={follow.profiles.profile_logo_path}
                    alt={follow.profiles.quartet_name}
                    className="w-12 h-12 rounded-full mb-3 bg-zinc-100"
                  />
                )}
                <h3 className="font-medium text-zinc-900 group-hover:text-zinc-600">{follow.profiles?.quartet_name}</h3>
                <p className="text-xs text-zinc-500 mt-1">Following</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent from Barber Feed */}
      {recentPosts && recentPosts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-zinc-900">From the Barber Feed</h2>
            <Link href="/app/barber-feed" className="text-sm text-zinc-600 hover:text-zinc-900 underline">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentPosts.slice(0, 6).map((post: any) => (
              <Link
                key={post.id}
                href={`/app/barber-feed/${post.id}`}
                className="group bg-white border border-zinc-200 rounded-lg overflow-hidden hover:border-zinc-400 transition"
              >
                <div className="aspect-video bg-zinc-200 overflow-hidden">
                  {post.media_public_url && (
                    <img
                      src={post.media_public_url}
                      alt={post.caption}
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                    />
                  )}
                </div>
                <div className="p-4">
                  <p className="text-sm text-zinc-600 line-clamp-2">{post.caption}</p>
                  <div className="flex gap-4 mt-3 text-xs text-zinc-500">
                    <span>{post.like_count} likes</span>
                    <span>{post.share_count} shares</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {(!followedGroups || followedGroups.length === 0) && (
        <div className="text-center py-16">
          <h2 className="text-2xl font-bold text-zinc-900 mb-3">Start exploring</h2>
          <p className="text-zinc-600 mb-6">Follow groups to see their latest posts on your home feed</p>
          <Link href="/app/barber-feed" className="inline-block px-8 py-3 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition font-medium">
            Browse the Barber Feed
          </Link>
        </div>
      )}
    </div>
  )
}
