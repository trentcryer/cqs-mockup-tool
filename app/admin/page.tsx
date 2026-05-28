// @ts-nocheck
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { createProduct } from '@/lib/shopify'
import { revalidatePath } from 'next/cache'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const trentEmail = process.env.TRENT_EMAIL?.toLowerCase()
  if (!trentEmail || user.email?.toLowerCase() !== trentEmail) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <h1 className="text-2xl font-semibold mb-3">Not authorized</h1>
        <p className="text-[#6b5f54]">This area is restricted to CQS administrators.</p>
      </div>
    )
  }

  const admin = createAdminClient()

  // Get all designs + profiles
  const { data: designs } = await admin
    .from('designs')
    .select('*, profiles:profiles!designs_user_id_fkey(email, quartet_name)')
    .order('created_at', { ascending: false })
    .limit(100)

  async function pushToShopify(designId: string) {
    'use server'
    const a = createAdminClient()
    const { data: dRaw } = await a.from('designs').select('*').eq('id', designId).single()
    const d = dRaw as any
    if (!d || !d.mockup_urls) return

    const mockups = d.mockup_urls as any[]
    const images = mockups.map((m, i) => ({ src: m.mockup_url, alt: `${d.product_title} ${i + 1}` }))

    try {
      const shopifyProduct = await createProduct({
        title: `${d.quartet_name || 'Custom'} — ${d.product_title} (${d.color || d.placement})`,
        body_html: d.notes ? `<p>${d.notes}</p>` : undefined,
        images,
        tags: `cqs,barbershop,${d.placement}`,
      })

      await a.from('designs').update({
        status: 'pushed_to_shopify',
        shopify_product_id: shopifyProduct.id,
        shopify_product_url: `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/products/${shopifyProduct.id}`,
      }).eq('id', designId)
    } catch (e) {
      console.error(e)
    }
    revalidatePath('/admin')
  }

  async function updateStatus(designId: string, status: string) {
    'use server'
    const a = createAdminClient()
    await a.from('designs').update({ status: status as any }).eq('id', designId)
    revalidatePath('/admin')
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-8">
        <div className="uppercase tracking-[2px] text-xs text-[#9b1c1c]">CQS Internal</div>
        <h1 className="text-4xl font-semibold tracking-tight">Admin — All Customer Folders</h1>
        <p className="text-[#6b5f54]">Trent’s review &amp; fulfillment dashboard</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-[#d4c5b0]">
          <thead className="bg-[#1c1412] text-[#f7f3ee]">
            <tr>
              <th className="text-left p-3 font-normal">Quartet</th>
              <th className="text-left p-3 font-normal">Product / Placement</th>
              <th className="text-left p-3 font-normal">Status</th>
              <th className="text-left p-3 font-normal">Notes</th>
              <th className="p-3 font-normal w-72">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y">
            {designs?.map((d: any) => (
              <tr key={d.id} className="align-top">
                <td className="p-3">
                  <div className="font-medium">{d.profiles?.quartet_name || d.quartet_name}</div>
                  <div className="text-xs text-[#6b5f54]">{d.profiles?.email}</div>
                </td>
                <td className="p-3">
                  <div>{d.product_title}</div>
                  <div className="text-xs text-[#b8892a]">{d.color} • {d.placement}</div>
                </td>
                <td className="p-3">
                  <span className={`badge badge-${d.status === 'review_requested' ? 'review' : d.status === 'approved' ? 'approved' : d.status === 'pushed_to_shopify' ? 'pushed' : 'draft'}`}>
                    {d.status}
                  </span>
                </td>
                <td className="p-3 text-xs max-w-xs text-[#6b5f54] line-clamp-3">{d.notes || '—'}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    {d.mockup_urls && (
                      <a href={(d.mockup_urls as any[])[0]?.mockup_url} target="_blank" className="text-xs underline">View mockups</a>
                    )}
                    <form action={async () => { 'use server'; await updateStatus(d.id, 'approved') }}>
                      <button className="text-xs px-3 py-1 border rounded">Approve</button>
                    </form>
                    <form action={async () => { 'use server'; await pushToShopify(d.id) }}>
                      <button className="text-xs px-3 py-1 bg-[#1c1412] text-white rounded">Push to Shopify</button>
                    </form>
                  </div>
                  {d.shopify_product_url && (
                    <a href={d.shopify_product_url} target="_blank" className="text-[10px] text-[#b8892a] block mt-1">View in Shopify →</a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 text-xs text-[#8a7660]">
        Using service role key. Designs are private to customers until they request review.
      </div>
    </div>
  )
}
