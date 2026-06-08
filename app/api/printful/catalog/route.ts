import { NextResponse } from 'next/server'
import { getPrintfulClient } from '@/lib/printful'

export const revalidate = 3600

function getPrintMethod(placements: Record<string, string>): 'embroidery' | 'dtf' | 'standard' {
  const keys = Object.keys(placements || {})
  if (keys.some(k => k.includes('embroidery'))) return 'embroidery'
  if (keys.some(k => k.includes('dtf'))) return 'dtf'
  return 'standard'
}

export async function GET() {
  try {
    const client = getPrintfulClient()
    const products = await client.getProducts()

    // Fetch printfiles for all products in parallel to determine print method
    const printMethods = await Promise.all(
      products.map(async (p: any) => {
        try {
          const pf = await client.getPrintfiles(p.id)
          return [p.id, getPrintMethod((pf as any).available_placements || {})] as const
        } catch {
          return [p.id, 'standard'] as const
        }
      })
    )
    const methodMap = Object.fromEntries(printMethods)

    return NextResponse.json({
      products: products.map((p: any) => ({ ...p, printMethod: methodMap[p.id] || 'standard' })),
    })
  } catch (e: any) {
    console.error('Printful catalog API error', e)
    return NextResponse.json({ products: [], error: 'Failed to load catalog' }, { status: 500 })
  }
}
