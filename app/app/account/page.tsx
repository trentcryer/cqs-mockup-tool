import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = user
    ? await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
    : { data: null }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900">Account Settings</h1>
        <p className="text-zinc-600 mt-1">Manage your Barbershopper profile</p>
      </div>

      {/* Profile Section */}
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-zinc-900 mb-6">Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">Name</label>
            <p className="text-zinc-900">{(profile as any)?.display_name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">Email</label>
            <p className="text-zinc-900">{user?.email}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">Account Type</label>
            <p className="text-zinc-900">Barbershopper</p>
          </div>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-zinc-900 mb-6">Preferences</h2>
        <p className="text-zinc-600 text-sm mb-6">Notification and privacy settings coming soon</p>
      </div>

      {/* Social Media Section */}
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-zinc-900 mb-6">Connect Social Media</h2>
        <p className="text-zinc-600 text-sm mb-6">Link your social accounts to share Barber Feed posts directly</p>
        <div className="space-y-3">
          <button className="w-full px-4 py-2 border border-zinc-300 rounded-lg hover:bg-zinc-50 transition text-sm font-medium">
            Connect Instagram
          </button>
          <button className="w-full px-4 py-2 border border-zinc-300 rounded-lg hover:bg-zinc-50 transition text-sm font-medium">
            Connect TikTok
          </button>
          <button className="w-full px-4 py-2 border border-zinc-300 rounded-lg hover:bg-zinc-50 transition text-sm font-medium">
            Connect X (Twitter)
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-red-900 mb-4">Danger Zone</h2>
        <form action="/auth/signout" method="POST">
          <button
            type="submit"
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
          >
            Sign Out
          </button>
        </form>
      </div>
    </div>
  )
}
