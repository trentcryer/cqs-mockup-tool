'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Responsive, WidthProvider } from 'react-grid-layout/legacy'
import type { LayoutItem } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp, DollarSign, ShoppingBag, Users,
  LayoutGrid, RefreshCw, ArrowLeft, Package, FileText,
  Star, BarChart2, Store, GripVertical, RotateCcw,
} from 'lucide-react'
import { format } from 'date-fns'

const RGL = WidthProvider(Responsive)

// ── Types ──────────────────────────────────────────────────────────────────────
interface Kpis {
  todayRevenue: number; weekRevenue: number; mtdRevenue: number
  last30Revenue: number; totalRevenue: number; mtdOrders: number
  allOrders: number; avgOrderValue: number; activeGroups: number
  last30Signups: number; totalDesigns: number; last30Designs: number
}
interface DailySale   { date: string; revenue: number; orders: number }
interface WeeklyRev   { week: string; revenue: number }
interface TopProduct  { title: string; revenue: number; units: number }
interface RecentDesign { id: string; createdAt: string; notes: string | null }
interface HomebaseData {
  kpis: Kpis; dailySales: DailySale[]; weeklyRevenue: WeeklyRev[]
  topProducts: TopProduct[]; recentDesigns: RecentDesign[]; totalProfiles: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function usd(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

const CHART_COLORS = ['#F59E0B','#DC2626','#3B82F6','#10B981','#8B5CF6','#F97316','#EC4899','#06B6D4']

const tooltipStyle = {
  backgroundColor: '#1A1A1A',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8, color: '#fff', fontSize: 13,
}

// ── Layout ─────────────────────────────────────────────────────────────────────
const LAYOUT_KEY = 'homebase-layout-v1'

const DEFAULT_LAYOUT: LayoutItem[] = [
  { i: 'kpi-today',    x: 0,  y: 0,  w: 2, h: 3, minW: 2, minH: 3 },
  { i: 'kpi-week',     x: 2,  y: 0,  w: 2, h: 3, minW: 2, minH: 3 },
  { i: 'kpi-mtd',      x: 4,  y: 0,  w: 2, h: 3, minW: 2, minH: 3 },
  { i: 'kpi-groups',   x: 6,  y: 0,  w: 2, h: 3, minW: 2, minH: 3 },
  { i: 'kpi-aov',      x: 8,  y: 0,  w: 2, h: 3, minW: 2, minH: 3 },
  { i: 'kpi-designs',  x: 10, y: 0,  w: 2, h: 3, minW: 2, minH: 3 },
  { i: 'chart-rev',    x: 0,  y: 3,  w: 4, h: 7, minW: 3, minH: 5 },
  { i: 'chart-orders', x: 4,  y: 3,  w: 4, h: 7, minW: 3, minH: 5 },
  { i: 'chart-weekly', x: 8,  y: 3,  w: 4, h: 7, minW: 3, minH: 5 },
  { i: 'top-products', x: 0,  y: 10, w: 6, h: 15, minW: 3, minH: 6 },
  { i: 'rev-summary',  x: 6,  y: 10, w: 6, h: 5,  minW: 3, minH: 4 },
  { i: 'recent',       x: 6,  y: 15, w: 6, h: 7,  minW: 3, minH: 4 },
  { i: 'quick-actions',x: 0,  y: 25, w: 12, h: 4, minW: 6, minH: 3 },
]

function loadLayout(): LayoutItem[] {
  if (typeof window === 'undefined') return DEFAULT_LAYOUT
  try {
    const saved = localStorage.getItem(LAYOUT_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  return DEFAULT_LAYOUT
}

// ── GridWidget ─────────────────────────────────────────────────────────────────
function GridWidget({
  title, children, action, noPad = false,
}: {
  title: string; children: React.ReactNode; action?: React.ReactNode; noPad?: boolean
}) {
  return (
    <div className="h-full bg-[#111111] border border-white/5 rounded-2xl flex flex-col overflow-hidden group/widget">
      <div className="drag-handle flex items-center justify-between px-5 py-3 border-b border-white/5 cursor-grab active:cursor-grabbing shrink-0 select-none">
        <div className="flex items-center gap-2">
          <GripVertical size={13} className="text-gray-700 group-hover/widget:text-gray-500 transition-colors" />
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">{title}</span>
        </div>
        {action && <div className="text-xs text-gray-600">{action}</div>}
      </div>
      <div className={`flex-1 min-h-0 overflow-auto ${noPad ? '' : 'px-5 pb-5 pt-4'}`}>
        {children}
      </div>
    </div>
  )
}

// ── KPI Widget ─────────────────────────────────────────────────────────────────
function KpiWidget({
  label, value, sub, updatedAt, icon: Icon, accent = false, loading,
}: {
  label: string; value: string; sub?: string; updatedAt?: Date | null
  icon: any; accent?: boolean; loading: boolean
}) {
  return (
    <div className={`h-full flex flex-col overflow-hidden rounded-2xl border ${
      accent
        ? 'bg-gradient-to-br from-[#1c1200] to-[#2a1800] border-yellow-500/20'
        : 'bg-[#111111] border-white/5'
    } group/widget`}>
      {/* drag handle strip */}
      <div className="drag-handle flex items-center justify-between px-4 pt-3 pb-1 cursor-grab active:cursor-grabbing select-none shrink-0">
        <GripVertical size={12} className="text-gray-700 group-hover/widget:text-gray-500 transition-colors" />
        <div className={`p-1.5 rounded-lg ${accent ? 'bg-yellow-500/10' : 'bg-white/5'}`}>
          <Icon size={13} className={accent ? 'text-yellow-400' : 'text-gray-400'} />
        </div>
      </div>
      <div className="px-4 pb-4 flex flex-col gap-1.5 flex-1">
        <span className="text-[10px] text-gray-500 uppercase tracking-widest">{label}</span>
        {loading
          ? <div className="h-7 w-20 bg-white/5 rounded animate-pulse" />
          : <div className={`text-2xl font-bold tracking-tight leading-none ${accent ? 'text-yellow-400' : 'text-white'}`}>{value}</div>
        }
        {sub && !loading && <div className="text-[10px] text-gray-500">{sub}</div>}
        {updatedAt && !loading && (
          <div className="text-[9px] text-gray-700 mt-auto">
            Updated {format(updatedAt, 'h:mm:ss a')}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function HomebaseClient() {
  const [data, setData]             = useState<HomebaseData | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [layout, setLayout]         = useState<LayoutItem[]>(loadLayout)

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/admin/homebase')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
      setLastRefresh(new Date())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => {
    const id = setInterval(fetchData, 60_000)
    return () => clearInterval(id)
  }, [fetchData])

  function onLayoutChange(current: readonly LayoutItem[], _all: unknown) {
    const mutable = [...current]
    setLayout(mutable)
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(mutable)) } catch {}
  }

  function resetLayout() {
    setLayout(DEFAULT_LAYOUT)
    try { localStorage.removeItem(LAYOUT_KEY) } catch {}
  }

  const kpis = data?.kpis

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">

      {/* ── Top bar ── */}
      <div className="border-b border-white/5 bg-[#0A0A0A]/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-500 hover:text-white transition flex items-center gap-1.5 text-sm">
              <ArrowLeft size={15} /> Admin
            </Link>
            <div className="w-px h-4 bg-white/10" />
            <div className="flex items-center gap-2">
              <BarChart2 size={16} className="text-yellow-500" />
              <span className="font-semibold tracking-tight">Homebase</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-xs text-gray-600 hidden sm:block">
                Updated {format(lastRefresh, 'h:mm a')}
              </span>
            )}
            <button
              onClick={resetLayout}
              className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-300 transition border border-white/8 rounded-lg px-3 py-1.5 hover:border-white/15"
            >
              <RotateCcw size={12} /> Reset Layout
            </button>
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition border border-white/10 rounded-lg px-3 py-1.5 hover:border-white/20"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-6">

        {/* ── Header ── */}
        <div className="mb-6">
          <div className="text-xs text-yellow-500 uppercase tracking-[3px] mb-1">CQS Internal</div>
          <h1 className="text-3xl font-bold tracking-tight">Operations Homebase</h1>
          <p className="text-gray-500 text-sm mt-1">Drag widgets to rearrange. Resize from the bottom-right corner.</p>
        </div>

        {error && (
          <div className="bg-red-950/40 border border-red-800/40 rounded-xl px-5 py-3 text-sm text-red-400 mb-6">
            Failed to load data: {error}
          </div>
        )}

        {/* ── Grid ── */}
        <RGL
          layouts={{ lg: layout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4 }}
          rowHeight={50}
          margin={[12, 12]}
          containerPadding={[0, 0]}
          draggableHandle=".drag-handle"
          onLayoutChange={onLayoutChange}
          isDraggable
          isResizable
          resizeHandles={['se', 's', 'e']}
        >
          {/* ── KPI Cards ── */}
          <div key="kpi-today">
            <KpiWidget label="Today's Revenue" value={usd(kpis?.todayRevenue ?? 0)} sub="All paid orders today"
              icon={DollarSign} accent updatedAt={lastRefresh} loading={loading} />
          </div>
          <div key="kpi-week">
            <KpiWidget label="This Week" value={usd(kpis?.weekRevenue ?? 0)} sub="Mon → now"
              icon={TrendingUp} loading={loading} />
          </div>
          <div key="kpi-mtd">
            <KpiWidget label="Month to Date" value={usd(kpis?.mtdRevenue ?? 0)} sub={`${kpis?.mtdOrders ?? 0} orders`}
              icon={ShoppingBag} loading={loading} />
          </div>
          <div key="kpi-groups">
            <KpiWidget label="Active Groups" value={String(kpis?.activeGroups ?? 0)} sub={`+${kpis?.last30Signups ?? 0} last 30d`}
              icon={Users} loading={loading} />
          </div>
          <div key="kpi-aov">
            <KpiWidget label="Avg Order Value" value={usd(kpis?.avgOrderValue ?? 0)} sub="MTD average"
              icon={Star} loading={loading} />
          </div>
          <div key="kpi-designs">
            <KpiWidget label="Designs Saved" value={String(kpis?.totalDesigns ?? 0)} sub={`+${kpis?.last30Designs ?? 0} last 30d`}
              icon={LayoutGrid} loading={loading} />
          </div>

          {/* ── Daily Revenue ── */}
          <div key="chart-rev">
            <GridWidget title="Daily Revenue — Last 30 Days" action={usd(kpis?.last30Revenue ?? 0)}>
              {loading
                ? <div className="h-full bg-white/[0.03] rounded-xl animate-pulse" />
                : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.dailySales ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} interval={4} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} formatter={(v: any) => [usd(v), 'Revenue']} />
                      <Bar dataKey="revenue" fill="#F59E0B" fillOpacity={0.85} maxBarSize={20} radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )
              }
            </GridWidget>
          </div>

