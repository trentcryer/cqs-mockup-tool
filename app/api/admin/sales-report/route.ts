import { NextRequest, NextResponse } from 'next/server'
import { getProductsInCollection, getOrderLineItemsInDateRange, applyPriceSuggestion } from '@/lib/shopify'
import { isAdminUser } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  try {
  if (!await isAdminUser(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const collectionId = parseInt(searchParams.get('collectionId') || '')
  const collectionType = searchParams.get('collectionType') === 'smart' ? 'smart' : 'custom'
  const startDate = searchParams.get('startDate') || ''
  const endDate = searchParams.get('endDate') || ''

  if (!collectionId || !startDate || !endDate) {
    return NextResponse.json({ error: 'Missing required params' }, { status: 400 })
  }
    const products = await getProductsInCollection(collectionId, collectionType)
    const productIds = new Set(products.map(p => p.id))

    const today = new Date()
    const sixtyDaysAgo = new Date(today)
    sixtyDaysAgo.setDate(today.getDate() - 60)
    const fetchFrom = new Date(startDate) < sixtyDaysAgo ? startDate : sixtyDaysAgo.toISOString()

    const allItems = await getOrderLineItemsInDateRange(fetchFrom, endDate)
    const collectionItems = allItems.filter(i => productIds.has(i.productId))

    const reportItems = collectionItems.filter(i => i.orderedAt >= startDate && i.orderedAt <= endDate)

    const staleCutoff = sixtyDaysAgo.toISOString()
    const recentlySoldIds = new Set(
      collectionItems.filter(i => i.orderedAt >= staleCutoff).map(i => i.productId)
    )

    // Aggregate per product — track full-price and discounted separately
    type Agg = {
      units: number
      revenue: number
      unitsDiscounted: number
      revenueDiscounted: number
      lastSoldAt: string | null
      couponCodes: Set<string>
    }
    const agg = new Map<number, Agg>()
    for (const p of products) {
      agg.set(p.id, { units: 0, revenue: 0, unitsDiscounted: 0, revenueDiscounted: 0, lastSoldAt: null, couponCodes: new Set() })
    }

    for (const item of reportItems) {
      const entry = agg.get(item.productId)!
      const lineRevenue = item.price * item.quantity
      entry.units += item.quantity
      entry.revenue += lineRevenue
      if (item.discountCodes.length > 0) {
        entry.unitsDiscounted += item.quantity
        entry.revenueDiscounted += lineRevenue
        item.discountCodes.forEach(c => entry.couponCodes.add(c))
      }
      if (!entry.lastSoldAt || item.orderedAt > entry.lastSoldAt) entry.lastSoldAt = item.orderedAt
    }

    const r = (n: number) => Math.round(n * 100) / 100

    const reportProducts = products.map(p => {
      const { units, revenue, unitsDiscounted, revenueDiscounted, lastSoldAt, couponCodes } = agg.get(p.id)!
      const stale = !recentlySoldIds.has(p.id)
      const currentPrice = p.price ? parseFloat(p.price) : null
      return {
        productId: p.id,
        title: p.title,
        image: p.image,
        price: p.price,
        status: p.status,
        unitsSold: units,
        revenue: r(revenue),
        unitsDiscounted,
        revenueDiscounted: r(revenueDiscounted),
        unitsFull: units - unitsDiscounted,
        revenueFull: r(revenue - revenueDiscounted),
        couponCodes: [...couponCodes],
        lastSoldAt,
        stale,
        suggestedPrice: stale && currentPrice ? (currentPrice * 0.85).toFixed(2) : null,
      }
    }).sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue)

    const totalUnits = reportProducts.reduce((s, p) => s + p.unitsSold, 0)
    const totalRevenue = r(reportProducts.reduce((s, p) => s + p.revenue, 0))
    const totalUnitsDiscounted = reportProducts.reduce((s, p) => s + p.unitsDiscounted, 0)
    const totalRevenueDiscounted = r(reportProducts.reduce((s, p) => s + p.revenueDiscounted, 0))

    return NextResponse.json({
      products: reportProducts,
      totalUnits,
      totalRevenue,
      totalUnitsDiscounted,
      totalRevenueDiscounted,
      totalUnitsFull: totalUnits - totalUnitsDiscounted,
      totalRevenueFull: r(totalRevenue - totalRevenueDiscounted),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!await isAdminUser(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { productId } = await req.json()
  if (!productId) return NextResponse.json({ error: 'Missing productId' }, { status: 400 })

  try {
    await applyPriceSuggestion(productId)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
