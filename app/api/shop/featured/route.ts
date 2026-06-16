import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { listCollections, getProductsInCollection } from '@/lib/shopify'

const getCachedFeatured = unstable_cache(
  async () => {
    const allCollections = await listCollections(true)
    const topCollections = allCollections.slice(0, 6)

    const results: any[] = []
    for (const col of topCollections) {
      try {
        const products = await getProductsInCollection(col.id, col.type)
        const active = products.filter(p => p.status === 'active').slice(0, 3)
        for (const p of active) {
          results.push({
            id: p.id,
            title: p.title,
            image: p.image,
            price: p.price,
            collection_id: col.id,
            collection_title: col.title,
          })
        }
      } catch {
        // skip collections that fail
      }
    }

    const seen = new Set<number>()
    const deduped = results.filter(p => {
      if (seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })

    return { products: deduped.slice(0, 12) }
  },
  ['shop-featured'],
  { revalidate: 900 }
)

export async function GET() {
  try {
    return NextResponse.json(await getCachedFeatured())
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
