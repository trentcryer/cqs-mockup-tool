import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/api-auth'
import { createProduct, addProductToCollection, addProductImage } from '@/lib/shopify'
import { getPrintfulClient, getPrintAreaForPlacement, transformToPosition } from '@/lib/printful'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminUser(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id: designId } = await params
  const { pricing, customTitle, saveKickback, colorVariantMap: colorVariantMapOverride } = await req.json()
  const customTitleClean = customTitle?.trim() || null

  const a = createAdminClient()

  const { data: design } = await a.from('designs').select('*').eq('id', designId).single() as { data: any }
  if (!design) return NextResponse.json({ error: 'Design not found' }, { status: 404 })

  const { data: profile } = await a
    .from('profiles')
    .select('shopify_collection_id, shopify_collection_title, quartet_name')
    .eq('id', design.user_id)
    .single() as { data: any }

  if (!profile?.shopify_collection_id) {
    return NextResponse.json({ error: 'No Shopify collection assigned to this quartet' }, { status: 400 })
  }

  // Persist kickback % to profile if admin chose to save it
  if (saveKickback) {
    await (a.from('profiles') as any)
      .update({ kickback_percentage: parseFloat(saveKickback) })
      .eq('id', design.user_id)
  }

  const client = getPrintfulClient()
  const quartetName = profile.quartet_name || design.quartet_name || 'Custom Quartet'
  const flatPrice = pricing?.mode === 'flat' ? pricing.flatPrice : undefined
  const variantPrices: Record<number, string> | undefined = pricing?.mode === 'by_size'
    ? Object.fromEntries(Object.entries(pricing.variantPrices).map(([k, v]) => [Number(k), v as string]))
    : undefined
  const price = flatPrice || '35.00'

  const dbUpdate: any = { status: 'approved' }

  if (!process.env.SHOPIFY_CLIENT_ID) {
    return NextResponse.json({ error: 'Shopify credentials not configured' }, { status: 500 })
  }

  try {
    const allMockups: any[] = design.mockup_urls ?? []
    const hasPerColorMockups = allMockups.some((m: any) => m.color)
    const primaryColor = design.color || Object.keys(
      design.color_variant_map || { [design.color || 'Default']: [] }
    )[0]
    const mockupImages = hasPerColorMockups
      ? []
      : allMockups
          .map((m: any, i: number) => ({ src: m.mockup_url, alt: `${quartetName} mockup ${i + 1}` }))
          .filter((m: any) => !!m.src)

    const colorVariantMap: Record<string, number[]> =
      colorVariantMapOverride || design.color_variant_map || { [design.color || 'Default']: design.variant_ids }
    const selectedColors = Object.keys(colorVariantMap)

    let variantById = new Map<number, any>()
    try {
      const rawProduct = await client.getProduct(design.product_id) as any
      const pfVariants: any[] = rawProduct.variants ?? []
      variantById = new Map(pfVariants.map((v: any) => [Number(v.id), v]))
    } catch {
      // No size data available — fall through to flat pricing
    }

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

    // Size → price from the pricing chart (keyed by primary color's variant IDs)
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
          const variantPrice = pricing?.mode === 'by_size'
            ? (sizeToPrice.get(size) ?? price)
            : price
          const variant: any = { price: variantPrice }
          if (hasColors && hasSizes) { variant.option1 = color; variant.option2 = size }
          else if (hasColors)        { variant.option1 = color }
          else if (hasSizes)         { variant.option1 = size }
          shopifyVariants.push(variant)
        }
      } else {
        shopifyVariants.push({
          price,
          ...(hasColors ? { option1: color } : {}),
        })
      }
    }

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

    if (hasColors || hasPerColorMockups) {
      const colorToMockupUrl = new Map<string, string>()
      for (const m of (design.mockup_urls as any[] ?? [])) {
        if (m.color && m.mockup_url && !colorToMockupUrl.has(m.color)) {
          colorToMockupUrl.set(m.color, m.mockup_url)
        }
      }

      if (hasColors) {
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

    try {
      const { data: pfSignedData } = await a.storage
        .from('cqs-assets')
        .createSignedUrl(design.logo_path, 600)
      if (pfSignedData?.signedUrl) {
        const logoRes = await fetch(pfSignedData.signedUrl)
        const logoBuffer = Buffer.from(await logoRes.arrayBuffer())
        const pfFile = await client.uploadFile(logoBuffer, 'logo.png')

        const printfiles = await client.getPrintfiles(design.product_id)

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
    await (a.from('designs') as any).update(dbUpdate).eq('id', designId)
    return NextResponse.json({ error: `Shopify push failed: ${shopifyErr?.message}` }, { status: 500 })
  }

  await (a.from('designs') as any).update(dbUpdate).eq('id', designId)
  return NextResponse.json({ ok: true, shopify_product_url: dbUpdate.shopify_product_url ?? null })
}
