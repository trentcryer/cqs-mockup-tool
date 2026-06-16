import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { getPrintfulClient, cleanDescription } from '@/lib/printful'
import { FAVORITE_PRODUCT_IDS } from '@/lib/favorites'
import fs from 'fs'
import path from 'path'

const DISK_CACHE_FILE = path.join('/tmp', 'cqs-catalog-v3.json')
const DISK_CACHE_TTL  = 6 * 60 * 60 * 1000 // 6 hours

function readDiskCache(): any[] | null {
  try {
    const raw = fs.readFileSync(DISK_CACHE_FILE, 'utf-8')
    const { products, ts } = JSON.parse(raw)
    if (Date.now() - ts < DISK_CACHE_TTL) return products
  } catch {}
  return null
}

function writeDiskCache(products: any[]) {
  try { fs.writeFileSync(DISK_CACHE_FILE, JSON.stringify({ products, ts: Date.now() })) } catch {}
}

function detectPrintMethod(title: string): 'embroidery' | 'aop' | 'standard' {
  if (/embroidery/i.test(title))   return 'embroidery'
  if (/all[\s-]over/i.test(title)) return 'aop'
  return 'standard'
}

interface ProductDetails { description: string; colors: Array<{ name: string; value: string }> }

async function detailsFromV1(id: number, apiKey: string): Promise<ProductDetails> {
  try {
    const res = await fetch(`https://api.printful.com/products/${id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return { description: '', colors: [] }
    const d = await res.json()
    const description = cleanDescription(d.result?.product?.description || '')
    const variants: any[] = d.result?.variants || []
    const seen = new Set<string>()
    const colors: Array<{ name: string; value: string }> = []
    for (const v of variants) {
      if (v.color && !seen.has(v.color)) {
        seen.add(v.color)
        colors.push({ name: v.color, value: v.color_code || '#ccc' })
      }
    }
    return { description, colors }
  } catch {
    return { description: '', colors: [] }
  }
}

async function fetchProductDetails(productIds: number[]): Promise<Map<number, ProductDetails>> {
  const map = new Map<number, ProductDetails>()
  const apiKey = process.env.PRINTFUL_API_KEY!

  // Pass 1: v2 API for description + colors — all concurrently
  await Promise.allSettled(productIds.map(async id => {
    try {
      const res = await fetch(`https://api.printful.com/v2/catalog-products/${id}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) {
        const d = await res.json()
        map.set(id, {
          description: cleanDescription(d.data?.description || ''),
          colors: d.data?.colors || [],
        })
      }
    } catch {}
  }))

  // Pass 2: v1 fallback only for products still missing both fields — all concurrently
  const needsV1 = productIds.filter(id => !map.get(id)?.colors?.length && !map.get(id)?.description)
  await Promise.allSettled(needsV1.map(async id => {
    const v1 = await detailsFromV1(id, apiKey)
    const existing = map.get(id)
    map.set(id, {
      description: existing?.description || v1.description,
      colors: existing?.colors?.length ? existing.colors : v1.colors,
    })
  }))

  return map
}

const getCachedCatalog = unstable_cache(
  async () => {
    // Disk cache survives dev-server restarts (unlike unstable_cache which is in-memory only)
    const disk = readDiskCache()
    if (disk) return disk

    const products = await getPrintfulClient().getProducts()
    const ids = (products as any[]).map((p: any) => p.id)
    const details = await fetchProductDetails(ids)
    const favSet = new Set(FAVORITE_PRODUCT_IDS)
    const result = (products as any[]).map((p: any) => ({
      ...p,
      printMethod: detectPrintMethod(p.title || ''),
      description: details.get(p.id)?.description || '',
      colors: details.get(p.id)?.colors || [],
      favorite: favSet.has(p.id),
    }))

    writeDiskCache(result)
    return result
  },
  ['printful-catalog'],
  { revalidate: 3600 }
)

export async function GET() {
  try {
    const products = await getCachedCatalog()
    return NextResponse.json({ products })
  } catch (e: any) {
    console.error('Printful catalog API error', e)
    return NextResponse.json({ products: [], error: 'Failed to load catalog' }, { status: 500 })
  }
}
