import { NextRequest, NextResponse } from 'next/server'
import {
  getProductsInCollection,
  batchUpdateProductStatus,
  removeFromCollection,
  deleteProducts,
} from '@/lib/shopify'
import { isAdminUser } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  if (!await isAdminUser(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const collectionId = parseInt(req.nextUrl.searchParams.get('collectionId') || '')
  if (!collectionId) return NextResponse.json({ error: 'Missing collectionId' }, { status: 400 })
  const collectionType = req.nextUrl.searchParams.get('collectionType') === 'smart' ? 'smart' : 'custom'

  try {
    const products = await getProductsInCollection(collectionId, collectionType)
    return NextResponse.json({ products })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!await isAdminUser(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, productIds, collectIds } = await req.json()

  try {
    if (action === 'live') await batchUpdateProductStatus(productIds, 'active')
    else if (action === 'draft') await batchUpdateProductStatus(productIds, 'draft')
    else if (action === 'remove') await removeFromCollection(collectIds)
    else if (action === 'delete') await deleteProducts(productIds)
    else return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
