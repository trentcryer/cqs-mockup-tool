import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { getPrintfulClient } from '@/lib/printful'

async function fetchColorImages(productId: number) {
  const data = await getPrintfulClient().getProduct(productId) as any
  const variants: any[] = data.variants ?? []
  const seen = new Set<string>()
  const colors: Array<{ name: string; code: string; image: string }> = []
  for (const v of variants) {
    const color = v.color || 'Default'
    if (!seen.has(color) && v.image) {
      seen.add(color)
      colors.push({ name: color, code: v.color_code || '#ccc', image: v.image })
    }
  }
  return colors
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const productId = parseInt(id)
  if (isNaN(productId)) return NextResponse.json({ colors: [] })

  try {
    const colors = await unstable_cache(
      () => fetchColorImages(productId),
      [`product-colors-${productId}`],
      { revalidate: 3600 }
    )()
    return NextResponse.json({ colors })
  } catch {
    return NextResponse.json({ colors: [] })
  }
}
