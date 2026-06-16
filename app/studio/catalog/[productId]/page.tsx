import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Ruler } from 'lucide-react'
import { getPrintfulClient, cleanDescription } from '@/lib/printful'
import ProductImagePicker from './ProductImagePicker'

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  const { productId } = await params
  const id = parseInt(productId)
  if (isNaN(id)) notFound()

  const client = getPrintfulClient()

  const [rawResult, v2Result] = await Promise.allSettled([
    client.getProduct(id) as Promise<any>,
    client.getProductV2Info(id),
  ])

  if (rawResult.status === 'rejected') notFound()

  const raw = rawResult.value as any
  const productInfo = raw.product ?? raw
  const variantsList: any[] = raw.variants ?? []
  const v2 = v2Result.status === 'fulfilled' ? v2Result.value : null

  // Build per-color image list for the picker (one image per unique color)
  const colorImages: { name: string; code: string; image: string }[] = []
  const seenColors = new Set<string>()
  for (const v of variantsList) {
    const color = v.color || 'Default'
    if (!seenColors.has(color) && v.image) {
      seenColors.add(color)
      colorImages.push({ name: color, code: v.color_code || '#ccc', image: v.image })
    }
  }

  // Parse description into intro paragraph + bullets
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

  // Pick the most useful size table (product measurements in inches)
  const sizeTable = v2?.sizeTables?.find((t: any) => t.type === 'product_measure' && t.unit === 'inches')
    ?? v2?.sizeTables?.[0]

  return (
    <div className="min-h-screen bg-[#f7f5f2]">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[11px] text-[#9b8c7a] mb-6 tracking-wide">
        <Link href="/studio" className="hover:text-[#1c1412] transition">My Studio</Link>
        <span>/</span>
        <Link href="/studio/catalog" className="hover:text-[#1c1412] transition">Product Catalog</Link>
        <span>/</span>
        <span className="text-[#1c1412] font-medium truncate max-w-[200px]">{productInfo.title}</span>
      </div>

      {/* Back button */}
      <Link
        href="/studio/catalog"
        className="inline-flex items-center gap-1.5 text-sm text-[#6b5f54] hover:text-[#1c1412] transition mb-6"
      >
        <ChevronLeft size={15} /> Back to Catalog
      </Link>

      <div className="grid lg:grid-cols-2 gap-10 items-start">

        {/* Left: image picker with color hover */}
        <ProductImagePicker
          defaultImage={productInfo.image || colorImages[0]?.image || ''}
          title={productInfo.title}
          colors={colorImages}
        />

        {/* Right: info panel */}
        <div className="space-y-7">

          {/* Title + meta */}
          <div>
            <p className="text-[10px] uppercase tracking-[3px] text-[#9b8c7a] font-semibold mb-2">Printful Blank</p>
            <h1 className="text-2xl font-semibold tracking-tight text-[#1c1412] leading-snug">{productInfo.title}</h1>
          </div>

          {/* Description */}
          {(introParagraphs.length > 0 || bullets.length > 0) && (
            <div className="space-y-3">
              {introParagraphs.map((p, i) => (
                <p key={i} className="text-sm text-[#4a3f35] leading-relaxed">{p}</p>
              ))}
              {bullets.length > 0 && (
                <ul className="space-y-1.5">
                  {bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[#4a3f35]">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#9b8c7a] shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Available sizes */}
          {v2?.sizes && v2.sizes.length > 0 && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[2px] text-[#9b8c7a] mb-2">Available Sizes</p>
              <div className="flex flex-wrap gap-1.5">
                {v2.sizes.map((size: string) => (
                  <span key={size} className="px-2.5 py-1 border border-[#d4c5b0] rounded-lg text-xs font-medium text-[#4a3f35] bg-white">
                    {size}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* CTAs */}
          <div className="flex gap-3 pt-2">
            <Link
              href="/studio/catalog"
              className="flex-1 border border-[#d4c5b0] text-[#4a3f35] text-center py-3.5 rounded-xl text-sm font-medium hover:border-[#1c1412] transition-colors flex items-center justify-center gap-1.5"
            >
              <ChevronLeft size={15} /> Back to Catalog
            </Link>
            <Link
              href={`/studio/editor?productId=${id}`}
              className="flex-1 bg-[#1c1412] text-white text-center py-3.5 text-sm font-semibold hover:opacity-85 transition-colors flex items-center justify-center gap-1.5"
            >
              Select This Blank <ChevronRight size={15} />
            </Link>
          </div>
        </div>
      </div>

      {/* Size guide table */}
      {sizeTable && sizeTable.measurements && sizeTable.measurements.length > 0 && (
        <div className="mt-12">
          <div className="flex items-center gap-2 mb-4">
            <Ruler size={15} className="text-[#9b8c7a]" />
            <h2 className="text-[10px] font-bold uppercase tracking-[2px] text-[#9b8c7a]">
              Size Guide · {sizeTable!.unit === 'inches' ? 'Inches' : 'cm'}
            </h2>
          </div>
          <div className="bg-white overflow-x-auto border border-[#e8e0d8]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#f0ebe3] bg-[#faf7f2]">
                  <th className="px-5 py-3 text-left text-[10px] uppercase tracking-widest text-[#8a7660] font-medium">Measurement</th>
                  {sizeTable!.measurements[0].values.map((v: any) => (
                    <th key={v.size} className="px-4 py-3 text-center text-[10px] uppercase tracking-widest text-[#8a7660] font-medium">{v.size}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0ebe3]">
                {sizeTable!.measurements.map((m: any) => (
                  <tr key={m.type_label} className="hover:bg-[#faf7f2] transition-colors">
                    <td className="px-5 py-3 font-medium text-[#1c1412]">{m.type_label}</td>
                    {m.values.map((v: any) => (
                      <td key={v.size} className="px-4 py-3 text-center text-[#6b5f54] tabular-nums">
                        {v.value ?? (v.min_value && v.max_value ? `${v.min_value}–${v.max_value}` : '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
