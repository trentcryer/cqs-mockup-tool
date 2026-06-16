import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { getPrintfulClient, cleanDescription } from '@/lib/printful'

async function fetchDetails(productId: number) {
  const client = getPrintfulClient()

  const [rawResult, v2Result] = await Promise.allSettled([
    client.getProduct(productId) as Promise<any>,
    client.getProductV2Info(productId),
  ])

  if (rawResult.status === 'rejected') throw rawResult.reason

  const raw = rawResult.value as any
  const productInfo = raw.product ?? raw
  const v2 = v2Result.status === 'fulfilled' ? v2Result.value : null

  const descriptionLines = cleanDescription(v2?.description || '').split('\n').map((l: string) => l.trim()).filter(Boolean)
  const introParagraphs: string[] = []
  const bullets: string[] = []
  let seenBullet = false
  for (const line of descriptionLines) {
    if (line.startsWith('•')) {
      seenBullet = true
      bullets.push(line.slice(1).trim())
    } else if (!seenBullet) {
      introParagraphs.push(line)
    }
  }

  return {
    id: productInfo.id,
    title: productInfo.title,
    introParagraphs,
    bullets,
    sizes: v2?.sizes || [],
    sizeTables: v2?.sizeTables || [],
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const productId = parseInt(id)
  if (isNaN(productId)) return NextResponse.json({ error: 'Invalid product id' }, { status: 400 })

  try {
    const details = await unstable_cache(
      () => fetchDetails(productId),
      [`product-details-${productId}`],
      { revalidate: 3600 }
    )()
    return NextResponse.json(details)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Printful error' }, { status: 500 })
  }
}
