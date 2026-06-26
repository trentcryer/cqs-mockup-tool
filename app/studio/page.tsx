// @ts-nocheck
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, TrendingUp, Package, AlertTriangle, ExternalLink, ShoppingBag, DollarSign } from 'lucide-react'
import { MyDesignsClient } from '@/components/studio/MyDesignsClient'
import { revalidatePath, unstable_cache } from 'next/cache'
import { sendReviewRequestEmail } from '@/lib/resend'
import { getProductsInCollection, getOrderLineItemsInDateRange } from '@/lib/shopify'
import { groupLabel as getGroupLabel } from '@/lib/group-type'

// Cache Shopify dashboard data per collection for 5 minutes.
// Filters store-wide orders down to only this collection's products.
const getCollectionDashboard = unstable_cache(
  async (collectionId: number) => {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
    const [products, allOrders] = await Promise.all([
      getProductsInCollection(collectionId, 'custom'),
      getOrderLineItemsInDateRange(sixtyDaysAgo, new Date().toISOString()).catch(() => []),
    ])
    const productIds = new Set(products.map((p: any) => p.id))
    const orders = allOrders.filter((o: any) => productIds.has(o.productId))
    return { products, orders }
  },
  ['studio-collection-dashboard'],
  { revalidate: 300 }
)

