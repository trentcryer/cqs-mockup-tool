import { NextRequest, NextResponse } from 'next/server'
import { PROMO_TEMPLATES, type PromoProduct } from '@/lib/promo/templates'
import { PROMO_PLATFORMS } from '@/lib/promo/platforms'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const groupName = searchParams.get('groupName') || 'Your Group'
  const productsRaw = searchParams.get('products')

  let products: PromoProduct[] = []
  if (productsRaw) {
    try {
      products = JSON.parse(productsRaw)
    } catch {
      return NextResponse.json({ error: 'Invalid products param' }, { status: 400 })
    }
  }

  const templates = PROMO_TEMPLATES.map(t => ({
    id: t.id,
    label: t.label,
    description: t.description,
    caption: t.caption(groupName, products),
  }))

  return NextResponse.json({ templates, platforms: PROMO_PLATFORMS })
}
