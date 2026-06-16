import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { listCollections } from '@/lib/shopify'

const getCachedCollections = unstable_cache(
  async () => listCollections(),
  ['shop-collections'],
  { revalidate: 600 }
)

export async function GET() {
  try {
    const collections = await getCachedCollections()
    return NextResponse.json({ collections })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
