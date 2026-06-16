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
  addProductImage,
  addToQuartetDirectory,
} from '@/lib/shopify'
import {
  getPrintfulClient,
  getPrintAreaForPlacement,
  transformToPosition,
} from '@/lib/printful'
import AdminQueueClient from './AdminQueueClient'
import CollectionDropdown from './CollectionDropdown'
import PrintfulDraftOrders from './PrintfulDraftOrders'

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

  // Batch-sign canvas preview paths in one API call instead of one-per-design
  const pathsToSign = designsWithProfiles
    .map((d: any) => d.canvas_preview_url)
    .filter((u: any) => u && !u.startsWith('http'))
  const signedMap: Record<string, string> = {}
  if (pathsToSign.length > 0) {
    const { data: signedData } = await admin.storage.from('cqs-assets')
      .createSignedUrls(pathsToSign, 3600)
    for (const s of (signedData ?? [])) {
      if (s.path && s.signedUrl) signedMap[s.path] = s.signedUrl
    }
  }
  const designsWithSignedPreviews = designsWithProfiles.map((d: any) => ({
    ...d,
    canvas_preview_signed: d.canvas_preview_url?.startsWith('http')
      ? d.canvas_preview_url
      : (signedMap[d.canvas_preview_url] ?? null),
  }))

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

  // Printful draft orders awaiting confirmation
  let draftOrders: any[] = []
  try {
    const pfClient = getPrintfulClient()
    const allDrafts = await pfClient.getDraftOrders()
    // Only show real customer orders — webhook-created drafts always have an external_id
    // (Shopify order ID) and a fully populated recipient. Manual Printful drafts have neither.
    draftOrders = allDrafts.filter(o => o.external_id && o.recipient.name && o.recipient.address1)
  } catch (e: any) {
    console.error('[CQS PRINTFUL] failed to fetch draft orders:', e?.message)
  }

  // --- Server actions ---

  async function assignCollection(userId: string, collectionId: number, collectionTitle: string) {
    'use server'
    if (!userId || !collectionId) return
    const a = createAdminClient()
    await a.from('profiles').update({
      shopify_collection_id: collectionId,
      shopify_collection_title: collectionTitle,
    }).eq('id', userId)
  }

  async function createAndAssignCollection(userId: string, collectionTitle: string) {
    'use server'
    if (!userId || !collectionTitle) return
    const a = createAdminClient()
    try {
      const col = await createCollection(collectionTitle)
      await a.from('profiles').update({
        shopify_collection_id: col.id,
        shopify_collection_title: col.title,
      }).eq('id', userId)
      await addToQuartetDirectory(collectionTitle, col.handle).catch(e =>
        console.error('Failed to add to quartet directory:', e)
      )
    } catch (e) {
      console.error('Create collection failed', e)
    }
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
      const primaryArea = getPrintAreaForPlacement(printfiles, design.placement, design.variant_ids)
        ?? { width: 1800, height: 1800 }
      const position = transformToPosition(design.transform, primaryArea)
      const imageUrl = fileResult.url || fileResult.preview_url!

      // Build per-color entries — primary color + any extra colors from color_variant_map
      const colorVariantMap: Record<string, number[]> =
        design.color_variant_map || { [design.color || 'Default']: design.variant_ids }

      async function generateForColor(colorName: string, ids: number[]): Promise<any[]> {
        const area = getPrintAreaForPlacement(printfiles, design.placement, ids) ?? primaryArea
        const pos = transformToPosition(design.transform, area)
        const taskKey = await client.createMockupTask({
          product_id: design.product_id,
          variant_ids: ids.slice(0, 5),
          placement: design.placement,
          image_url: imageUrl,
          position: pos,
        })
        const result = await client.pollTask(taskKey, 2800, 22)
        return (result.mockups || []).map((m: any) => ({ ...m, color: colorName }))
      }

      const results = await Promise.all(
        Object.entries(colorVariantMap).map(([color, ids]) => generateForColor(color, ids))
      )
      await a.from('designs').update({ mockup_urls: results.flat() }).eq('id', designId)
    } catch (e: any) {
      console.error('generateMockups failed:', e?.message)
    }

    revalidatePath('/admin')
  }

  async function approveAndPublish(designId: string, pricingJson: string, customTitle: string, saveKickback: string) {
    'use server'
    if (!designId) return

    const pricing = pricingJson ? JSON.parse(pricingJson) : null
    const customTitleClean = customTitle?.trim() || null

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
    const quartetName = profile.quartet_name || design.quartet_name || 'Custom Quartet'
    const flatPrice = pricing?.mode === 'flat' ? pricing.flatPrice : undefined
    const variantPrices = pricing?.mode === 'by_size'
      ? Object.fromEntries(Object.entries(pricing.variantPrices).map(([k, v]) => [Number(k), v as string]))
      : undefined

    const dbUpdate: any = { status: 'approved' }

    // Shopify product creation
    if (process.env.SHOPIFY_CLIENT_ID && profile.shopify_collection_id) {
      try {
        const allMockups: any[] = design.mockup_urls ?? []
        const hasPerColorMockups = allMockups.some((m: any) => m.color)
        const primaryColor = design.color || Object.keys(
          design.color_variant_map || { [design.color || 'Default']: [] }
        )[0]
        // When per-color mockups exist, pass NO images at product creation time.
        // addProductImage below links each color's mockup to its variant IDs,
        // so Shopify only shows the selected color's image — no stale "original" underneath.
        const mockupImages = hasPerColorMockups
          ? []
          : allMockups
              .map((m: any, i: number) => ({ src: m.mockup_url, alt: `${quartetName} mockup ${i + 1}` }))
              .filter((m: any) => !!m.src)

        // Build color × size variant matrix --------------------------------
        // color_variant_map: { "Black": [pfId1, pfId2, ...], "Gray": [...] }
        const colorVariantMap: Record<string, number[]> =
          design.color_variant_map || { [design.color || 'Default']: design.variant_ids }
        const selectedColors = Object.keys(colorVariantMap)

        // Fetch Printful variant details to get size names
        let variantById = new Map<number, any>()
        try {
          const rawProduct = await client.getProduct(design.product_id) as any
          const pfVariants: any[] = rawProduct.variants ?? []
          variantById = new Map(pfVariants.map((v: any) => [Number(v.id), v]))
        } catch {
          // No size data available — fall through to flat pricing
        }

        // Size order from primary color's variants
        const primaryIds: number[] = (colorVariantMap[primaryColor] || design.variant_ids).map(Number)
        const sizeOrder: string[] = []
        const seenSizes = new Set<string>()
        for (const id of primaryIds) {
          const v = variantById.get(id)
          if (v?.size && !seenSizes.has(v.size)) {
            seenSizes.add(v.size)
            sizeOrder.push(v.size)
          }
        }

        // Size → price from PricingModal (keyed by primary color's variant IDs)
        const sizeToPrice = new Map<string, string>()
        if (pricing?.mode === 'by_size' && pricing.variantPrices) {
          for (const id of primaryIds) {
            const v = variantById.get(id)
            if (v?.size) {
              sizeToPrice.set(v.size, String(pricing.variantPrices[id] ?? flatPrice ?? '35.00'))
            }
          }
        }

        const hasColors = selectedColors.length > 1
        const hasSizes = sizeOrder.length > 0
        const productOptions: string[] = [
          ...(hasColors ? ['Color'] : []),
          ...(hasSizes ? ['Size'] : []),
        ]

        const shopifyVariants: any[] = []
        for (const color of selectedColors) {
          if (hasSizes) {
            for (const size of sizeOrder) {
              const price = pricing?.mode === 'by_size'
                ? (sizeToPrice.get(size) ?? flatPrice ?? '35.00')
                : (flatPrice ?? '35.00')
              const variant: any = { price }
              if (hasColors && hasSizes) { variant.option1 = color; variant.option2 = size }
              else if (hasColors)        { variant.option1 = color }
              else if (hasSizes)         { variant.option1 = size }
              shopifyVariants.push(variant)
            }
          } else {
            shopifyVariants.push({
              price: flatPrice ?? '35.00',
              ...(hasColors ? { option1: color } : {}),
            })
          }
        }
        // ------------------------------------------------------------------

        const [productDescription] = await Promise.allSettled([
          client.getProductDescription(design.product_id),
        ])
        const descriptionHtml = productDescription.status === 'fulfilled'
          ? productDescription.value : ''
        const notesHtml = design.notes ? `<p><em>${design.notes}</em></p>` : ''

        const colorLabel = selectedColors.length > 1
          ? `${selectedColors.length} Colors`
          : (design.color || design.placement)

        const shopifyProduct = await createProduct({
          title: customTitleClean ?? `${quartetName} — ${design.product_title} (${colorLabel})`,
          body_html: [notesHtml, descriptionHtml].filter(Boolean).join('\n') || undefined,
          images: mockupImages,
          tags: `cqs,quartet,${design.placement}`,
          options: productOptions.length > 0 ? productOptions : undefined,
          variants: shopifyVariants,
        })

        await addProductToCollection(profile.shopify_collection_id, shopifyProduct.id)

        // Link mockup images to Shopify variant IDs.
        // Per-color mockups: each color's design-on-shirt image links to that color's variants.
        // Garment image fallback: used when no mockup was generated for that color.
        // Single-color products: all variants get the one mockup image.
        if (hasColors || hasPerColorMockups) {
          const colorToMockupUrl = new Map<string, string>()
          for (const m of (design.mockup_urls as any[] ?? [])) {
            if (m.color && m.mockup_url && !colorToMockupUrl.has(m.color)) {
              colorToMockupUrl.set(m.color, m.mockup_url)
            }
          }

          if (hasColors) {
            // Multi-color: option1 on each variant is the color name
            const colorToShopifyIds = new Map<string, number[]>()
            for (const v of (shopifyProduct.variants || [])) {
              const color = v.option1 as string
              if (!colorToShopifyIds.has(color)) colorToShopifyIds.set(color, [])
              colorToShopifyIds.get(color)!.push(v.id)
            }
            for (const [color, shopifyIds] of colorToShopifyIds) {
              const mockupUrl = colorToMockupUrl.get(color)
              if (mockupUrl) {
                await addProductImage(shopifyProduct.id, mockupUrl, shopifyIds).catch(() => {})
              } else if (variantById.size > 0) {
                const pfId = Number((colorVariantMap[color] || [])[0])
                const garmentImage = pfId ? variantById.get(pfId)?.image : null
                if (garmentImage) {
                  await addProductImage(shopifyProduct.id, garmentImage, shopifyIds).catch(() => {})
                }
              }
            }
          } else {
            // Single-color: link the one mockup to all variant IDs
            const mockupUrl = colorToMockupUrl.get(primaryColor) ?? [...colorToMockupUrl.values()][0]
            if (mockupUrl) {
              const allVariantIds = (shopifyProduct.variants || []).map((v: any) => v.id as number)
              if (allVariantIds.length > 0) {
                await addProductImage(shopifyProduct.id, mockupUrl, allVariantIds).catch(() => {})
              }
            }
          }
        }

        dbUpdate.status = 'pushed_to_shopify'
        dbUpdate.shopify_product_id = shopifyProduct.id
        dbUpdate.shopify_product_url = `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/products/${shopifyProduct.id}`

        // Build shopifyVariantId → printfulVariantId map so the order webhook can
        // find the right Printful variant without extra API calls at fulfillment time.
        const shopifyToPrintful: Record<string, number> = {}
        for (const sv of (shopifyProduct.variants || [])) {
          const colorName = hasColors ? sv.option1 : primaryColor
          const sizeName  = hasSizes  ? (hasColors ? sv.option2 : sv.option1) : null
          const pfIds = (colorVariantMap[colorName] || []).map(Number)
          let pfId: number | null = pfIds[0] ?? null
          if (sizeName) pfId = pfIds.find((id: number) => variantById.get(id)?.size === sizeName) ?? pfId
          if (pfId) shopifyToPrintful[String(sv.id)] = pfId
        }
        if (Object.keys(shopifyToPrintful).length > 0) {
          dbUpdate.shopify_variant_to_printful = shopifyToPrintful
        }

        // Printful sync — runs after Shopify so we can link using real Shopify variant IDs.
        // Uploads logo to Printful's file library (permanent URL, no expiry) then creates
        // a sync product referencing the Shopify product we just made — no duplicates.
        try {
          const { data: pfSignedData } = await a.storage
            .from('cqs-assets')
            .createSignedUrl(design.logo_path, 600)
          if (pfSignedData?.signedUrl) {
            const logoRes = await fetch(pfSignedData.signedUrl)
            const logoBuffer = Buffer.from(await logoRes.arrayBuffer())
            const pfFile = await client.uploadFile(logoBuffer, 'logo.png')

            const printfiles = await client.getPrintfiles(design.product_id)

            // Build Printful variant ID → Shopify variant ID mapping
            const variantExternalIds: Record<number, string> = {}
            const allPfVariantIds: number[] = []
            for (const sv of (shopifyProduct.variants || [])) {
              const colorName = hasColors ? sv.option1 : primaryColor
              const sizeName  = hasSizes  ? (hasColors ? sv.option2 : sv.option1) : null
              const pfIds = (colorVariantMap[colorName] || []).map(Number)
              let pfId: number | null = pfIds[0] ?? null
              if (sizeName) pfId = pfIds.find((id: number) => variantById.get(id)?.size === sizeName) ?? null
              if (pfId) {
                variantExternalIds[pfId] = String(sv.id)
                if (!allPfVariantIds.includes(pfId)) allPfVariantIds.push(pfId)
              }
            }

            if (allPfVariantIds.length > 0) {
              const pfArea = getPrintAreaForPlacement(printfiles, design.placement, allPfVariantIds)
                ?? { width: 1800, height: 1800 }
              const pfPosition = transformToPosition(design.transform, pfArea)
              const pfSync = await client.createSyncProduct({
                name: shopifyProduct.title,
                externalProductId: String(shopifyProduct.id),
                variantIds: allPfVariantIds,
                variantExternalIds,
                placement: design.placement,
                imageUrl: pfFile.url,
                position: pfPosition,
                retailPrice: flatPrice,
                variantPrices,
              })
              dbUpdate.printful_sync_product_id = pfSync.id
            }
          }
        } catch (pfErr: any) {
          console.warn('Printful sync failed (non-fatal):', pfErr?.message)
        }
      } catch (shopifyErr: any) {
        console.error('Shopify push failed:', shopifyErr?.message)
      }
    }

    await a.from('designs').update(dbUpdate).eq('id', designId)
  }

  async function confirmPrintfulOrder(orderId: number) {
    'use server'
    const pfClient = getPrintfulClient()
    await pfClient.confirmOrder(orderId)
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
          <div className="eyebrow">CQS Internal</div>
          <h1 className="text-4xl font-semibold tracking-tight">Admin Dashboard</h1>
          <p className="text-[#6b5f54]">Review designs, assign collections, and publish to Printful + Shopify.</p>
        </div>
        <div className="flex items-center gap-3">
          <CollectionDropdown collections={collections} />
          <Link href="/admin/homebase" className="btn-primary px-5 py-2.5 text-[13px]">
            Homebase →
          </Link>
          <Link href="/admin/groups" className="btn-secondary px-5 py-2.5 text-[13px]">
            Groups →
          </Link>
          <Link href="/admin/promote" className="btn-secondary px-5 py-2.5 text-[13px]">
            Promote →
          </Link>
          <Link href="/admin/collections" className="btn-secondary px-5 py-2.5 text-[13px]">
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

      {/* ── Printful Draft Orders ───────────────────────────────── */}
      <section>
        <div className="flex items-baseline gap-3 mb-4">
          <h2 className="text-xl font-semibold">Printful Orders — Awaiting Approval</h2>
          {draftOrders.length > 0 && (
            <span className="text-[10px] font-bold bg-[#1c1412] text-white px-2 py-0.5">
              {draftOrders.length}
            </span>
          )}
        </div>
        <p className="text-xs text-[#8a7660] mb-4">
          Each draft was created automatically when a customer ordered a CQS-designed product.
          Review the design preview, then confirm to send it to Printful for printing and shipping.
        </p>
        <PrintfulDraftOrders orders={draftOrders} confirmAction={confirmPrintfulOrder} />
      </section>

      <p className="text-xs text-[#8a7660]">
        "Approve &amp; Publish" creates the sync product in Printful and a draft product in Shopify under the quartet's collection.
      </p>
    </div>
  )
}
