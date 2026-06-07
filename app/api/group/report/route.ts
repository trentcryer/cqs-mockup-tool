import { NextRequest, NextResponse } from 'next/server'
import { getProductsInCollection, getOrderLineItemsInDateRange } from '@/lib/shopify'
import { getAuthUser } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await (admin as any)
      .from('profiles')
      .select('shopify_collection_id, shopify_collection_type')
      .eq('id', user.id)
      .single() as { data: { shopify_collection_id: string; shopify_collection_type: string } | null }

    if (!profile?.shopify_collection_id) {
      return NextResponse.json({ error: 'No collection linked to your account' }, { status: 400 })
    }

    const { searchParams } = req.nextUrl
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''
    if (!startDate || !endDate) return NextResponse.json({ error: 'Missing date range' }, { status: 400 })

    const collectionType = profile.shopify_collection_type === 'smart' ? 'smart' : 'custom'
    const products = await getProductsInCollection(Number(profile.shopify_collection_id), collectionType)
    const productIds = new Set(products.map((p: any) => p.id))

    const allItems = await getOrderLineItemsInDateRange(startDate, endDate)
    const items = allItems.filter((i: any) => productIds.has(i.productId) && i.orderedAt >= startDate && i.orderedAt <= endDate)

    const agg = new Map<number, { units: number; revenue: number; lastSoldAt: string | null }>()
    for (const p of products) agg.set(p.id, { units: 0, revenue: 0, lastSoldAt: null })

    for (const item of items) {
      const e = agg.get(item.productId)!
      e.units += item.quantity
      e.revenue += item.price * item.quantity
      if (!e.lastSoldAt || item.orderedAt > e.lastSoldAt) e.lastSoldAt = item.orderedAt
    }

    const r = (n: number) => Math.round(n * 100) / 100
    const reportProducts = products.map((p: any) => {
      const { units, revenue, lastSoldAt } = agg.get(p.id)!
      return { productId: p.id, title: p.title, image: p.image, price: p.price, unitsSold: units, revenue: r(revenue), lastSoldAt }
    }).sort((a: any, b: any) => b.unitsSold - a.unitsSold)

    return NextResponse.json({
      products: reportProducts,
      totalUnits: reportProducts.reduce((s: number, p: any) => s + p.unitsSold, 0),
      totalRevenue: r(reportProducts.reduce((s: number, p: any) => s + p.revenue, 0)),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