          {/* ── Daily Orders ── */}
          <div key="chart-orders">
            <GridWidget title="Daily Orders — Last 30 Days" action={`${kpis?.mtdOrders ?? 0} MTD`}>
              {loading
                ? <div className="h-full bg-white/[0.03] rounded-xl animate-pulse" />
                : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.dailySales ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} interval={4} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} formatter={(v: any) => [v, 'Orders']} />
                      <Bar dataKey="orders" fill="#DC2626" fillOpacity={0.8} maxBarSize={20} radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )
              }
            </GridWidget>
          </div>

          {/* ── Weekly Revenue ── */}
          <div key="chart-weekly">
            <GridWidget title="Weekly Revenue — Last 12 Weeks" action="trend">
              {loading
                ? <div className="h-full bg-white/[0.03] rounded-xl animate-pulse" />
                : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data?.weeklyRevenue ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="week" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} interval={2} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [usd(v), 'Revenue']} />
                      <Line type="monotone" dataKey="revenue" stroke="#F59E0B" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#F59E0B' }} />
                    </LineChart>
                  </ResponsiveContainer>
                )
              }
            </GridWidget>
          </div>

          {/* ── Top Products ── */}
          <div key="top-products">
            <GridWidget title="Top Products by Revenue — All Time">
              {loading
                ? <div className="space-y-3">{Array.from({length:10}).map((_,i)=>
                    <div key={i} className="h-8 bg-white/[0.04] rounded animate-pulse"/>)}</div>
                : (
                  <div className="space-y-3">
                    {(data?.topProducts ?? []).map((p, i) => {
                      const maxRev = data!.topProducts[0]?.revenue || 1
                      const pct = Math.round((p.revenue / maxRev) * 100)
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-gray-300 truncate max-w-[55%]" title={p.title}>
                              <span className="text-gray-600 mr-2 text-xs">#{i+1}</span>{p.title}
                            </span>
                            <div className="flex items-center gap-3 text-gray-500 shrink-0">
                              <span className="text-xs">{p.units} units</span>
                              <span className="text-yellow-400 font-mono font-semibold text-sm">{usd(p.revenue)}</span>
                            </div>
                          </div>
                          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                          </div>
                        </div>
                      )
                    })}
                    {!data?.topProducts?.length && <p className="text-sm text-gray-600 py-4 text-center">No sales data yet.</p>}
                  </div>
                )
              }
            </GridWidget>
          </div>

          {/* ── Revenue Summary ── */}
          <div key="rev-summary">
            <GridWidget title="Revenue Summary">
              <div className="grid grid-cols-2 gap-3 h-full">
                {[
                  { label: 'All-Time Revenue', value: usd(kpis?.totalRevenue ?? 0),        color: 'text-yellow-400' },
                  { label: 'All-Time Orders',  value: (kpis?.allOrders ?? 0).toLocaleString(), color: 'text-white' },
                  { label: 'Last 30 Days',     value: usd(kpis?.last30Revenue ?? 0),        color: 'text-green-400' },
                  { label: 'Avg Order Value',  value: usd(kpis?.avgOrderValue ?? 0),         color: 'text-white' },
                ].map(item => (
                  <div key={item.label} className="bg-white/[0.03] rounded-xl p-4 flex flex-col justify-between">
                    <div className="text-xs text-gray-600 mb-2">{item.label}</div>
                    {loading
                      ? <div className="h-6 w-20 bg-white/5 rounded animate-pulse" />
                      : <div className={`text-xl font-bold ${item.color}`}>{item.value}</div>
                    }
                  </div>
                ))}
              </div>
            </GridWidget>
          </div>

          {/* ── Recent Designs ── */}
          <div key="recent">
            <GridWidget title="Recent Designs">
              {loading
                ? <div className="space-y-2">{Array.from({length:5}).map((_,i)=>
                    <div key={i} className="h-10 bg-white/[0.04] rounded animate-pulse"/>)}</div>
                : (
                  <div className="space-y-1">
                    {(data?.recentDesigns ?? []).map(d => (
                      <div key={d.id} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
                        <div className="flex items-center gap-2.5">
                          <FileText size={13} className="text-gray-600 shrink-0" />
                          <span className="text-sm text-gray-400 truncate max-w-[200px]">{d.notes || 'Design submitted'}</span>
                        </div>
                        <span className="text-xs text-gray-600 shrink-0">{format(new Date(d.createdAt), 'MMM d, h:mm a')}</span>
                      </div>
                    ))}
                    {!data?.recentDesigns?.length && <p className="text-sm text-gray-600 py-2 text-center">No recent designs.</p>}
                  </div>
                )
              }
            </GridWidget>
          </div>

          {/* ── Quick Actions ── */}
          <div key="quick-actions">
            <GridWidget title="Quick Actions">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Review Queue',    href: '/admin',             icon: Package,    color: 'text-yellow-400' },
                  { label: 'Group Accounts',  href: '/admin/groups',      icon: Users,      color: 'text-blue-400' },
                  { label: 'Collection Mgr',  href: '/admin/collections', icon: Store,      color: 'text-green-400' },
                  { label: 'Product Catalog', href: '/studio/catalog',    icon: LayoutGrid, color: 'text-purple-400' },
                ].map(action => (
                  <Link
                    key={action.label}
                    href={action.href}
                    className="flex items-center gap-3 p-4 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 rounded-xl transition group"
                  >
                    <action.icon size={17} className={`${action.color} group-hover:scale-110 transition-transform`} />
                    <span className="text-sm text-gray-300 group-hover:text-white transition">{action.label}</span>
                  </Link>
                ))}
              </div>
            </GridWidget>
          </div>
        </RGL>

        <div className="flex items-center justify-between text-xs text-gray-700 py-6">
          <span>CQS Mockup Studio · Admin Internal</span>
          <span>Data from Shopify + Supabase</span>
        </div>
      </div>
    </div>
  )
}
