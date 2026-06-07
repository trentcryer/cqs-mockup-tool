import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPrintfulClient } from '@/lib/printful'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const trentEmail = process.env.TRENT_EMAIL?.toLowerCase()
  if (!user || !trentEmail || user.email?.toLowerCase() !== trentEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const productId = parseInt(req.nextUrl.searchParams.get('productId') || '')
  const variantIds = (req.nextUrl.searchParams.get('variantIds') || '')
    .split(',').map(Number).filter(Boolean)

  if (!productId || !variantIds.length) {
    return NextResponse.json({ error: 'Missing productId or variantIds' }, { status: 400 })
  }

  try {
    const client = getPrintfulClient()
    const raw = await client.getProduct(productId) as any
    const allVariants: any[] = raw.variants ?? []

    const filtered = allVariants
      .filter((v: any) => variantIds.includes(v.id))
      .map((v: any) => ({
        variantId: v.id,
        name: v.name,
        size: v.size || null,
        color: v.color || null,
        printfulCost: parseFloat(v.price || '0'),
      }))

    return NextResponse.json({ variants: filtered })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
