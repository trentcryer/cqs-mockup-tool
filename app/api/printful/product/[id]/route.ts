import { NextRequest, NextResponse } from 'next/server'
import { getPrintfulClient } from '@/lib/printful'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const client = getPrintfulClient()

    // Printful v1 returns { product: {id, title, ...}, variants: [...] } at the result level.
    // The client returns data.result directly, so we must unwrap the nested .product object.
    const raw = await client.getProduct(parseInt(id)) as any
    const productInfo = raw.product ?? raw      // v1: nested; fallback for flat structures
    const variantsList: any[] = raw.variants ?? []

    const printfiles = await client.getPrintfiles(parseInt(id))

    // Group variants by color (like the legacy Streamlit)
    const colorMap: Record<string, number[]> = {}
    for (const v of variantsList) {
      const color = v.color || 'Default'
      if (!colorMap[color]) colorMap[color] = []
      colorMap[color].push(v.id)
    }

    // Build nice placement list
    const placements = Object.entries(printfiles.available_placements || {}).map(([key, label]) => ({
      key,
      label: String(label),
    }))

    return NextResponse.json({
      product: {
        id: productInfo.id,
        title: productInfo.title,
        variants: variantsList.slice(0, 8), // small sample for preview images
      },
      colorMap,
      placements,
      printfiles,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Printful error' }, { status: 500 })
  }
}
