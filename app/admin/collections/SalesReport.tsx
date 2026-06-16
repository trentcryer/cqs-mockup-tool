'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, AlertTriangle, TrendingDown, Tag } from 'lucide-react'
import type { ShopifyCollection } from '@/lib/shopify'

type DatePreset = '7d' | '30d' | '90d' | 'ytd' | 'lifetime' | 'custom'
type CouponFilter = 'all' | 'full' | 'discounted'

interface ProductReport {
  productId: number
  title: string
  image: string | null
  price: string | null
  status: 'active' | 'draft'
  unitsSold: number
  revenue: number
  unitsFull: number
  revenueFull: number
  unitsDiscounted: number
  revenueDiscounted: number
  couponCodes: string[]
  lastSoldAt: string | null
  stale: boolean
  suggestedPrice: string | null
}

interface ReportData {
  products: ProductReport[]
  totalUnits: number
  totalRevenue: number
  totalUnitsFull: number
  totalRevenueFull: number
  totalUnitsDiscounted: number
  totalRevenueDiscounted: number
}

interface Props {
  collection: ShopifyCollection
}

const PRESETS: [DatePreset, string][] = [
  ['7d', 'Last 7 days'],
  ['30d', 'Last 30 days'],
  ['90d', 'Last 90 days'],
  ['ytd', 'Year to date'],
  ['lifetime', 'Lifetime'],
  ['custom', 'Custom'],
]

