import { NextResponse } from 'next/server'
import { getPrintfulClient } from '@/lib/printful'

export const revalidate = 3600 // cache for 1 hour like the old page

export async function GET() {
  try {
    const client = getPrintfulClient()
    const products = await client.getProducts()
    return NextResponse.json({ products })
  } catch (e: any) {
    console.error('Printful catalog API error', e)
    return NextResponse.json({ products: [], error: 'Failed to load catalog' }, { status: 500 })
  }
}
