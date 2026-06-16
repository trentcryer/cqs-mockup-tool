import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { listCollections, createCollection, addToQuartetDirectory, deleteCollection } from '@/lib/shopify'
import GroupsClient, { type CollectionRow } from './GroupsClient'

export default async function GroupsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const trentEmail = process.env.TRENT_EMAIL?.toLowerCase()
  if (!trentEmail || user.email?.toLowerCase() !== trentEmail) redirect('/admin')

  const admin = createAdminClient()

  const [collectionsResult, profilesResult, designsResult, authResult] = await Promise.all([
    listCollections(true).catch(() => []),
    admin.from('profiles').select('id, email, quartet_name, shopify_collection_id, shopify_collection_title, created_at'),
    admin.from('designs').select('user_id'),
    admin.auth.admin.listUsers({ perPage: 500 }),
  ])

  const profiles: any[] = profilesResult.data || []
  const designs: any[] = (designsResult.data || []) as any[]
  const authUsers = authResult.data?.users || []

  const profileByCollectionId = new Map(
    profiles
      .filter((p: any) => p.shopify_collection_id)
      .map((p: any) => [p.shopify_collection_id, p])
  )
  const designCountByUser = new Map<string, number>()
  for (const d of designs) {
    designCountByUser.set(d.user_id, (designCountByUser.get(d.user_id) ?? 0) + 1)
  }
  const authUserById = new Map(authUsers.map(u => [u.id, u]))

  const collections: CollectionRow[] = collectionsResult.map((c: any) => {
    const profile = profileByCollectionId.get(c.id)
    const authUser = profile ? authUserById.get(profile.id) : undefined
    return {
      id: c.id,
      title: c.title,
      handle: c.handle,
      account: profile ? {
        id: profile.id,
        email: profile.email || authUser?.email || '',
        quartet_name: profile.quartet_name || c.title,
        design_count: designCountByUser.get(profile.id) ?? 0,
        created_at: authUser?.created_at || profile.created_at || '',
      } : null,
    }
  })

  // ── Server actions ──────────────────────────────────────────────

  async function createCollectionAndAccount(
    fd: FormData
  ): Promise<{ magicLink: string; collectionTitle: string } | { error: string }> {
    'use server'
    const collectionTitle = (fd.get('collectionTitle') as string).trim()
    const email = (fd.get('email') as string).trim().toLowerCase()
    if (!collectionTitle || !email) return { error: 'Collection name and email are required' }

    const a = createAdminClient()

    // Create the Shopify collection
    let newCollection: any
    try {
      newCollection = await createCollection(collectionTitle)
    } catch (e: any) {
      return { error: `Shopify error: ${e.message}` }
    }

    // Generate magic link — creates the Supabase user if they don't exist
    const { data: linkData, error: linkErr } = await (a.auth.admin as any).generateLink({
      type: 'magiclink',
      email,
    })
    if (linkErr || !linkData?.properties?.action_link) {
      return { error: linkErr?.message ?? 'Failed to generate sign-in link' }
    }

    // Link profile to the new collection
    await (a.from('profiles') as any).upsert({
      id: linkData.user.id,
      email,
      quartet_name: collectionTitle,
      shopify_collection_id: newCollection.id,
      shopify_collection_title: newCollection.title,
    }, { onConflict: 'id' })

    // Add to the quartets directory page on Shopify
    await addToQuartetDirectory(collectionTitle, newCollection.handle).catch(() => {})

    revalidatePath('/admin/groups')
    return { magicLink: linkData.properties.action_link, collectionTitle }
  }

  async function assignEmail(
    fd: FormData
  ): Promise<{ magicLink: string; collectionTitle: string } | { error: string }> {
    'use server'
    const collectionId = parseInt(fd.get('collectionId') as string)
    const collectionTitle = fd.get('collectionTitle') as string
    const email = (fd.get('email') as string).trim().toLowerCase()
    if (!collectionId || !email) return { error: 'Missing fields' }

    const a = createAdminClient()

    const { data: linkData, error: linkErr } = await (a.auth.admin as any).generateLink({
      type: 'magiclink',
      email,
    })
    if (linkErr || !linkData?.properties?.action_link) {
      return { error: linkErr?.message ?? 'Failed to generate sign-in link' }
    }

    await (a.from('profiles') as any).upsert({
      id: linkData.user.id,
      email,
      quartet_name: collectionTitle,
      shopify_collection_id: collectionId,
      shopify_collection_title: collectionTitle,
    }, { onConflict: 'id' })

    revalidatePath('/admin/groups')
    return { magicLink: linkData.properties.action_link, collectionTitle }
  }

  async function generateMagicLink(
    fd: FormData
  ): Promise<{ magicLink: string } | { error: string }> {
    'use server'
    const email = (fd.get('email') as string).trim().toLowerCase()
    if (!email) return { error: 'No email on file' }

    const a = createAdminClient()
    const { data: linkData, error: linkErr } = await (a.auth.admin as any).generateLink({
      type: 'magiclink',
      email,
    })
    if (linkErr || !linkData?.properties?.action_link) {
      return { error: linkErr?.message ?? 'Failed to generate link' }
    }
    return { magicLink: linkData.properties.action_link }
  }

  async function deleteGroup(fd: FormData) {
    'use server'
    const userId = fd.get('userId') as string
    const collectionId = parseInt(fd.get('collectionId') as string)
    const a = createAdminClient()
    if (userId) await a.auth.admin.deleteUser(userId)
    if (collectionId) await deleteCollection(collectionId).catch(() => {})
    revalidatePath('/admin/groups')
  }

  async function bulkDeleteGroups(fd: FormData) {
    'use server'
    const items: Array<{ collectionId: number; userId?: string }> = JSON.parse(fd.get('items') as string)
    const a = createAdminClient()
    await Promise.all(items.map(async item => {
      if (item.userId) await a.auth.admin.deleteUser(item.userId).catch(() => {})
      if (item.collectionId) await deleteCollection(item.collectionId).catch(() => {})
    }))
    revalidatePath('/admin/groups')
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow">CQS Internal</div>
          <h1 className="text-3xl font-semibold tracking-tight">Groups</h1>
          <p className="text-sm text-[#6b5f54] mt-1">
            Create collections and send groups a one-click sign-in link.
          </p>
        </div>
        <Link href="/admin" className="text-sm text-[#6b5f54] hover:underline">← Admin Dashboard</Link>
      </div>

      <GroupsClient
        collections={collections}
        createCollectionAction={createCollectionAndAccount}
        assignEmailAction={assignEmail}
        generateLinkAction={generateMagicLink}
        deleteAction={deleteGroup}
        bulkDeleteAction={bulkDeleteGroups}
      />
    </div>
  )
}
