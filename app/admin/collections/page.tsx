import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { listCollections } from '@/lib/shopify'
import Link from 'next/link'
import CollectionsClient from './CollectionsClient'

export default async function CollectionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const trentEmail = process.env.TRENT_EMAIL?.toLowerCase()
  if (!trentEmail || user.email?.toLowerCase() !== trentEmail) redirect('/admin')

  let collections: any[] = []
  try {
    collections = await listCollections()
  } catch (e) {
    console.error('[CQS SHOPIFY]', e)
  }

  // Build a map of collectionId → signed logo URL from Supabase designs
  const collectionLogoUrls: Record<number, string> = {}
  try {
    const admin = createAdminClient()

    // Get profiles that have a collection assigned
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, shopify_collection_id')
      .not('shopify_collection_id', 'is', null) as { data: { id: string; shopify_collection_id: number }[] | null }

    if (profiles?.length) {
      const userIds = profiles.map(p => p.id)
      const profileByUserId = Object.fromEntries(profiles.map(p => [p.id, p.shopify_collection_id]))

      // Get the most recent logo per user (one per collection)
      const { data: designs } = await admin
        .from('designs')
        .select('user_id, logo_path')
        .in('user_id', userIds)
        .not('logo_path', 'is', null)
        .order('created_at', { ascending: false }) as { data: { user_id: string; logo_path: string }[] | null }

      // Pick the first logo seen for each collection, then sign them all in parallel
      const toSign: { collectionId: number; logoPath: string }[] = []
      const seen = new Set<number>()
      for (const d of designs ?? []) {
        const colId = profileByUserId[d.user_id]
        if (colId && !seen.has(colId)) {
          seen.add(colId)
          toSign.push({ collectionId: colId, logoPath: d.logo_path })
        }
      }

      await Promise.all(toSign.map(async ({ collectionId, logoPath }) => {
        const { data } = await admin.storage.from('cqs-assets').createSignedUrl(logoPath, 3600)
        if (data?.signedUrl) collectionLogoUrls[collectionId] = data.signedUrl
      }))
    }
  } catch (e) {
    console.error('[CQS LOGOS]', e)
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="uppercase tracking-[2px] text-xs text-[#9b1c1c]">CQS Internal</div>
          <h1 className="text-3xl font-semibold tracking-tight">Collection Manager</h1>
          <p className="text-sm text-[#6b5f54] mt-1">Browse, publish, unpublish, and remove products from any Shopify collection.</p>
        </div>
        <Link href="/admin" className="text-sm text-[#6b5f54] hover:underline">← Admin Dashboard</Link>
      </div>

      {collections.length === 0 ? (
        <div className="card p-8 text-center text-sm text-[#8a7660]">
          Shopify collections unavailable — check your credentials.
        </div>
      ) : (
        <CollectionsClient collections={collections} collectionLogoUrls={collectionLogoUrls} />
      )}
    </div>
  )
}
