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
import AdminQueueClient from './AdminQueueClient'

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
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  // Fetch profiles separately to avoid join cache issues
  const userIds = [...new Set((designs ?? []).map((d: any) => d.user_id))]
  const { data: profiles } = userIds.length
    ? await admin.from('profiles').select('id, email, quartet_name, shopify_collection_id, shopify_collection_title').in('id', userIds)
    : { data: [] }

  // Build a lookup map and attach profiles to designs
  const profileById = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]))
  const designsWithProfiles = (designs ?? []).map((d: any) => ({
    ...d,
    profiles: profileById[d.user_id] ?? null,
  }))

  // Generate signed URLs for canvas previews (stored as storage paths)
  const designsWithSignedPreviews = await Promise.all(
    (designsWithProfiles).map(async (d: any) => {
      if (d.canvas_preview_url && !d.canvas_preview_url.startsWith('http')) {
        const { data } = await admin.storage.from('cqs-assets')
          .createSignedUrl(d.canvas_preview_url, 3600)
        return { ...d, canvas_preview_signed: data?.signedUrl || null }
      }
      return { ...d, canvas_preview_signed: d.canvas_preview_url || null }
    })
  )

  // Fetch kickback_percentage separately — column may not exist yet
  let kickbackMap: Record<string, number> = {}
  try {
    const { data: kb } = await admin.from('profiles')
      .select('id, kickback_percentage').in('id', userIds.length ? userIds : ['__none__'])
    for (const row of (kb ?? [])) {
      kickbackMap[row.id] = row.kickback_percentage ?? 0
    }
  } catch { /* column not added yet — defaults to 0 */ }

  // Deduplicate profiles for the Quartets section
  const profileMap = new Map()
  for (const d of designsWithSignedPreviews) {
    if (d.profiles && !profileMap.has(d.user_id)) {
      profileMap.set(d.user_id, {
        ...d.profiles,
        id: d.user_id,
        kickback_percentage: kickbackMap[d.user_id] ?? 0,
      })
    }
  }
  const quartets = Array.from(profileMap.values())

  // Shopify collections for the dropdown (graceful if not configured)
  let collections = []
  try {
    collections = await listCollections()
  } catch (e) {
    console.error('[CQS COLLECTIONS] failed:', String(e))
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

  async function generateMockups(formData: FormData) {
    'use server'
    const designId = formData.get('designId') as string
    if (!designId) return

    const a = createAdminClient()
    const { data: design } = await a.from('designs').select('*').eq('id', designId).single()
    if (!design) return

    const client = getPrintfulClient()

    try {
      const { data: signedData } = await a.storage
        .from('cqs-assets')
        .createSignedUrl(design.logo_path, 300)
      if (!signedData?.signedUrl) throw new Error('Could not sign logo URL')

      const logoRes = await fetch(signedData.signedUrl)
      const buffer = Buffer.from(await logoRes.arrayBuffer())
      const fileResult = await client.uploadFile(buffer, 'logo.png')

      const printfiles = await client.getPrintfiles(design.product_id)
      const area = getPrintAreaForPlacement(printfiles, design.placement, design.variant_ids)
        ?? { width: 1800, height: 1800 }
      const position = transformToPosition(design.transform, area)

      const taskKey = await client.createMockupTask({
        product_id: design.product_id,
        variant_ids: design.variant_ids,
        placement: design.placement,
        image_url: fileResult.url || fileResult.preview_url!,
        position,
      })

      const result = await client.pollTask(taskKey, 2800, 22)
      await a.from('designs').update({ mockup_urls: result.mockups || [] }).eq('id', designId)
    } catch (e: any) {
      console.error('generateMockups failed:', e?.message)
    }

    revalidatePath('/admin')
  }

  async function approveAndPublish(formData: FormData) {
    'use server'
    const designId = formData.get('designId') as string
    if (!designId) return

    const pricingJson = formData.get('pricingJson') as string | null
    const pricing = pricingJson ? JSON.parse(pricingJson) : null
    const saveKickback = formData.get('saveKickback')

    const a = createAdminClient()

    const { data: design } = await a.from('designs').select('*').eq('id', designId).single()
    if (!design) return

    const { data: profile } = await a
      .from('profiles')
      .select('shopify_collection_id, shopify_collection_title, quartet_name')
      .eq('id', design.user_id)
      .single()

    if (!profile?.shopify_collection_id) {
      console.error('No Shopify collection assigned to this quartet')
      return
    }

    // Persist kickback % to profile if admin chose to save it
    if (saveKickback) {
      await a.from('profiles')
        .update({ kickback_percentage: parseFloat(saveKickback) })
        .eq('id', design.user_id)
    }

    const client = getPrintfulClient()

    try {
      const { data: signedData } = await a.storage
        .from('cqs-assets')
        .createSignedUrl(design.logo_path, 300)
      if (!signedData?.signedUrl) throw new Error('Could not generate signed URL for logo')

      const printfiles = await client.getPrintfiles(design.product_id)
      const area = getPrintAreaForPlacement(printfiles, design.placement, design.variant_ids)
        ?? { width: 1800, height: 1800 }
      const position = transformToPosition(design.transform, area)

      const quartetName = profile.quartet_name || design.quartet_name || 'Custom Quartet'

      // Build pricing args from modal selection
      const flatPrice = pricing?.mode === 'flat' ? pricing.flatPrice : undefined
      const variantPrices = pricing?.mode === 'by_size'
        ? Object.fromEntries(Object.entries(pricing.variantPrices).map(([k, v]) => [Number(k), v as string]))
        : undefined

      const syncProduct = await client.createSyncProduct({
        name: `${quartetName} — ${design.product_title}`,
        variantIds: design.variant_ids,
        placement: design.placement,
        imageUrl: signedData.signedUrl,
        position,
        retailPrice: flatPrice,
        variantPrices,
      })

      const dbUpdate: any = {
        status: 'approved',
        printful_sync_product_id: syncProduct.id,
      }

      if (process.env.SHOPIFY_CLIENT_ID && profile.shopify_collection_id) {
        try {
          const mockupImages = (design.mockup_urls as any[] ?? [])
            .map((m: any, i: number) => ({ src: m.mockup_url, alt: `${quartetName} mockup ${i + 1}` }))
            .filter((m: any) => !!m.src)

          const shopifyVariants = pricing?.mode === 'by_size' && pricing.variantPrices
            ? design.variant_ids.map((id: number) => ({
                price: pricing.variantPrices[id] ?? flatPrice ?? '35.00',
              }))
            : [{ price: flatPrice ?? '35.00' }]

          const shopifyProduct = await createProduct({
            title: `${quartetName} — ${design.product_title} (${design.color || design.placement})`,
            body_html: design.notes ? `<p>${design.notes}</p>` : undefined,
            images: mockupImages,
            tags: `cqs,quartet,${design.placement}`,
            variants: shopifyVariants,
          })

          await addProductToCollection(profile.shopify_collection_id, shopifyProduct.id)

          dbUpdate.status = 'pushed_to_shopify'
          dbUpdate.shopify_product_id = shopifyProduct.id
          dbUpdate.shopify_product_url = `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/products/${shopifyProduct.id}`
        } catch (shopifyErr: any) {
          console.error('Shopify push failed (Printful succeeded):', shopifyErr?.message)
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

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-12">
      <div className="flex items-start justify-between">
        <div>
          <div className="uppercase tracking-[2px] text-xs text-[#9b1c1c]">CQS Internal</div>
          <h1 className="text-4xl font-semibold tracking-tight">Admin Dashboard</h1>
          <p className="text-[#6b5f54]">Review designs, assign collections, and publish to Printful + Shopify.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/groups" className="btn-secondary px-5 py-2.5 rounded-xl text-sm">
            Group Accounts →
          </Link>
          <Link href="/admin/collections" className="btn-secondary px-5 py-2.5 rounded-xl text-sm">
            Collection Manager →
          </Link>
        </div>
      </div>

      {/* ── Queue ───────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Review Queue</h2>
        <AdminQueueClient
          designs={designsWithSignedPreviews}
          quartets={quartets}
          collections={collections}
          assignAction={assignCollection}
          createAction={createAndAssignCollection}
          generateAction={generateMockups}
          approveAction={approveAndPublish}
          updateStatusAction={updateStatus}
        />
      </section>

      <p className="text-xs text-[#8a7660]">
        "Approve &amp; Publish" creates the sync product in Printful and a draft product in Shopify under the quartet's collection.
      </p>
    </div>
  )
}