function getPresetRange(preset: Exclude<DatePreset, 'custom'>): { start: string; end: string } {
  const today = new Date()
  const end = today.toISOString()
  const start = new Date(today)
  if (preset === '7d') start.setDate(today.getDate() - 7)
  else if (preset === '30d') start.setDate(today.getDate() - 30)
  else if (preset === '90d') start.setDate(today.getDate() - 90)
  else if (preset === 'ytd') { start.setMonth(0); start.setDate(1); start.setHours(0, 0, 0, 0) }
  else if (preset === 'lifetime') return { start: '2020-01-01T00:00:00.000Z', end }
  return { start: start.toISOString(), end }
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function SalesReport({ collection }: Props) {
  const [preset, setPreset] = useState<DatePreset>('30d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [customerView, setCustomerView] = useState(false)
  const [couponFilter, setCouponFilter] = useState<CouponFilter>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ReportData | null>(null)
  const [applyingId, setApplyingId] = useState<number | null>(null)
  const [appliedIds, setAppliedIds] = useState<Set<number>>(new Set())

  const fetchReport = useCallback(async (start: string, end: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        collectionId: collection.id.toString(),
        collectionType: collection.type,
        startDate: start,
        endDate: end,
      })
      const res = await fetch(`/api/admin/sales-report?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setData(json)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [collection.id, collection.type])

  useEffect(() => {
    if (preset === 'custom') return
    const { start, end } = getPresetRange(preset as Exclude<DatePreset, 'custom'>)
    fetchReport(start, end)
  }, [preset, fetchReport])

  async function handleApplyPrice(productId: number, suggestedPrice: string) {
    setApplyingId(productId)
    try {
      const res = await fetch('/api/admin/sales-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setAppliedIds(prev => new Set(prev).add(productId))
      setData(prev => prev ? {
        ...prev,
        products: prev.products.map(p =>
          p.productId === productId ? { ...p, price: suggestedPrice, stale: false, suggestedPrice: null } : p
        ),
      } : prev)
    } catch (e: any) {
      alert('Failed to apply price: ' + e.message)
    } finally {
      setApplyingId(null)
    }
  }

  function handleCustomLoad() {
    if (!customStart || !customEnd) return
    fetchReport(
      new Date(customStart).toISOString(),
      new Date(customEnd + 'T23:59:59').toISOString(),
    )
  }

  // Apply coupon filter to products
  const filteredProducts = (data?.products ?? []).filter(p => {
    if (couponFilter === 'full') return p.unitsFull > 0
    if (couponFilter === 'discounted') return p.unitsDiscounted > 0
    return true
  })

  const displayUnits = couponFilter === 'full' ? data?.totalUnitsFull
    : couponFilter === 'discounted' ? data?.totalUnitsDiscounted
    : data?.totalUnits
  const displayRevenue = couponFilter === 'full' ? data?.totalRevenueFull
    : couponFilter === 'discounted' ? data?.totalRevenueDiscounted
    : data?.totalRevenue

  const staleCount = filteredProducts.filter(p => p.stale && p.suggestedPrice).length
  const soldCount = filteredProducts.filter(p => p.unitsSold > 0).length
  const hasDiscounts = (data?.totalUnitsDiscounted ?? 0) > 0

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Controls bar */}
      <div className="px-5 py-3 border-b border-[#e8dcc8] bg-white shrink-0 space-y-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date presets */}
          <div className="flex items-center gap-1 flex-wrap">
            {PRESETS.map(([p, label]) => (
              <button key={p} onClick={() => setPreset(p)}
                className={`px-3 py-1 text-xs rounded-lg transition ${
                  preset === p ? 'bg-[#1c1412] text-white' : 'bg-[#f0e8d8] text-[#6b5f54] hover:bg-[#e8dcc8]'
                }`}>
                {label}
              </button>
            ))}
          </div>

          {/* Customer view toggle */}
          <div className="ml-auto flex items-center gap-2 text-xs text-[#6b5f54] shrink-0">
            <span>Customer view</span>
            <button onClick={() => setCustomerView(v => !v)}
              className={`relative w-8 h-[18px] rounded-full transition ${customerView ? 'bg-[#1c1412]' : 'bg-[#d4c5b0]'}`}>
              <span className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-all ${customerView ? 'left-[18px]' : 'left-0.5'}`} />
            </button>
          </div>
        </div>

        {/* Coupon filter — internal only, only shown when discounts exist */}
        {!customerView && data && hasDiscounts && (
          <div className="flex items-center gap-2">
            <Tag size={12} className="text-[#8a7660]" />
            <span className="text-xs text-[#6b5f54]">Show:</span>
            {(['all', 'full', 'discounted'] as CouponFilter[]).map(f => (
              <button key={f} onClick={() => setCouponFilter(f)}
                className={`px-3 py-1 text-xs rounded-lg transition ${
                  couponFilter === f ? 'bg-[#1c1412] text-white' : 'bg-[#f0e8d8] text-[#6b5f54] hover:bg-[#e8dcc8]'
                }`}>
                {f === 'all' ? 'All Sales' : f === 'full' ? 'Full Price' : 'Discounted'}
              </button>
            ))}
            {couponFilter === 'discounted' && data.totalUnitsDiscounted > 0 && (
              <span className="text-xs text-[#8a7660]">
                {data.totalUnitsDiscounted} unit{data.totalUnitsDiscounted !== 1 ? 's' : ''} · {fmt(data.totalRevenueDiscounted)}
              </span>
            )}
          </div>
        )}

        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
              className="text-xs border border-[#e8e0d8] px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-[#1c1412]/30" />
            <span className="text-xs text-[#8a7660]">to</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
              className="text-xs border border-[#e8e0d8] px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-[#1c1412]/30" />
            <button onClick={handleCustomLoad} disabled={!customStart || !customEnd}
              className="px-3 py-1.5 bg-[#1c1412] text-white text-xs rounded-lg disabled:opacity-40 transition">
              Load
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {loading && (
          <div className="flex items-center justify-center h-32 gap-2 text-sm text-[#8a7660]">
            <Loader2 size={16} className="animate-spin" /> Loading report…
          </div>
        )}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</div>
        )}

        {!loading && data && (
          <>
            {/* Summary cards */}
            <div className={`grid gap-4 ${customerView ? 'grid-cols-2' : 'grid-cols-3'}`}>
              <div className="bg-white rounded-xl border border-[#e8dcc8] px-4 py-3">
                <div className="eyebrow mb-1">Units Sold</div>
                <div className="text-2xl font-semibold tracking-tight">{(displayUnits ?? 0).toLocaleString()}</div>
                {!customerView && hasDiscounts && couponFilter === 'all' && (
                  <div className="text-[10px] text-[#8a7660] mt-0.5">
                    {data.totalUnitsFull} full · {data.totalUnitsDiscounted} discounted
                  </div>
                )}
              </div>
              {!customerView && (
                <div className="bg-white rounded-xl border border-[#e8dcc8] px-4 py-3">
                  <div className="eyebrow mb-1">Revenue</div>
                  <div className="text-2xl font-semibold tracking-tight">{fmt(displayRevenue ?? 0)}</div>
                  {hasDiscounts && couponFilter === 'all' && (
                    <div className="text-[10px] text-[#8a7660] mt-0.5">
                      {fmt(data.totalRevenueFull)} full · {fmt(data.totalRevenueDiscounted)} discounted
                    </div>
                  )}
                </div>
              )}
              <div className="bg-white rounded-xl border border-[#e8dcc8] px-4 py-3">
                <div className="eyebrow mb-1">Products with Sales</div>
                <div className="text-2xl font-semibold tracking-tight">
                  {soldCount}
                  <span className="text-sm font-normal text-[#8a7660] ml-1">of {data.products.length}</span>
                </div>
              </div>
            </div>

            {/* Stale alert */}
            {!customerView && staleCount > 0 && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <AlertTriangle size={15} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800">
                  <span className="font-semibold">{staleCount} product{staleCount !== 1 ? 's' : ''} haven't sold in 60+ days.</span>
                  {' '}Suggested price reductions (−15%) are shown below.
                </p>
              </div>
            )}

            {/* Product table */}
            <div className="bg-white rounded-xl border border-[#e8dcc8] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e8dcc8] bg-[#faf7f2] text-left">
                    <th className="px-4 py-2.5 text-[10px] uppercase tracking-widest text-[#8a7660] font-medium" colSpan={2}>Product</th>
                    <th className="px-4 py-2.5 text-[10px] uppercase tracking-widest text-[#8a7660] font-medium text-right">Units</th>
                    {!customerView && (
                      <th className="px-4 py-2.5 text-[10px] uppercase tracking-widest text-[#8a7660] font-medium text-right">Revenue</th>
                    )}
                    {!customerView && (
                      <th className="px-4 py-2.5 text-[10px] uppercase tracking-widest text-[#8a7660] font-medium text-right">List Price</th>
                    )}
                    <th className="px-4 py-2.5 text-[10px] uppercase tracking-widest text-[#8a7660] font-medium text-right">Last Sold</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0e8d8]">
                  {filteredProducts.map(p => {
                    const units = couponFilter === 'full' ? p.unitsFull : couponFilter === 'discounted' ? p.unitsDiscounted : p.unitsSold
                    const revenue = couponFilter === 'full' ? p.revenueFull : couponFilter === 'discounted' ? p.revenueDiscounted : p.revenue
                    return (
                      <tr key={p.productId}
                        className={p.stale && !customerView ? 'bg-amber-50/40' : 'hover:bg-[#faf7f2] transition-colors'}>
                        <td className="px-4 py-3 w-14 shrink-0">
                          {p.image
                            ? <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover" />
                            : <div className="w-10 h-10 rounded-lg bg-[#f0e8d8]" />
                          }
                        </td>
                        <td className="py-3 pr-4 min-w-0">
                          <div className="font-medium text-[13px] leading-snug">{p.title}</div>
                          {/* Coupon codes badge */}
                          {!customerView && p.couponCodes.length > 0 && couponFilter !== 'full' && (
                            <div className="flex items-center gap-1 flex-wrap mt-0.5">
                              {p.couponCodes.map(code => (
                                <span key={code} className="inline-flex items-center gap-0.5 text-[9px] bg-blue-50 text-blue-700 border border-blue-100 rounded px-1.5 py-0.5 font-mono">
                                  <Tag size={8} /> {code}
                                </span>
                              ))}
                            </div>
                          )}
                          {/* Stale suggestion */}
                          {!customerView && p.stale && p.suggestedPrice && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <TrendingDown size={10} className="text-amber-600 shrink-0" />
                              <span className="text-[10px] text-amber-700">
                                No sales in 60 days — suggest {fmt(parseFloat(p.suggestedPrice))}
                              </span>
                              {appliedIds.has(p.productId) ? (
                                <span className="text-[10px] text-green-600 font-medium">Applied ✓</span>
                              ) : (
                                <button
                                  onClick={() => handleApplyPrice(p.productId, p.suggestedPrice!)}
                                  disabled={applyingId === p.productId}
                                  className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded transition disabled:opacity-50"
                                >
                                  {applyingId === p.productId && <Loader2 size={8} className="animate-spin" />}
                                  Apply
                                </button>
                              )}
                            </div>
                          )}
                          {p.status === 'draft' && (
                            <span className="inline-block mt-0.5 text-[9px] bg-yellow-100 text-yellow-800 rounded px-1.5 py-0.5">Draft</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {units > 0 ? (
                            <div>
                              <span className="font-semibold">{units}</span>
                              {!customerView && couponFilter === 'all' && p.unitsDiscounted > 0 && (
                                <div className="text-[10px] text-blue-600">{p.unitsDiscounted} w/ coupon</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[#c4b49e]">—</span>
                          )}
                        </td>
                        {!customerView && (
                          <td className="px-4 py-3 text-right tabular-nums text-[#6b5f54]">
                            {revenue > 0 ? (
                              <div>
                                {fmt(revenue)}
                                {couponFilter === 'all' && p.revenueDiscounted > 0 && (
                                  <div className="text-[10px] text-blue-600">{fmt(p.revenueDiscounted)} discounted</div>
                                )}
                              </div>
                            ) : <span className="text-[#c4b49e]">—</span>}
                          </td>
                        )}
                        {!customerView && (
                          <td className="px-4 py-3 text-right tabular-nums text-xs text-[#8a7660]">
                            {p.price ? fmt(parseFloat(p.price)) : '—'}
                          </td>
                        )}
                        <td className="px-4 py-3 text-right text-xs text-[#8a7660] whitespace-nowrap">
                          {p.lastSoldAt ? fmtDate(p.lastSoldAt) : <span className="text-[#c4b49e]">Never</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
