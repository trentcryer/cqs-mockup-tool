import { NextRequest, NextResponse } from 'next/server'
import { isAdminUser } from '@/lib/api-auth'
import { getPrintfulClient } from '@/lib/printful'

export async function GET(req: NextRequest) {
  if (!await isAdminUser(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const productId = parseInt(req.nextUrl.searchParams.get('productId') || '')
  const variantIds = (req.nextUrl.searchParams.get('variantIds') || '')
    .split(',').map(Number).filter(Boolean)

  if (!productId) {
    return NextResponse.json({ error: 'Missing productId' }, { status: 400 })
  }

  try {
    const client = getPrintfulClient()
    const raw = await client.getProduct(productId) as any
    const allVariants: any[] = raw.variants ?? []

    // Use loose number comparison to handle string/number ID mismatch from Printful
    const matched = variantIds.length > 0
      ? allVariants.filter((v: any) => variantIds.includes(Number(v.id)))
      : []

    // If no variants matched the filter (or no filter provided), fall back to all variants
    const source = matched.length > 0 ? matched : allVariants

    const variants = source.map((v: any) => ({
      variantId: Number(v.id),
      name: v.name || '',
      size: v.size || null,
      color: v.color || null,
      printfulCost: parseFloat(v.price || '0'),
    })).filter((v: any) => v.printfulCost > 0) // drop $0 variants (unavailable)

    return NextResponse.json({ variants, fallback: matched.length === 0 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
