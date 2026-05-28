import { NextRequest, NextResponse } from 'next/server'
import { getPrintfulClient } from '@/lib/printful'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const client = getPrintfulClient()

    const product = await client.getProduct(parseInt(id))
    const printfiles = await client.getPrintfiles(parseInt(id))

    // Group variants by color (like the legacy Streamlit)
    const colorMap: Record<string, number[]> = {}
    for (const v of product.variants || []) {
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
        id: product.id,
        title: product.title,
        variants: product.variants?.slice(0, 8) || [], // small sample for preview images
      },
      colorMap,
      placements,
      printfiles, // full data available to client if needed
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Printful error' }, { status: 500 })
  }
}
