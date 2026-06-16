import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { getProductsInCollection, listCollections } from '@/lib/shopify'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const collectionId = parseInt(id)
    if (isNaN(collectionId)) {
      return NextResponse.json({ error: 'Invalid collection id' }, { status: 400 })
    }

    const type = req.nextUrl.searchParams.get('type') === 'smart' ? 'smart' : 'custom'

    const getCached = unstable_cache(
      async () => {
        const [allCollections, products] = await Promise.all([
          listCollections(true),
          getProductsInCollection(collectionId, type),
        ])
        const col = allCollections.find(c => c.id === collectionId)
        const active = products.filter(p => p.status === 'active')
        return {
          collection: col ? { id: col.id, title: col.title } : { id: collectionId, title: '' },
          products: active,
        }
      },
      [`shop-collection-${collectionId}-${type}`],
      { revalidate: 300 }
    )

    const result = await getCached()
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
