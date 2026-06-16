import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { sendPushToUser, sendPushToMany } from '@/lib/push'
import { getPrintfulClient, getPrintAreaForPlacement, transformToPosition } from '@/lib/printful'

// Verify the webhook came from Shopify
function verifyWebhook(body: string, hmacHeader: string): boolean {
  const digest = createHmac('sha256', process.env.SHOPIFY_CLIENT_SECRET!)
    .update(body, 'utf8')
    .digest('base64')
  return digest === hmacHeader
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const hmac = req.headers.get('x-shopify-hmac-sha256') ?? ''

  if (!verifyWebhook(body, hmac)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const order = JSON.parse(body)
    const admin = createAdminClient()
    const trentEmail = process.env.TRENT_EMAIL?.toLowerCase()

    // Fetch all push tokens from profiles
    const { data: profiles } = await (admin as any)
      .from('profiles')
      .select('push_token, shopify_collection_title')
      .not('push_token', 'is', null) as { data: Array<{ push_token: string | null; shopify_collection_title: string | null }> | null }

    if (!profiles || profiles.length === 0) return new NextResponse('OK')

    // Get Trent's push token
    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 500 })
    const trentUser = users.find(u => u.email?.toLowerCase() === trentEmail)
    const trentProfile = profiles.find(p => {
      // Match by cross-referencing users list (Trent has no collection title)
      return !p.shopify_collection_title
    })

    const total = parseFloat(order.total_price || '0').toFixed(2)
    const itemCount = order.line_items?.length ?? 0
    const customerName = order.billing_address?.first_name ?? order.email ?? 'Someone'

    // Notify Trent of every new order
    if (trentProfile?.push_token) {
      await sendPushToUser(
        trentProfile.push_token,
        `New Order — $${total}`,
        `${customerName} ordered ${itemCount} item${itemCount !== 1 ? 's' : ''}`,
        { orderId: order.id, screen: 'orders' }
      )
    }

    // Notify the relevant group if the order contains their products
    // (match by collection title in line item properties — set during checkout)
    const lineItemCollections = new Set<string>(
      (order.line_items ?? [])
        .flatMap((item: any) => item.properties ?? [])
        .filter((p: any) => p.name === '_collection')
        .map((p: any) => p.value as string)
    )

    if (lineItemCollections.size > 0) {
      const groupTokens = profiles
        .filter(p => p.push_token && p.shopify_collection_title && lineItemCollections.has(p.shopify_collection_title))
        .map(p => p.push_token!)

      if (groupTokens.length > 0) {
        await sendPushToMany(
          groupTokens,
          'New Sale!',
          `${customerName} just bought from your collection — $${total}`,
          { orderId: order.id, screen: 'report' }
        )
      }
    }

    // Create a Printful draft order for any CQS-designed products in this order.
    // Only acts on line items whose Shopify product ID matches a design in Supabase
    // with a stored shopify_variant_to_printful map. All other line items (pre-existing
    // Printful-connected products) are auto-fulfilled by Printful's Shopify integration.
    await createPrintfulDraftOrder(order, admin).catch((err: any) => {
      console.error('Printful draft order failed:', err?.message)
    })
  } catch (e: any) {
    console.error('Order webhook error:', e.message)
  }

  return new NextResponse('OK')
}

async function createPrintfulDraftOrder(order: any, admin: ReturnType<typeof createAdminClient>) {
  const shipping = order.shipping_address ?? order.billing_address
  if (!shipping) return

  // Collect all CQS line items that have a stored variant map
  const cqsItems: Array<{
    design: any
    pfVariantId: number
    quantity: number
    price: string
  }> = []

  for (const lineItem of (order.line_items ?? [])) {
    if (!lineItem.product_id || !lineItem.variant_id) continue

    const { data: design } = await (admin as any)
      .from('designs')
      .select('id, product_id, placement, transform, logo_path, shopify_variant_to_printful')
      .eq('shopify_product_id', lineItem.product_id)
      .not('shopify_variant_to_printful', 'is', null)
      .maybeSingle()

    if (!design?.shopify_variant_to_printful) continue

    const pfVariantId = design.shopify_variant_to_printful[String(lineItem.variant_id)]
    if (!pfVariantId) continue

    cqsItems.push({
      design,
      pfVariantId,
      quantity: lineItem.quantity ?? 1,
      price: lineItem.price ?? '35.00',
    })
  }

  if (cqsItems.length === 0) return

  const pfClient = getPrintfulClient()

  // Upload logos to Printful file library (deduplicated by logo_path)
  const logoUrlCache = new Map<string, string>()
  async function getLogoUrl(logoPath: string): Promise<string | null> {
    if (logoUrlCache.has(logoPath)) return logoUrlCache.get(logoPath)!
    const { data: signed } = await (admin as any).storage
      .from('cqs-assets')
      .createSignedUrl(logoPath, 600)
    if (!signed?.signedUrl) return null
    const res = await fetch(signed.signedUrl)
    const buf = Buffer.from(await res.arrayBuffer())
    const pfFile = await pfClient.uploadFile(buf, 'logo.png')
    logoUrlCache.set(logoPath, pfFile.url)
    return pfFile.url
  }

  // Build Printful order items
  const orderItems: Array<{
    variantId: number
    quantity: number
    retailPrice: string
    files: Array<{ placement: string; url: string; position: any }>
  }> = []

  for (const { design, pfVariantId, quantity, price } of cqsItems) {
    const logoUrl = await getLogoUrl(design.logo_path)
    if (!logoUrl) continue

    const printfiles = await pfClient.getPrintfiles(design.product_id)
    const area = getPrintAreaForPlacement(printfiles, design.placement, [pfVariantId])
      ?? { width: 1800, height: 1800 }
    const position = transformToPosition(design.transform, area)

    orderItems.push({
      variantId: pfVariantId,
      quantity,
      retailPrice: price,
      files: [{ placement: design.placement, url: logoUrl, position }],
    })
  }

  if (orderItems.length === 0) return

  const name = [
    shipping.first_name,
    shipping.last_name,
  ].filter(Boolean).join(' ') || shipping.name || 'Customer'

  // POST /orders — does NOT call /confirm, so it stays as a draft in Printful
  // for manual review before production. Switch to auto-confirm later by calling
  // pfClient.confirmOrder(result.id) immediately after this.
  await pfClient.createDraftOrder({
    externalId: String(order.id),
    recipient: {
      name,
      address1: shipping.address1,
      address2: shipping.address2 || undefined,
      city: shipping.city,
      state_code: shipping.province_code,
      country_code: shipping.country_code,
      zip: shipping.zip,
      email: order.email || undefined,
      phone: shipping.phone || undefined,
    },
    items: orderItems,
  })
}
