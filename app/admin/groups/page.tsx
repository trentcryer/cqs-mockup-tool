import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import GroupsClient, { type GroupRow } from './GroupsClient'

function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return 'CQS-' + Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default async function GroupsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const trentEmail = process.env.TRENT_EMAIL?.toLowerCase()
  if (!trentEmail || user.email?.toLowerCase() !== trentEmail) redirect('/admin')

  const admin = createAdminClient()

  // Fetch all auth users
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 500 })

  // Fetch all profiles
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, quartet_name, shopify_collection_title')

  // Fetch design counts per user
  const { data: designCounts } = await admin
    .from('designs')
    .select('user_id') as { data: { user_id: string }[] | null }

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]))
  const countMap = new Map<string, number>()
  for (const d of designCounts ?? []) {
    countMap.set(d.user_id, (countMap.get(d.user_id) ?? 0) + 1)
  }

  const groups: GroupRow[] = users
    .filter(u => u.email?.toLowerCase() !== trentEmail)
    .map(u => {
      const profile = profileMap.get(u.id)
      return {
        id: u.id,
        email: u.email ?? '',
        quartet_name: profile?.quartet_name ?? 'Unknown Group',
        shopify_collection_title: profile?.shopify_collection_title ?? null,
        created_at: u.created_at,
        design_count: countMap.get(u.id) ?? 0,
      }
    })
    .sort((a, b) => a.quartet_name.localeCompare(b.quartet_name))

  async function createGroup(fd: FormData): Promise<{ email: string; password: string } | { error: string }> {
    'use server'
    const quartetName = fd.get('quartetName') as string
    const email = fd.get('email') as string
    if (!quartetName || !email) return { error: 'Missing fields' }

    const password = generatePassword()
    const a = createAdminClient()

    const { data, error } = await a.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (error) return { error: error.message }

    // Profile is auto-created by trigger — update the quartet name
    await (a.from('profiles') as any).update({ quartet_name: quartetName }).eq('id', data.user.id)

    revalidatePath('/admin/groups')
    return { email, password }
  }

  async function deleteGroup(fd: FormData) {
    'use server'
    const userId = fd.get('userId') as string
    if (!userId) return
    const a = createAdminClient()
    await a.auth.admin.deleteUser(userId)
    revalidatePath('/admin/groups')
  }

  async function updateName(fd: FormData) {
    'use server'
    const userId = fd.get('userId') as string
    const quartetName = fd.get('quartetName') as string
    if (!userId || !quartetName) return
    const a = createAdminClient()
    await (a.from('profiles') as any).update({ quartet_name: quartetName }).eq('id', userId)
    revalidatePath('/admin/groups')
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="uppercase tracking-[2px] text-xs text-[#9b1c1c]">CQS Internal</div>
          <h1 className="text-3xl font-semibold tracking-tight">Group Accounts</h1>
          <p className="text-sm text-[#6b5f54] mt-1">Create and manage quartet/group portal accounts.</p>
        </div>
        <Link href="/admin" className="text-sm text-[#6b5f54] hover:underline">← Admin Dashboard</Link>
      </div>

      <GroupsClient
        groups={groups}
        createAction={createGroup}
        deleteAction={deleteGroup}
        updateNameAction={updateName}
      />
    </div>
  )
}
