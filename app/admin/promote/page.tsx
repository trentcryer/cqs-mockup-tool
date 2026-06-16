import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { listCollections, getProductsInCollection, getProductStorefrontUrl, getCollectionStorefrontUrl } from '@/lib/shopify'
import PromoteBuilder from '@/components/promote/PromoteBuilder'

export default async function AdminPromotePage({
  searchParams,
}: {
  searchParams: Promise<{ collection?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const trentEmail = process.env.TRENT_EMAIL?.toLowerCase()
  if (!trentEmail || user.email?.toLowerCase() !== trentEmail) redirect('/admin')

  const { collection: collectionIdParam } = await searchParams
  const collections = await listCollections(true).catch(() => [])
  const selectedId = collectionIdParam ? parseInt(collectionIdParam) : collections[0]?.id

  const products = selectedId
    ? (await getProductsInCollection(selectedId).catch(() => []))
        .filter(p => p.image)
        .map(p => ({ id: p.id, title: p.title, image: p.image as string, price: p.price, url: getProductStorefrontUrl(p.handle) }))
    : []

  const selectedCollection = collections.find(c => c.id === selectedId)
  const collectionUrl = selectedCollection ? getCollectionStorefrontUrl(selectedCollection.handle) : ''

  // The owning group's logo library lives under their user_id, not the collection —
  // look up which profile this collection belongs to so admins can feature that group's logo.
  let logos: { id: string; storagePath: string; displayUrl: string | null; filename: string }[] = []
  if (selectedId) {
    const admin = createAdminClient()
    const { data: ownerProfile } = await (admin.from('profiles') as any)
      .select('id')
      .eq('shopify_collection_id', selectedId)
      .maybeSingle()

    if (ownerProfile?.id) {
      const { data: logosRaw } = await admin
        .from('logos')
        .select('*')
        .eq('user_id', ownerProfile.id)
        .order('created_at', { ascending: false })

      const logoPaths = (logosRaw || []).map((l: any) => l.storage_path)
      const signedMap: Record<string, string> = {}
      if (logoPaths.length > 0) {
        const { data: signedData } = await admin.storage.from('cqs-assets').createSignedUrls(logoPaths, 3600)
        for (const s of (signedData ?? [])) {
          if (s.path && s.signedUrl) signedMap[s.path] = s.signedUrl
        }
      }
      logos = (logosRaw || []).map((l: any) => ({
        id: l.id,
        storagePath: l.storage_path,
        displayUrl: signedMap[l.storage_path] ?? null,
        filename: l.filename,
      }))
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow">CQS Internal</div>
          <h1 className="text-3xl font-semibold tracking-tight">Promote My Store</h1>
          <p className="text-sm text-[#6b5f54] mt-1">Generate a social promo image for any group&apos;s collection.</p>
        </div>
        <Link href="/admin" className="text-sm text-[#6b5f54] hover:underline">← Admin Dashboard</Link>
      </div>

      <form method="GET" className="flex items-center gap-3">
        <label className="text-sm text-[#6b5f54]">Collection:</label>
        <select
          name="collection"
          defaultValue={selectedId}
          className="rounded-lg border-2 border-[#e3d8c8] px-3 py-2 text-sm"
        >
          {collections.map(c => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
        <button type="submit" className="btn-secondary px-4 py-2 rounded-lg text-sm">Load</button>
      </form>

      {!selectedCollection && (
        <p className="text-sm text-[#6b5f54]">No collections found.</p>
      )}

      {selectedCollection && (
        <PromoteBuilder groupName={selectedCollection.title} products={products} collectionUrl={collectionUrl} logos={logos} />
      )}
    </div>
  )
}