export default async function MyStudioPage({ searchParams }) {
  const sp = await searchParams
  const activeTab = sp?.view === 'logos' ? 'logos' : 'designs'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch profile, logos, designs in parallel
  const [profileResult, logosResult, designsResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('logos').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('designs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
  ])

  const profile = profileResult.data
  const logosRaw = logosResult.data || []
  const designs = designsResult.data || []

  // Batch-sign logo URLs in one API call
  const logoPaths = logosRaw.map((l: any) => l.storage_path)
  const signedMap: Record<string, string> = {}
  if (logoPaths.length > 0) {
    const { data: signedData } = await supabase.storage
      .from('cqs-assets')
      .createSignedUrls(logoPaths, 3600)
    for (const s of (signedData ?? [])) {
      if (s.path && s.signedUrl) signedMap[s.path] = s.signedUrl
    }
  }
  const logos = logosRaw.map((logo: any) => ({
    ...logo,
    displayUrl: signedMap[logo.storage_path] ?? null,
  }))

  const groupType: string = profile?.group_type || 'quartet'
  const groupLabel = getGroupLabel(groupType)
  const groupName = profile?.quartet_name || `My ${groupLabel}`

  // Shopify dashboard — graceful fallback if unconfigured or collection not assigned
  let collectionProducts: any[] = []
  let collectionOrders: any[] = []
  let dashboardAvailable = false
  const collectionId = profile?.shopify_collection_id

  if (collectionId) {
    try {
      const data = await getCollectionDashboard(collectionId)
      collectionProducts = data.products
      collectionOrders = data.orders
      dashboardAvailable = true
    } catch (e) {
      console.error('[Studio dashboard]', e)
    }
  }

  // Derive metrics
  const activeCount  = collectionProducts.filter((p: any) => p.status === 'active').length
  const totalUnits   = collectionOrders.reduce((s: number, o: any) => s + o.quantity, 0)
  const totalRevenue = collectionOrders.reduce((s: number, o: any) => s + o.price * o.quantity, 0)

  const salesByProduct = new Map<number, { units: number; revenue: number; title: string }>()
  for (const o of collectionOrders) {
    const c = salesByProduct.get(o.productId) || { units: 0, revenue: 0, title: o.title }
    salesByProduct.set(o.productId, { units: c.units + o.quantity, revenue: c.revenue + o.price * o.quantity, title: o.title })
  }
  const bestSellers = Array.from(salesByProduct.entries())
    .map(([productId, s]) => ({ productId, ...s, product: collectionProducts.find((p: any) => p.id === productId) }))
    .sort((a, b) => b.units - a.units)
    .slice(0, 5)

  const soldIds      = new Set(collectionOrders.map((o: any) => o.productId))
  const staleProducts = collectionProducts.filter((p: any) => !soldIds.has(p.id) && p.status === 'active')
  const shopifyDomain = process.env.SHOPIFY_STORE_DOMAIN
  const trentEmail = process.env.TRENT_EMAIL || ''
  const isAdmin = user.email === trentEmail || !!(profile as any)?.is_admin

  // ── Server actions ────────────────────────────────────────────────────────

  async function updateGroupName(formData: FormData) {
    'use server'
    const name = formData.get('quartet_name') as string
    const sb = await createClient()
    const { data: { user: u } } = await sb.auth.getUser()
    if (!u) return
    await (sb.from('profiles') as any).update({ quartet_name: name.trim() || `My ${groupLabel}`, updated_at: new Date().toISOString() }).eq('id', u.id)
    revalidatePath('/studio')
  }

  async function deleteLogo(formData: FormData) {
    'use server'
    const logoId = formData.get('logoId') as string
    const storagePath = formData.get('storagePath') as string
    if (!logoId) return
    const sb = await createClient()
    const { data: { user: u } } = await sb.auth.getUser()
    if (!u) return
    await sb.from('logos').delete().eq('id', logoId).eq('user_id', u.id)
    if (storagePath) await sb.storage.from('cqs-assets').remove([storagePath])
    revalidatePath('/studio')
  }

  async function requestReview(designId: string) {
    'use server'
    const sb = await createClient()
    const admin = createAdminClient()
    const { data: design } = await sb.from('designs').select('*').eq('id', designId).single()
    if (!design) return
    const { data: prof } = await (sb.from('profiles') as any).select('email, quartet_name').eq('id', (design as any).user_id).single()
    const trentEmail = process.env.TRENT_EMAIL || 'trent@example.com'
    await (admin.from('designs') as any).update({ status: 'review_requested' }).eq('id', designId)
    try {
      await sendReviewRequestEmail({
        to: trentEmail,
        quartetName: prof?.quartet_name || (design as any).quartet_name || 'A group',
        userEmail: prof?.email || user?.email || 'unknown',
        designId,
        productTitle: (design as any).product_title,
        placement: (design as any).placement,
        color: (design as any).color,
        notes: (design as any).notes,
        mockupUrls: ((design as any).mockup_urls as any[])?.map((m: any) => m.mockup_url) || [],
      })
    } catch (e) {
      console.error('Email send failed', e)
    }
    revalidatePath('/studio')
    revalidatePath('/admin')
  }

  async function deleteDesign(designId: string) {
    'use server'
    const sb = await createClient()
    await sb.from('designs').delete().eq('id', designId)
    revalidatePath('/studio')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div data-tour="studio-page">

      {/* Header */}
      <div data-tour="studio-header" className="flex items-end justify-between mb-8">
        <div>
          <div className="eyebrow mb-2">Private Workspace</div>
          <h1 className="text-4xl font-bold tracking-tight text-[#1c1412] leading-none">{groupName}</h1>
          <div className="text-[13px] text-[#9b8c7a] mt-2">{groupLabel} studio</div>
        </div>
        <Link data-tour="browse-catalog-btn" href="/studio/catalog" className="btn-primary px-5 py-3 flex items-center gap-2 text-sm">
          <Plus size={16} /> New Design
        </Link>
      </div>

      {/* Group name editor — collapsible */}
      <details className="mb-8 border-b border-[#e8e0d8] pb-6">
        <summary className="flex items-center gap-4 cursor-pointer list-none select-none">
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-[2px] text-[#9b8c7a] font-bold">{groupLabel} Name</div>
            <div className="text-sm font-medium text-[#1c1412] mt-0.5">{groupName}</div>
          </div>
          <span className="text-xs text-[#9b8c7a] hover:text-[#1c1412] transition shrink-0">✎ Rename</span>
        </summary>
        <form action={updateGroupName} className="mt-4 flex gap-3 pt-4 border-t border-[#e8e0d8]">
          <input
            name="quartet_name"
            defaultValue={groupName}
            className="flex-1 border border-[#e8e0d8] px-4 py-2.5 text-sm focus:border-[#1c1412] outline-none bg-white"
            placeholder={`Your ${groupLabel.toLowerCase()} name`}
          />
          <button type="submit" className="btn-secondary px-6 py-2.5">Save</button>
        </form>
      </details>

      {/* ── HOMEBASE DASHBOARD ─────────────────────────────────────────────── */}
      <section data-tour="studio-dashboard" className="mb-12">
        <div className="flex items-center justify-between mb-5">
          <div className="eyebrow">
            {profile?.shopify_collection_title
              ? `${profile.shopify_collection_title} · Dashboard`
              : 'Storefront · Dashboard'}
          </div>
          {isAdmin && collectionId && shopifyDomain && (
            <a
              href={`https://${shopifyDomain}/admin/collections/${collectionId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-[#9b8c7a] hover:text-[#1c1412] flex items-center gap-1 transition"
            >
              Shopify <ExternalLink size={10} />
            </a>
          )}
        </div>

        {!collectionId ? (
          <div className="card p-10 text-center">
            <h3 className="font-semibold text-[#1c1412] mb-2">Your Storefront Dashboard</h3>
            <p className="text-sm text-[#9b8c7a] max-w-sm mx-auto leading-relaxed">
              Once your first design is approved and your collection goes live, you'll see live inventory, sales data, and trends right here.
            </p>
          </div>
        ) : !dashboardAvailable ? (
          <div className="card p-6 text-center text-sm text-[#9b8c7a]">
            Dashboard data temporarily unavailable — refresh to try again.
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
              {[
                { label: 'Products',    value: collectionProducts.length },
                { label: 'Active',      value: activeCount               },
                { label: 'Units · 60d', value: totalUnits                },
              ].map(({ label, value }) => (
                <div key={label} className="card p-5">
                  <div className="text-[28px] font-bold text-[#1c1412] leading-none mb-1">{value}</div>
                  <div className="text-[9px] uppercase tracking-[2px] text-[#9b8c7a] font-bold">{label}</div>
                </div>
              ))}
            </div>

            {/* Best sellers + Stale inventory */}
            <div className="grid md:grid-cols-2 gap-4 mb-6">

              {/* Best Sellers */}
              <div className="card p-6">
                <div className="eyebrow mb-5">Best Sellers · 60 Days</div>
                {bestSellers.length === 0 ? (
                  <p className="text-sm text-[#9b8c7a]">No sales data yet for this collection.</p>
                ) : (
                  <div className="divide-y divide-[#f0ece6]">
                    {bestSellers.map((item, i) => (
                      <div key={item.productId} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                        <span className="text-[10px] font-bold text-[#c4b49f] w-4 shrink-0">{i + 1}</span>
                        {item.product?.image && (
                          <img src={item.product.image} alt="" className="w-10 h-10 object-contain bg-[#f7f5f2] shrink-0" style={{ borderRadius: 4 }} />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium text-[#1c1412] truncate">{item.title}</div>
                          <div className="text-[11px] text-[#9b8c7a]">{item.units} units · ${item.revenue.toFixed(0)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Stale Inventory */}
              <div className="card p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="eyebrow">No Sales in 60 Days</div>
                  {staleProducts.length > 0 && (
                    <span className="ml-auto text-[9px] bg-[#f0ece6] text-[#9b8c7a] px-2 py-0.5 font-bold tracking-widest uppercase">
                      {staleProducts.length}
                    </span>
                  )}
                </div>
                {staleProducts.length === 0 ? (
                  <p className="text-sm text-[#9b8c7a]">
                    {collectionProducts.length === 0
                      ? 'No products in your collection yet.'
                      : 'Everything is moving — no stale inventory.'}
                  </p>
                ) : (
                  <div className="divide-y divide-[#f0ece6]">
                    {staleProducts.slice(0, 5).map((p: any) => (
                      <div key={p.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                        {p.image
                          ? <img src={p.image} alt="" className="w-10 h-10 object-contain bg-[#f7f5f2] shrink-0" style={{ borderRadius: 4 }} />
                          : <div className="w-10 h-10 bg-[#f7f5f2] flex items-center justify-center shrink-0" style={{ borderRadius: 4 }}><Package size={14} className="text-[#c4b49f]" /></div>
                        }
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium text-[#1c1412] truncate">{p.title}</div>
                          <div className="text-[11px] text-[#9b8c7a]">${p.price}</div>
                        </div>
                      </div>
                    ))}
                    {staleProducts.length > 5 && (
                      <p className="text-[10px] text-[#9b8c7a] pt-3">+{staleProducts.length - 5} more</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Inventory grid */}
            {collectionProducts.length > 0 && (
              <div data-tour="studio-merch">
                <div className="eyebrow mb-4">Your Merch · {collectionProducts.length}</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {collectionProducts.map((p: any) => (
                    <div key={p.id} className="card relative overflow-hidden select-none">
                      <div className="absolute top-2 right-2 z-10">
                        <span className={`flex items-center gap-1 text-[8px] px-1.5 py-0.5 font-bold tracking-widest uppercase ${
                          p.status === 'active' ? 'bg-[#d1fae5] text-[#065f46]' : 'bg-[#f0ece6] text-[#9b8c7a]'
                        }`} style={{ borderRadius: 2 }}>
                          {p.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] shrink-0" />}
                          {p.status === 'active' ? 'Live' : 'Draft'}
                        </span>
                      </div>
                      <div className="relative" style={{ aspectRatio: '4/5', background: '#f0ece6' }}>
                        {p.image
                          ? <img src={p.image} alt={p.title} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><Package size={16} className="text-[#c4b49f]" /></div>
                        }
                      </div>
                      <div className="p-2.5 bg-white">
                        <div className="text-[11px] font-medium line-clamp-2 leading-tight text-[#1c1412]">{p.title}</div>
                        {p.price && <div className="text-[10px] text-[#9b8c7a] mt-0.5">${p.price}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── MY WORK: DESIGNS + LOGO LIBRARY TABS ──────────────────────────── */}
      <section>

        {/* Tab bar */}
        <div data-tour="studio-designs" className="flex items-center gap-8 border-b border-[#e8e0d8] mb-7">
          <Link
            href="/studio"
            className={`tab-underline pb-3 ${activeTab === 'designs' ? 'active' : ''}`}
          >
            My Designs ({designs.length})
          </Link>
          <Link
            href="/studio?view=logos"
            className={`tab-underline pb-3 ${activeTab === 'logos' ? 'active' : ''}`}
          >
            Logo Library ({logos.length})
          </Link>
        </div>

        {/* ── DESIGNS TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'designs' && (
          <MyDesignsClient designs={designs} showTourTarget />
        )}

        {/* ── LOGO LIBRARY TAB ─────────────────────────────────────────────── */}
        {activeTab === 'logos' && (
          <div data-tour="studio-logos">
            {logos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                {logos.map((logo: any) => (
                  <div key={logo.id} className="card p-3 group relative flex flex-col">
                    <form action={deleteLogo} className="absolute top-2 right-2 z-10">
                      <input type="hidden" name="logoId" value={logo.id} />
                      <input type="hidden" name="storagePath" value={logo.storage_path} />
                      <button
                        type="submit"
                        title="Delete logo"
                        className="w-5 h-5 bg-[#9b1c1c] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-xs"
                        style={{ borderRadius: 2 }}
                      >
                        ×
                      </button>
                    </form>
                    <div className="aspect-square bg-[#f0ece6] flex items-center justify-center overflow-hidden mb-2" style={{ borderRadius: 4 }}>
                      {logo.displayUrl
                        ? <img src={logo.displayUrl} alt={logo.filename} className="max-h-[110px] object-contain p-2" />
                        : <div className="text-[10px] text-[#9b8c7a]">Unavailable</div>
                      }
                    </div>
                    <div className="text-[10px] truncate text-[#9b8c7a] mb-2">{logo.filename}</div>
                    <Link
                      href="/studio/catalog"
                      className="mt-auto text-[10px] text-center text-[#9b8c7a] hover:text-[#1c1412] transition py-1.5 border border-[#e8e0d8] hover:border-[#1c1412]"
                      style={{ borderRadius: 3 }}
                    >
                      Use →
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card p-16 text-center">
                <p className="text-sm text-[#9b8c7a]">
                  Upload a logo when creating your first design — it's saved here automatically.
                </p>
              </div>
            )}
          </div>
        )}

      </section>
    </div>
  )
}
