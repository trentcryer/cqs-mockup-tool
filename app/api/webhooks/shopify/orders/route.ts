import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { sendPushToUser, sendPushToMany } from '@/lib/push'

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
  } catch (e: any) {
    console.error('Order webhook error:', e.message)
  }

  return new NextResponse('OK')
}
