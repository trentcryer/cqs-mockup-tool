import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { getProduct } from '@/lib/shopify'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const productId = parseInt(id)
    if (isNaN(productId)) {
      return NextResponse.json({ error: 'Invalid product id' }, { status: 400 })
    }

    const getCached = unstable_cache(
      async () => {
        const raw = await getProduct(productId)
        const product = {
          id: raw.id,
          title: raw.title,
          body_html: raw.body_html ?? '',
          images: (raw.images ?? []).map((img: any) => ({ src: img.src })),
          variants: (raw.variants ?? []).map((v: any) => ({
            id: v.id,
            title: v.title,
            price: v.price,
            available: v.inventory_management === null || v.inventory_quantity > 0,
            option1: v.option1,
            option2: v.option2,
            option3: v.option3,
          })),
          options: raw.options ?? [],
        }
        return { product }
      },
      [`shop-product-${productId}`],
      { revalidate: 300 }
    )

    return NextResponse.json(await getCached())
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
