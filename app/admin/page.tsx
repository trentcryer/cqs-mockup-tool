// @ts-nocheck
import { redirect } from 'next/navigation'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import {
  listCollections,
  createCollection,
  createProduct,
  addProductToCollection,
} from '@/lib/shopify'
import {
  getPrintfulClient,
  getPrintAreaForPlacement,
  transformToPosition,
} from '@/lib/printful'
import CollectionAssigner from './CollectionAssigner'

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

  // --- Data fetching ---
  const { data: designs } = await admin
    .from('designs')
    .select('*, profiles:profiles!designs_user_id_fkey(id, email, quartet_name, shopify_collection_id, shopify_collection_title)')
    .order('created_at', { ascending: false })
    .limit(200)

  // Deduplicate profiles from the designs list (one row per quartet)
  const profileMap = new Map()
  for (const d of designs ?? []) {
    if (d.profiles && !profileMap.has(d.user_id)) {
      profileMap.set(d.user_id, { ...d.profiles, id: d.user_id })
    }
  }
  const quartets = Array.from(profileMap.values())

  // Shopify collections for the dropdown (graceful if not configured)
  let collections = []
  try {
    collections = await listCollections()
  } catch {
    // Shopify not configured yet — dropdown will be empty
  }

  // --- Server actions ---

  async function assignCollection(formData: FormData) {
    'use server'
    const userId = formData.get('userId') as string
    const collectionId = parseInt(formData.get('collectionId') as string)
    const collectionTitle = formData.get('collectionTitle') as string
    if (!userId || !collectionId) return
    const a = createAdminClient()
    await a.from('profiles').update({
      shopify_collection_id: collectionId,
      shopify_collection_title: collectionTitle,
    }).eq('id', userId)
    revalidatePath('/admin')
  }

  async function createAndAssignCollection(formData: FormData) {
    'use server'
    const userId = formData.get('userId') as string
    const title = formData.get('collectionTitle') as string
    if (!userId || !title) return
    const a = createAdminClient()
    try {
      const col = await createCollection(title)
      await a.from('profiles').update({
        shopify_collection_id: col.id,
        shopify_collection_title: col.title,
      }).eq('id', userId)
    } catch (e) {
      console.error('Create collection failed', e)
    }
    revalidatePath('/admin')
  }

  async function approveAndPublish(formData: FormData) {
    'use server'
    const designId = formData.get('designId') as string
    if (!designId) return

    const a = createAdminClient()

    // Load design
    const { data: design } = await a.from('designs').select('*').eq('id', designId).single()
    if (!design) return

    // Load profile (for collection assignment)
    const { data: profile } = await a
      .from('profiles')
      .select('shopify_collection_id, shopify_collection_title, quartet_name')
      .eq('id', design.user_id)
      .single()

    if (!profile?.shopify_collection_id) {
      console.error('No Shopify collection assigned to this quartet')
      return
    }

    const client = getPrintfulClient()

    try {
      // 1. Generate a short-lived signed URL for the logo
      const { data: signedData } = await a.storage
        .from('cqs-assets')
        .createSignedUrl(design.logo_path, 300) // 5 minutes — Printful fetches it immediately
      if (!signedData?.signedUrl) throw new Error('Could not generate signed URL for logo')

      // 2. Get print area dimensions (same calc as mockup generator)
      const printfiles = await client.getPrintfiles(design.product_id)
      const area = getPrintAreaForPlacement(printfiles, design.placement, design.variant_ids)
        ?? { width: 1800, height: 1800 }
      const position = transformToPosition(design.transform, area)

      // 3. Create Printful sync product
      const quartetName = profile.quartet_name || design.quartet_name || 'Custom Quartet'
      const syncProduct = await client.createSyncProduct({
        name: `${quartetName} — ${design.product_title}`,
        variantIds: design.variant_ids,
        placement: design.placement,
        imageUrl: signedData.signedUrl,
        position,
      })

      // 4. Update design with Printful sync product ID (Shopify handled separately once credentials are set up)
      const dbUpdate: any = {
        status: 'approved',
        printful_sync_product_id: syncProduct.id,
      }

      // 5. Shopify — only attempt if credentials are configured
      if (process.env.SHOPIFY_ADMIN_ACCESS_TOKEN && profile.shopify_collection_id) {
        try {
          const mockupImages = (design.mockup_urls as any[] ?? [])
            .map((m: any, i: number) => ({ src: m.mockup_url, alt: `${quartetName} mockup ${i + 1}` }))
            .filter((m: any) => !!m.src)

          const shopifyProduct = await createProduct({
            title: `${quartetName} — ${design.product_title} (${design.color || design.placement})`,
            body_html: design.notes ? `<p>${design.notes}</p>` : undefined,
            images: mockupImages,
            tags: `cqs,quartet,${design.placement}`,
          })

          await addProductToCollection(profile.shopify_collection_id, shopifyProduct.id)

          dbUpdate.status = 'pushed_to_shopify'
          dbUpdate.shopify_product_id = shopifyProduct.id
          dbUpdate.shopify_product_url = `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/products/${shopifyProduct.id}`
        } catch (shopifyErr: any) {
          console.error('Shopify push failed (Printful succeeded):', shopifyErr?.message)
          // Design stays as approved with Printful sync product — Shopify can be retried
        }
      }

      await a.from('designs').update(dbUpdate).eq('id', designId)

    } catch (e: any) {
      console.error('approveAndPublish failed:', e?.message || e)
    }

    revalidatePath('/admin')
  }

  async function updateStatus(formData: FormData) {
    'use server'
    const designId = formData.get('designId') as string
    const status = formData.get('status') as string
    if (!designId || !status) return
    const a = createAdminClient()
    await a.from('designs').update({ status: status as any }).eq('id', designId)
    revalidatePath('/admin')
  }

  // --- Render ---

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-600',
      review_requested: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-blue-100 text-blue-800',
      pushed_to_shopify: 'bg-green-100 text-green-800',
    }
    return `inline-block text-[10px] px-2 py-0.5 rounded-full font-medium ${map[status] ?? 'bg-gray-100 text-gray-500'}`
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-12">
      <div>
        <div className="uppercase tracking-[2px] text-xs text-[#9b1c1c]">CQS Internal</div>
        <h1 className="text-4xl font-semibold tracking-tight">Admin Dashboard</h1>
        <p className="text-[#6b5f54]">Review designs, assign collections, and publish to Printful + Shopify.</p>
      </div>

      {/* ── Quartets & Collections ─────────────────────────────── */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Quartets &amp; Collections</h2>
        {collections.length === 0 && (
          <p className="text-sm text-[#9b1c1c] mb-3">
            ⚠ Shopify not configured — set SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_ACCESS_TOKEN to enable the collection dropdown.
          </p>
        )}
        <div className="overflow-x-auto border border-[#d4c5b0] rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-[#1c1412] text-[#f7f3ee]">
              <tr>
                <th className="text-left p-3 font-normal">Quartet</th>
                <th className="text-left p-3 font-normal">Email</th>
                <th className="text-left p-3 font-normal w-96">Shopify Collection</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-[#f0ebe3]">
              {quartets.length === 0 && (
                <tr><td colSpan={3} className="p-4 text-center text-[#8a7660]">No quartets yet.</td></tr>
              )}
              {quartets.map((p: any) => (
                <tr key={p.id}>
                  <td className="p-3 font-medium">{p.quartet_name || '—'}</td>
                  <td className="p-3 text-xs text-[#6b5f54]">{p.email || '—'}</td>
                  <td className="p-3">
                    <CollectionAssigner
                      userId={p.id}
                      quartetName={p.quartet_name || 'Quartet'}
                      currentCollectionId={p.shopify_collection_id}
                      currentCollectionTitle={p.shopify_collection_title}
                      collections={collections}
                      assignAction={assignCollection}
                      createAction={createAndAssignCollection}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Designs ────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xl font-semibold mb-4">All Designs</h2>
        <div className="overflow-x-auto border border-[#d4c5b0] rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-[#1c1412] text-[#f7f3ee]">
              <tr>
                <th className="text-left p-3 font-normal">Preview</th>
                <th className="text-left p-3 font-normal">Quartet</th>
                <th className="text-left p-3 font-normal">Design</th>
                <th className="text-left p-3 font-normal">Status</th>
                <th className="text-left p-3 font-normal">Notes</th>
                <th className="p-3 font-normal w-64">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-[#f0ebe3]">
              {(designs ?? []).map((d: any) => {
                const firstMockup = (d.mockup_urls as any[])?.[0]?.mockup_url
                const hasCollection = !!d.profiles?.shopify_collection_id
                const isPublished = d.status === 'pushed_to_shopify'
                return (
                  <tr key={d.id} className="align-top">
                    <td className="p-3">
                      {firstMockup ? (
                        <a href={firstMockup} target="_blank" rel="noreferrer">
                          <img src={firstMockup} alt="mockup" className="w-20 h-20 object-cover rounded border border-[#d4c5b0]" />
                        </a>
                      ) : (
                        <div className="w-20 h-20 rounded border border-[#d4c5b0] bg-[#f9f6f0] flex items-center justify-center text-[10px] text-[#8a7660] text-center px-1">
                          no mockup
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{d.profiles?.quartet_name || d.quartet_name}</div>
                      <div className="text-xs text-[#6b5f54]">{d.profiles?.email}</div>
                      {d.profiles?.shopify_collection_title && (
                        <div className="text-[10px] text-[#b8892a] mt-0.5">📁 {d.profiles.shopify_collection_title}</div>
                      )}
                    </td>
                    <td className="p-3">
                      <div>{d.product_title}</div>
                      <div className="text-xs text-[#b8892a]">{d.color} • {d.placement}</div>
                      <div className="text-[10px] text-[#8a7660] mt-0.5">
                        {new Date(d.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={statusBadge(d.status)}>{d.status.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="p-3 text-xs text-[#6b5f54] max-w-[160px] line-clamp-3">
                      {d.notes || '—'}
                    </td>
                    <td className="p-3 space-y-2">
                      {/* Open in editor */}
                      <Link
                        href={`/studio/editor?productId=${d.product_id}&designId=${d.id}`}
                        className="block text-xs underline text-[#6b5f54] hover:text-[#1c1412]"
                      >
                        Open in editor
                      </Link>

                      {/* Approve & Publish — the main action */}
                      {!isPublished && (
                        <form action={approveAndPublish}>
                          <input type="hidden" name="designId" value={d.id} />
                          <button
                            type="submit"
                            disabled={!hasCollection || !firstMockup}
                            title={!hasCollection ? 'Assign a Shopify collection to this quartet first' : !firstMockup ? 'Generate a mockup first' : ''}
                            className="w-full text-xs px-3 py-1.5 bg-[#9b1c1c] text-white rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#7a1616] transition"
                          >
                            Approve &amp; Publish
                          </button>
                          {!hasCollection && (
                            <div className="text-[10px] text-[#9b1c1c] mt-0.5">↑ assign collection first</div>
                          )}
                        </form>
                      )}

                      {/* Revert to draft */}
                      {d.status !== 'draft' && !isPublished && (
                        <form action={updateStatus}>
                          <input type="hidden" name="designId" value={d.id} />
                          <input type="hidden" name="status" value="draft" />
                          <button className="text-[10px] text-[#8a7660] underline">Revert to draft</button>
                        </form>
                      )}

                      {/* Links once published */}
                      {d.shopify_product_url && (
                        <a href={d.shopify_product_url} target="_blank" rel="noreferrer"
                          className="block text-[10px] text-[#b8892a] underline">
                          View in Shopify →
                        </a>
                      )}
                      {d.printful_sync_product_id && (
                        <a
                          href={`https://www.printful.com/dashboard/products`}
                          target="_blank" rel="noreferrer"
                          className="block text-[10px] text-[#b8892a] underline"
                        >
                          View in Printful →
                        </a>
                      )}
                    </td>
                  </tr>
                )
              })}
              {(designs ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#8a7660]">No designs yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-[#8a7660]">
        Admin access via service role. "Approve &amp; Publish" creates the sync product in Printful and a draft product in Shopify under the quartet's collection.
      </p>
    </div>
  )
}
