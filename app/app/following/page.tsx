import { createClient } from '@/lib/supabase/server'

export default async function FollowingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: followedGroups } = user
    ? await supabase
        .from('feed_followers')
        .select('*, profiles(id, quartet_name, profile_logo_path)')
        .eq('user_id', user.id)
        .order('followed_at', { ascending: false })
    : { data: null }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900">Following</h1>
        <p className="text-zinc-600 mt-1">Groups you're subscribed to</p>
      </div>

      {followedGroups && followedGroups.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {followedGroups.map((follow: any) => (
            <div key={follow.group_id} className="bg-white border border-zinc-200 rounded-lg p-4 hover:border-zinc-400 transition">
              {follow.profiles?.profile_logo_path && (
                <img
                  src={follow.profiles.profile_logo_path}
                  alt={follow.profiles.quartet_name}
                  className="w-16 h-16 rounded-full mb-3 bg-zinc-100 mx-auto"
                />
              )}
              <h3 className="font-semibold text-zinc-900 text-center">{follow.profiles?.quartet_name}</h3>
              <p className="text-xs text-zinc-500 text-center mt-2">
                Following since {new Date(follow.followed_at).toLocaleDateString()}
              </p>
              <button className="w-full mt-4 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition text-sm font-medium">
                Unfollow
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-xl text-zinc-400 mb-4">Not following anyone yet</p>
          <p className="text-zinc-500">Explore the Barber Feed to find groups to follow</p>
        </div>
      )}
    </div>
  )
}
