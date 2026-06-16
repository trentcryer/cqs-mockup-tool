import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { isAdminUser } from '@/lib/api-auth'
import { getOrderLineItemsInDateRange, SalesLineItem } from '@/lib/shopify'
import { createAdminClient } from '@/lib/supabase/server'
import { format, subDays, startOfDay, startOfMonth, startOfWeek } from 'date-fns'

function r(n: number) { return Math.round(n * 100) / 100 }

// All-time orders are expensive to paginate — cache for 4 hours
const getAllTimeItems = unstable_cache(
  () => getOrderLineItemsInDateRange('2020-01-01T00:00:00Z', new Date().toISOString()),
  ['homebase-all-time-orders'],
  { revalidate: 14400 }
)

export async function GET(req: NextRequest) {
  if (!await isAdminUser(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const now = new Date()
    const todayStart = startOfDay(now).toISOString()
    const weekStart  = startOfWeek(now, { weekStartsOn: 1 }).toISOString()
    const monthStart = startOfMonth(now).toISOString()
    const day90Start = subDays(now, 90).toISOString()
    const day30Start = subDays(now, 30).toISOString()
    const nowIso     = now.toISOString()

    const supabase = createAdminClient()

    // All-time is cached; last-90 and Supabase queries run fresh in parallel
    const [
      allTimeItems,
      last90Items,
      profilesRes,
      designsRes,
      recentDesignsRes,
    ] = await Promise.all([
      getAllTimeItems(),
      getOrderLineItemsInDateRange(day90Start, nowIso),
      supabase.from('profiles').select('id, email, quartet_name, created_at'),
      supabase.from('designs').select('id, created_at, user_id, product_id, notes'),
      supabase.from('designs').select('id, created_at, notes').order('created_at', { ascending: false }).limit(10),
    ])

    const profiles: any[]       = profilesRes.data ?? []
    const allDesigns: any[]      = designsRes.data ?? []
    const recentDesigns: any[]   = recentDesignsRes.data ?? []

    // ── KPIs ──────────────────────────────────────────────────────────────────
    const todayItems  = last90Items.filter(i => i.orderedAt >= todayStart)
    const weekItems   = last90Items.filter(i => i.orderedAt >= weekStart)
    const monthItems  = last90Items.filter(i => i.orderedAt >= monthStart)
    const last30Items = last90Items.filter(i => i.orderedAt >= day30Start)

    const sumRevenue = (items: SalesLineItem[]) =>
      r(items.reduce((s, i) => s + i.price * i.quantity, 0))

    const todayRevenue  = sumRevenue(todayItems)
    const weekRevenue   = sumRevenue(weekItems)
    const mtdRevenue    = sumRevenue(monthItems)
    const last30Revenue = sumRevenue(last30Items)
    const totalRevenue  = sumRevenue(allTimeItems)

    const allOrders = new Set(allTimeItems.map(i => `${i.orderedAt.slice(0,10)}-${i.productId}-${i.variantId}`)).size
    const mtdOrders = new Set(monthItems.map(i => `${i.orderedAt.slice(0,10)}-${i.productId}-${i.variantId}`)).size
    const avgOrderValue = mtdOrders > 0 ? r(mtdRevenue / mtdOrders) : 0

    // ── Daily sales — last 30 days ─────────────────────────────────────────────
    const dailyMap = new Map<string, { revenue: number; orders: Set<string> }>()
    for (let d = 29; d >= 0; d--) {
      dailyMap.set(format(subDays(now, d), 'MMM d'), { revenue: 0, orders: new Set() })
    }
    for (const item of last30Items) {
      const day = format(new Date(item.orderedAt), 'MMM d')
      if (dailyMap.has(day)) {
        const e = dailyMap.get(day)!
        e.revenue = r(e.revenue + item.price * item.quantity)
        e.orders.add(`${item.orderedAt.slice(0,10)}-${item.productId}`)
      }
    }
    const dailySales = Array.from(dailyMap.entries()).map(([date, v]) => ({
      date, revenue: v.revenue, orders: v.orders.size,
    }))

    // ── Weekly revenue — last 12 weeks ─────────────────────────────────────────
    const weeklyMap = new Map<string, number>()
    for (let w = 11; w >= 0; w--) {
      weeklyMap.set(`W${format(subDays(now, w * 7), 'MM/dd')}`, 0)
    }
    for (const item of last90Items) {
      const d = Math.floor((now.getTime() - new Date(item.orderedAt).getTime()) / (7 * 86400000))
      if (d >= 0 && d < 12) {
        const label = `W${format(subDays(now, d * 7), 'MM/dd')}`
        weeklyMap.set(label, r((weeklyMap.get(label) ?? 0) + item.price * item.quantity))
      }
    }
    const weeklyRevenue = Array.from(weeklyMap.entries()).map(([week, revenue]) => ({ week, revenue }))

    // ── Top products (use title from line item) ────────────────────────────────
    const productMap = new Map<number, { title: string; revenue: number; units: number }>()
    for (const item of allTimeItems) {
      const existing = productMap.get(item.productId)
      if (existing) {
        existing.revenue = r(existing.revenue + item.price * item.quantity)
        existing.units += item.quantity
      } else {
        productMap.set(item.productId, {
          title: item.title || `Product #${item.productId}`,
          revenue: r(item.price * item.quantity),
          units: item.quantity,
        })
      }
    }
    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 25)

    // ── Signups ────────────────────────────────────────────────────────────────
    const last30Signups = profiles.filter(p => p.created_at >= day30Start).length
    const last30Designs = allDesigns.filter(d => d.created_at >= day30Start).length

    return NextResponse.json({
      kpis: {
        todayRevenue, weekRevenue, mtdRevenue, last30Revenue, totalRevenue,
        mtdOrders, allOrders, avgOrderValue,
        activeGroups: profiles.length, last30Signups,
        totalDesigns: allDesigns.length, last30Designs,
      },
      dailySales,
      weeklyRevenue,
      topProducts,
      recentDesigns: recentDesigns.map(d => ({
        id: d.id, createdAt: d.created_at, notes: d.notes,
      })),
      totalProfiles: profiles.length,
    })
  } catch (e: any) {
    console.error('Homebase API error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
