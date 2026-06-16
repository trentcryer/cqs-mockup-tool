import type { Metadata } from 'next'
import { decodePromoData } from '@/lib/promo/encode'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

interface PageProps {
  searchParams: Promise<{ data?: string; shop?: string; caption?: string }>
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { data, caption } = await searchParams
  if (!data) return { title: 'Custom Quartet Stuff' }

  const promo = decodePromoData(data)
  const imageUrl = `${SITE_URL}/api/promo/image?${new URLSearchParams({ data }).toString()}`
  const description = caption || `Shop ${promo.groupName} merch at Custom Quartet Stuff.`

  return {
    title: `${promo.groupName} — Custom Quartet Stuff`,
    description,
    openGraph: {
      title: `${promo.groupName} — Custom Quartet Stuff`,
      description,
      images: [{ url: imageUrl, width: 1200, height: 1200 }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${promo.groupName} — Custom Quartet Stuff`,
      description,
      images: [imageUrl],
    },
  }
}

export default async function PromoViewPage({ searchParams }: PageProps) {
  const { data, shop, caption } = await searchParams
  if (!data) {
    return <div className="max-w-xl mx-auto px-6 py-16 text-center text-[#6b5f54]">This promo link is missing data.</div>
  }

  const promo = decodePromoData(data)
  const imageUrl = `/api/promo/image?${new URLSearchParams({ data }).toString()}`
  const shopUrl = shop || 'https://www.customquartetstuff.com'

  return (
    <div className="max-w-xl mx-auto px-6 py-12 flex flex-col items-center gap-6 text-center">
      <img src={imageUrl} alt={promo.groupName} className="w-full rounded-2xl shadow-lg" />
      {caption && <p className="text-[#1c1412] text-lg">{caption}</p>}
      <a
        href={shopUrl}
        className="btn-primary px-8 py-3 rounded-xl text-sm inline-block"
      >
        Shop Now →
      </a>
      <p className="text-xs text-[#9b9186]">Custom Quartet Stuff</p>
    </div>
  )
}
