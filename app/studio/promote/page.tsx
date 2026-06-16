import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getProductsInCollection, listCollections, getProductStorefrontUrl, getCollectionStorefrontUrl } from '@/lib/shopify'
import PromoteBuilder from '@/components/promote/PromoteBuilder'

export default async function StudioPromotePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const collectionId = (profile as any)?.shopify_collection_id
  const groupName = (profile as any)?.quartet_name || 'My Group'

  const collections = collectionId ? await listCollections(true).catch(() => []) : []
  const collection = collections.find(c => c.id === collectionId)
  const collectionUrl = collection ? getCollectionStorefrontUrl(collection.handle) : ''

  const products = collectionId
    ? (await getProductsInCollection(collectionId).catch(() => []))
        .filter(p => p.image)
        .map(p => ({ id: p.id, title: p.title, image: p.image as string, price: p.price, url: getProductStorefrontUrl(p.handle) }))
    : []

  const { data: logosRaw } = await supabase
    .from('logos')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const logoPaths = (logosRaw || []).map((l: any) => l.storage_path)
  const signedMap: Record<string, string> = {}
  if (logoPaths.length > 0) {
    const { data: signedData } = await supabase.storage.from('cqs-assets').createSignedUrls(logoPaths, 3600)
    for (const s of (signedData ?? [])) {
      if (s.path && s.signedUrl) signedMap[s.path] = s.signedUrl
    }
  }
  const logos = (logosRaw || []).map((l: any) => ({
    id: l.id,
    storagePath: l.storage_path,
    displayUrl: signedMap[l.storage_path] ?? null,
    filename: l.filename,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Promote My Store</h1>
          <p className="text-sm text-[#6b5f54] mt-1">Create a promo image for your collection to share on social media.</p>
        </div>
        <Link href="/studio" className="text-sm text-[#6b5f54] hover:underline">← My Studio</Link>
      </div>

      {!collectionId && (
        <p className="text-sm text-[#6b5f54]">Your group isn&apos;t linked to a collection yet — contact CQS to get set up.</p>
      )}

      {collectionId && <PromoteBuilder groupName={groupName} products={products} collectionUrl={collectionUrl} logos={logos} />}
    </div>
  )
}
