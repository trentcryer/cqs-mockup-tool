import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/api-auth'
import { getProductsInCollection, listCollections, getProductStorefrontUrl, getCollectionStorefrontUrl } from '@/lib/shopify'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: profile } = await admin.from('profiles').select('*').eq('id', user.id).single() as { data: any }

  const collectionId = profile?.shopify_collection_id
  const groupName = profile?.quartet_name || 'My Group'

  const collections = collectionId ? await listCollections(true).catch(() => []) : []
  const collection = collections.find(c => c.id === collectionId)
  const collectionUrl = collection ? getCollectionStorefrontUrl(collection.handle) : ''

  const products = collectionId
    ? (await getProductsInCollection(collectionId).catch(() => []))
        .filter(p => p.image)
        .map(p => ({ id: p.id, title: p.title, image: p.image as string, price: p.price, url: getProductStorefrontUrl(p.handle) }))
    : []

  const { data: logosRaw } = await admin
    .from('logos')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false }) as { data: any[] | null }

  const logoPaths = (logosRaw || []).map((l: any) => l.storage_path)
  const signedMap: Record<string, string> = {}
  if (logoPaths.length > 0) {
    const { data: signedData } = await admin.storage.from('cqs-assets').createSignedUrls(logoPaths, 3600)
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

  return NextResponse.json({ groupName, collectionId: collectionId ?? null, collectionUrl, products, logos })
}
