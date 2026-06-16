import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/api-auth'
import { listCollections, getProductsInCollection, getProductStorefrontUrl, getCollectionStorefrontUrl } from '@/lib/shopify'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminUser(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const selectedId = parseInt(id)

  const collections = await listCollections(true).catch(() => [])
  const selectedCollection = collections.find(c => c.id === selectedId)
  if (!selectedCollection) return NextResponse.json({ error: 'Collection not found' }, { status: 404 })

  const collectionUrl = getCollectionStorefrontUrl(selectedCollection.handle)

  const products = (await getProductsInCollection(selectedId).catch(() => []))
    .filter(p => p.image)
    .map(p => ({ id: p.id, title: p.title, image: p.image as string, price: p.price, url: getProductStorefrontUrl(p.handle) }))

  let logos: { id: string; storagePath: string; displayUrl: string | null; filename: string }[] = []
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
      .order('created_at', { ascending: false }) as { data: any[] | null }

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

  return NextResponse.json({ groupName: selectedCollection.title, collectionUrl, products, logos })
}
