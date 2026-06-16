'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { RefreshCw, Search, Grid3X3, List, X, ChevronRight, Info, Star } from 'lucide-react'

interface ColorOption { name: string; value: string }

interface PrintfulProduct {
  id: number
  title: string
  image?: string
  printMethod?: 'embroidery' | 'aop' | 'standard'
  description?: string
  colors?: ColorOption[]
  favorite?: boolean
}

type SortKey = 'default' | 'az' | 'za'
type ViewMode = 'grid' | 'list'

// image: local override (drop a file in /public/catalog-tabs/ to replace the default)
// defaultImage: Printful ghost mockup shown until a custom photo is added
const CATEGORIES = [
  { key: 'favorites',   label: 'Favorites',      gradient: 'from-[#1c1412] to-[#3a2010]',  image: '/catalog-tabs/favorites.jpg',   defaultImage: 'https://files.cdn.printful.com/o/upload/product-catalog-img/6d/6d7501c1e4b984392a258054bf0cd145_l' },
  { key: 'all',         label: 'All Products',   gradient: 'from-[#1c1412] to-[#4a3020]',  image: '/catalog-tabs/all.jpg',         defaultImage: 'https://files.cdn.printful.com/o/upload/product-catalog-img/20/2079a3ee4cc472ad952fe16654f274cd_l' },
  { key: 'tees',        label: 'T-Shirts',       gradient: 'from-[#7c3228] to-[#b84c3c]',  image: '/catalog-tabs/tees.jpg',        defaultImage: 'https://files.cdn.printful.com/o/upload/product-catalog-img/20/2079a3ee4cc472ad952fe16654f274cd_l',  test: /t-?shirt|tee\b/i },
  { key: 'polos',       label: 'Polos & Shirts', gradient: 'from-[#1e3a30] to-[#3a7060]',  image: '/catalog-tabs/polos.jpg',       defaultImage: 'https://files.cdn.printful.com/o/upload/product-catalog-img/23/23d7331453bc52729e632d586a377cba_l',  test: /polo/i },
  { key: 'hoodies',     label: 'Hoodies',        gradient: 'from-[#2a2050] to-[#5a4090]',  image: '/catalog-tabs/hoodies.jpg',     defaultImage: 'https://files.cdn.printful.com/o/upload/product-catalog-img/4f/4fdfa28ee11ae248d7c9ef7f0822ca2e_l',  test: /hoodie|sweatshirt|crewneck|crew neck/i },
  { key: 'performance', label: 'Performance',    gradient: 'from-[#0f2a48] to-[#1a5c9a]',  image: '/catalog-tabs/performance.jpg', defaultImage: 'https://files.cdn.printful.com/o/upload/product-catalog-img/f1/f198d6b652576ea41e0859db58e65db8_l',  test: /performance|sport|athletic|moisture|dri.?fit/i },
  { key: 'jackets',     label: 'Jackets',        gradient: 'from-[#282828] to-[#585858]',  image: '/catalog-tabs/jackets.jpg',     defaultImage: 'https://files.cdn.printful.com/o/upload/product-catalog-img/bd/bdf96753e23e29f386c667ad67d99946_l',  test: /jacket|vest|windbreaker|zip.?up/i },
  { key: 'hats',        label: 'Hats & Caps',    gradient: 'from-[#4a3800] to-[#9a7010]',  image: '/catalog-tabs/hats.jpg',        defaultImage: 'https://files.cdn.printful.com/o/products/206/product_1584101692.jpg',  test: /\bhat\b|\bcap\b|beanie/i },
  { key: 'accessories', label: 'Accessories',    gradient: 'from-[#3a2828] to-[#6a4848]',  image: '/catalog-tabs/accessories.jpg', defaultImage: 'https://files.cdn.printful.com/o/upload/product-catalog-img/fa/fa37e474f7c3d027440f63ab51ad7692_l',  test: /bag|tote|mug|bottle|apron|blanket|pillow|towel|case|cushion|face\s*mask/i },
  { key: 'aop',         label: 'All-Over Print', gradient: 'from-[#3a0a60] to-[#7a1a90]',  image: '/catalog-tabs/aop.jpg',         defaultImage: 'https://files.cdn.printful.com/o/upload/product-catalog-img/3b/3b70bb6ae954a015cfa8c46d8328d9e7_l',  test: /all.?over/i },
  { key: 'embroidery',  label: 'Embroidery',     gradient: 'from-[#5a3800] to-[#b87820]',  image: '/catalog-tabs/embroidery.jpg',  defaultImage: 'https://files.cdn.printful.com/o/upload/product-catalog-img/52/52dda392a73af8e9d253005b3698d571_l',  test: /embroidery/i },
]

const PRINT_METHODS = [
  { key: 'all',         label: 'All Methods',    dot: 'bg-[#d4c5b0]' },
  { key: 'standard',    label: 'Standard Print', dot: 'bg-blue-400' },
  { key: 'embroidery',  label: 'Embroidery',     dot: 'bg-amber-500' },
  { key: 'aop',         label: 'All-Over Print', dot: 'bg-purple-500' },
]

function matchesCategory(p: PrintfulProduct, key: string): boolean {
  if (key === 'favorites') return !!p.favorite
  const cat = CATEGORIES.find(c => c.key === key)
  if (!cat || key === 'all') return p.printMethod !== 'aop'
  if (!cat.test) return false
  if (key === 'aop')        return p.printMethod === 'aop' || cat.test.test(p.title)
  if (key === 'embroidery') return p.printMethod === 'embroidery' || cat.test.test(p.title)
  if (p.printMethod === 'aop') return false
  return cat.test.test(p.title)
}

function descriptionIntro(description: string): string {
  if (!description) return ''
  const firstLine = description.split('\n').find(l => l.trim() && !l.trim().startsWith('•'))
  return firstLine?.trim() || ''
}

function descriptionParts(description: string): { intro: string; bullets: string[] } {
  if (!description) return { intro: '', bullets: [] }
  const lines = description.split('\n').map(l => l.trim()).filter(Boolean)
  const introLines: string[] = []
  const bullets: string[] = []
  let seenBullet = false
  for (const line of lines) {
    if (line.startsWith('•')) { seenBullet = true; bullets.push(line.slice(1).trim()) }
    else if (!seenBullet) introLines.push(line)
  }
  return { intro: introLines.join(' '), bullets }
}

function PrintBadge({ method }: { method?: string }) {
  if (!method || method === 'standard') return null
  return (
    <span className="absolute top-3 left-3 z-10 text-[8px] font-bold uppercase tracking-[1.5px] px-2 py-0.5 bg-[#1c1412] text-white" style={{ borderRadius: 2 }}>
      {method === 'aop' ? 'All-Over' : 'Embroidery'}
    </span>
  )
}

function ProductCardGrid({ p, onExpand }: { p: PrintfulProduct; onExpand: () => void }) {
  const colors = p.colors || []
  const shown = colors.slice(0, 9)
  const extra = colors.length - shown.length

  return (
    <div className="group relative">
      <div className="relative bg-white overflow-hidden flex flex-col" style={{ borderRadius: 4, boxShadow: '0 2px 10px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)' }}>
        <PrintBadge method={p.printMethod} />

        {/* Image — 4:5 portrait, click to expand */}
        <div
          role="button"
          tabIndex={0}
          className="bg-[#f0ece6] overflow-hidden cursor-pointer relative"
          style={{ aspectRatio: '4/5' }}
          onClick={onExpand}
          onKeyDown={e => e.key === 'Enter' && onExpand()}
        >
          {p.image
            ? <img src={p.image} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            : <div className="w-full h-full flex items-center justify-center"><span className="text-[10px] text-[#c4b49f] tracking-[3px] uppercase">No Image</span></div>
          }
        </div>

        <div className="p-3 flex flex-col gap-1">
          <h3 className="text-[12px] font-medium text-[#1c1412] leading-snug line-clamp-2">{p.title}</h3>
          {shown.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {shown.map(c => (
                <span key={c.name} title={c.name} className="w-3 h-3 rounded-full border border-[#d4c5b0] shrink-0" style={{ backgroundColor: c.value }} />
              ))}
              {extra > 0 && <span className="text-[9px] text-[#9b8c7a]">+{extra}</span>}
            </div>
          )}
        </div>

        {/* Slide-up action on hover */}
        <div className="absolute inset-x-0 bottom-0 px-3 pb-3 pt-10 bg-gradient-to-t from-white via-white/95 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-250 pointer-events-none group-hover:pointer-events-auto">
          <div className="flex gap-1.5">
            <Link href={`/studio/catalog/${p.id}`} className="flex-1 border border-[#e8e0d8] text-[#4a3f35] text-center py-1.5 text-[10px] font-medium hover:border-[#1c1412] transition-colors flex items-center justify-center gap-1" style={{ borderRadius: 3 }}>
              <Info size={10} /> Details
            </Link>
            <Link href={`/studio/editor?productId=${p.id}`} className="flex-1 bg-[#1c1412] text-white text-center py-1.5 text-[10px] font-semibold flex items-center justify-center gap-1" style={{ borderRadius: 3 }}>
              Design <ChevronRight size={10} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProductExpandPopup({ p, onClose }: { p: PrintfulProduct; onClose: () => void }) {
  const { intro, bullets } = descriptionParts(p.description || '')
  const catalogColors = p.colors || []

  const defaultImage = p.image || ''
  const [activeImage, setActiveImage] = useState(defaultImage)
  const [activeColor, setActiveColor] = useState<string | null>(null)
  const [colorImages, setColorImages] = useState<Array<{ name: string; code: string; image: string }>>([])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    fetch(`/api/printful/product/${p.id}/colors`)
      .then(r => r.json())
      .then(d => setColorImages(d.colors || []))
      .catch(() => {})
  }, [p.id])

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-[800px] max-w-[95vw] bg-white shadow-[0_32px_80px_rgba(0,0,0,0.3)] overflow-hidden flex z-10"
        style={{ borderRadius: 4 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 text-[#9b8c7a] hover:text-[#1c1412] bg-white/90 p-1.5 shadow-sm transition"
          style={{ borderRadius: 2 }}
        >
          <X size={15} />
        </button>

        {/* Left: portrait image */}
        <div className="w-[380px] shrink-0 bg-[#f0ece6] flex items-center justify-center relative">
          <PrintBadge method={p.printMethod} />
          {activeImage
            ? <img key={activeImage} src={activeImage} alt={activeColor ?? p.title} className="w-full h-full object-cover" style={{ aspectRatio: '4/5' }} />
            : <span className="text-[10px] text-[#c4b49f] tracking-[3px] uppercase">No Image</span>
          }
        </div>

        {/* Right: details */}
        <div className="flex-1 flex flex-col p-7 min-h-0">
          <div className="mb-4 pr-6">
            <p className="text-[9px] uppercase tracking-[2px] text-[#9b8c7a] font-bold mb-1">Printful Blank</p>
            <h3 className="text-xl font-bold text-[#1c1412] leading-snug tracking-tight">{p.title}</h3>
            {activeColor && <p className="text-[12px] text-[#9b8c7a] mt-1">{activeColor}</p>}
          </div>

          <div className="flex-1 overflow-y-auto space-y-4">
            {intro && <p className="text-[13px] text-[#4a3f35] leading-relaxed">{intro}</p>}
            {bullets.length > 0 && (
              <ul className="space-y-2">
                {bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[13px] text-[#4a3f35]">
                    <span className="mt-2 w-1 h-1 rounded-full bg-[#9b8c7a] shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            )}

            {(colorImages.length > 0 || catalogColors.length > 0) && (
              <div>
                <p className="text-[9px] uppercase tracking-[2px] text-[#9b8c7a] font-bold mb-2.5">
                  Colors ({colorImages.length || catalogColors.length})
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {colorImages.length > 0
                    ? colorImages.map(c => (
                        <button
                          key={c.name}
                          title={c.name}
                          onClick={() => { setActiveImage(c.image); setActiveColor(c.name) }}
                          className={`w-6 h-6 rounded-full border-2 transition-all duration-150 ${
                            activeColor === c.name ? 'border-[#1c1412] scale-110' : 'border-[#d4c5b0] hover:border-[#1c1412]'
                          }`}
                          style={{ backgroundColor: c.code }}
                        />
                      ))
                    : catalogColors.map(c => (
                        <span key={c.name} title={c.name} className="w-6 h-6 rounded-full border border-[#d4c5b0] shrink-0" style={{ backgroundColor: c.value }} />
                      ))
                  }
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 mt-5 pt-5 border-t border-[#f0ece6] shrink-0">
            <Link
              href={`/studio/catalog/${p.id}`}
              className="flex-1 border border-[#e8e0d8] text-[#4a3f35] text-center py-3 text-[13px] font-medium hover:border-[#1c1412] transition-colors flex items-center justify-center gap-1.5"
              style={{ borderRadius: 3 }}
            >
              <Info size={13} /> Full Details
            </Link>
            <Link
              href={`/studio/editor?productId=${p.id}`}
              className="flex-1 bg-[#1c1412] text-white text-center py-3 text-[13px] font-semibold flex items-center justify-center gap-1.5"
              style={{ borderRadius: 3 }}
            >
              Design This <ChevronRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProductCardList({ p }: { p: PrintfulProduct }) {
  const intro = descriptionIntro(p.description || '')
  const colors = p.colors || []
  return (
    <div className="group flex items-center gap-4 bg-white px-4 py-3.5 transition-shadow hover:shadow-md" style={{ borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <Link href={`/studio/catalog/${p.id}`} className="shrink-0">
        <div className="w-14 h-14 bg-[#f0ece6] flex items-center justify-center overflow-hidden" style={{ borderRadius: 4 }}>
          {p.image && <img src={p.image} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />}
        </div>
      </Link>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-[13px] text-[#1c1412] leading-snug truncate">{p.title}</h3>
        {intro && <p className="text-[11px] text-[#9b8c7a] mt-0.5 truncate">{intro}</p>}
        {colors.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-1.5">
            {colors.slice(0, 12).map(c => (
              <span key={c.name} title={c.name} className="w-3 h-3 rounded-full border border-[#d4c5b0] shrink-0" style={{ backgroundColor: c.value }} />
            ))}
            {colors.length > 12 && <span className="text-[9px] text-[#9b8c7a]">+{colors.length - 12}</span>}
          </div>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
        <Link href={`/studio/catalog/${p.id}`} className="border border-[#e8e0d8] text-[#4a3f35] px-3 py-1.5 text-[11px] font-medium hover:border-[#1c1412] transition-colors" style={{ borderRadius: 3 }}>
          Details
        </Link>
        <Link href={`/studio/editor?productId=${p.id}`} className="bg-[#1c1412] text-white px-3 py-1.5 text-[11px] font-semibold flex items-center gap-1" style={{ borderRadius: 3 }}>
          Design <ChevronRight size={11} />
        </Link>
      </div>
    </div>
  )
}

function SkeletonGrid() {
  return (
    <>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="bg-white overflow-hidden animate-pulse" style={{ borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div className="bg-[#f0ece6]" style={{ aspectRatio: '4/5' }} />
          <div className="p-3 space-y-2">
            <div className="h-3 bg-[#f0ece6] rounded w-3/4" />
            <div className="h-2.5 bg-[#f0ece6] rounded w-1/2" />
          </div>
        </div>
      ))}
    </>
  )
}

const PAGE_SIZE = 36

function CategoryTab({ cat, active, onClick, liveImage }: {
  cat: typeof CATEGORIES[number]
  active: boolean
  onClick: () => void
  liveImage?: string
}) {
  // Priority: live design mockup → local custom photo → Printful ghost → gradient
  const [liveFailed, setLiveFailed]       = useState(false)
  const [localFailed, setLocalFailed]     = useState(false)
  const [defaultFailed, setDefaultFailed] = useState(false)

  const src = (liveImage && !liveFailed)
    ? liveImage
    : (!localFailed ? cat.image : (!defaultFailed ? cat.defaultImage : null))
  const showImage = !!src

  function handleError() {
    if (liveImage && !liveFailed)       { setLiveFailed(true);    return }
    if (!localFailed)                   { setLocalFailed(true);   return }
    setDefaultFailed(true)
  }

  return (
    <button
      onClick={onClick}
      className={`relative w-full overflow-hidden transition-all duration-200 ${
        active
          ? 'ring-2 ring-[#1c1412] ring-offset-2'
          : 'hover:ring-2 hover:ring-[#1c1412]/40 hover:ring-offset-1'
      }`}
      style={{ borderRadius: 6, aspectRatio: '3/2' }}
    >
      {showImage ? (
        <img
          src={src!}
          alt={cat.label}
          onError={handleError}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          style={{ filter: active ? 'brightness(1.05) saturate(1.15)' : 'brightness(0.92) saturate(1.1)' }}
        />
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${cat.gradient}`} />
      )}
      {/* light scrim — just enough to read the label */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
      {cat.key === 'favorites' && (
        <Star size={13} className="absolute top-2 right-2 z-10 text-white/90 fill-white/50" />
      )}
      <span className="absolute bottom-0 inset-x-0 px-2 pb-2.5 text-white text-[11px] font-bold tracking-wide text-center leading-tight drop-shadow-md z-10">
        {cat.label}
      </span>
    </button>
  )
}

export default function CatalogPage() {
  const [q, setQ]                       = useState('')
  const [products, setProducts]         = useState<PrintfulProduct[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [activeCategory, setCategory]   = useState('favorites')
  const [printMethod, setPrintMethod]   = useState('standard')
  const [sort, setSort]                 = useState<SortKey>('default')
  const [view, setView]                 = useState<ViewMode>('grid')
  const [page, setPage]                 = useState(1)
  const [expandedId, setExpandedId]     = useState<number | null>(null)
  const [tabImages, setTabImages]       = useState<Record<string, string>>({})
  const expandedProduct = expandedId !== null ? products.find(p => p.id === expandedId) ?? null : null

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch('/api/printful/catalog')
      .then(async res => {
        if (!res.ok) throw new Error('Failed to load catalog')
        const data = await res.json()
        if (!cancelled) setProducts(data.products || [])
      })
      .catch(() => { if (!cancelled) setError('Could not load the product catalog. Please try again.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    fetch('/api/catalog/tab-images')
      .then(r => r.ok ? r.json() : {})
      .then(data => setTabImages(data))
      .catch(() => {})
  }, [])

  useEffect(() => { setPage(1) }, [q, activeCategory, printMethod, sort])

  const filtered = useMemo(() => {
    let r = products
    if (q)                      r = r.filter(p => p.title.toLowerCase().includes(q.toLowerCase()))
    if (activeCategory !== 'all') r = r.filter(p => matchesCategory(p, activeCategory))
    if (printMethod !== 'all')  r = r.filter(p => (p.printMethod || 'standard') === printMethod)
    if (sort === 'az')          r = [...r].sort((a, b) => a.title.localeCompare(b.title))
    if (sort === 'za')          r = [...r].sort((a, b) => b.title.localeCompare(a.title))
    return r
  }, [products, q, activeCategory, printMethod, sort])

  const visible = filtered.slice(0, page * PAGE_SIZE)
  const hasMore = visible.length < filtered.length
  const activeCatLabel = CATEGORIES.find(c => c.key === activeCategory)?.label || 'All Products'

  return (
    <div className="min-h-screen bg-[#f7f5f2]">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[11px] text-[#9b8c7a] mb-6 tracking-wide">
        <Link href="/studio" className="hover:text-[#1c1412] transition">My Studio</Link>
        <span>/</span>
        <span className="text-[#1c1412] font-medium">Product Catalog</span>
        {activeCategory !== 'all' && (
          <>
            <span>/</span>
            <span className="text-[#1c1412]">{activeCatLabel}</span>
          </>
        )}
      </div>

      {/* Page title + search */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <p className="eyebrow mb-2">Product Catalog</p>
          <h1 className="text-4xl font-bold tracking-tight text-[#1c1412] leading-none">Browse Blanks</h1>
          <p className="text-[13px] text-[#9b8c7a] mt-2">Select a style to begin customizing with your artwork</p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#c4b49f]" size={14} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search styles, fabrics, brands…"
            className="w-full pl-10 pr-10 py-3 bg-white border border-[#e8e0d8] text-[13px] focus:outline-none focus:border-[#1c1412] transition shadow-sm"
            style={{ borderRadius: 4 }}
          />
          {q && (
            <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#b8a898] hover:text-[#1c1412] transition">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Category tiles — 6 top, 5 bottom */}
      <div className="space-y-2 mb-8">
        <div className="grid grid-cols-6 gap-2">
          {CATEGORIES.slice(0, 6).map(cat => (
            <CategoryTab
              key={cat.key}
              cat={cat}
              active={activeCategory === cat.key}
              onClick={() => setCategory(cat.key)}
              liveImage={tabImages[cat.key]}
            />
          ))}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {CATEGORIES.slice(6).map(cat => (
            <CategoryTab
              key={cat.key}
              cat={cat}
              active={activeCategory === cat.key}
              onClick={() => setCategory(cat.key)}
              liveImage={tabImages[cat.key]}
            />
          ))}
        </div>
      </div>

      {/* Main layout */}
      <div className="flex gap-8 items-start">

        {/* Left sidebar */}
        <aside className="hidden lg:block w-48 shrink-0 space-y-7 sticky top-24">
          <div>
            <p className="eyebrow mb-3">Category</p>
            <div className="space-y-0.5">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  onClick={() => setCategory(cat.key)}
                  className={`w-full text-left px-3 py-2 text-[13px] transition-all ${
                    activeCategory === cat.key
                      ? 'bg-[#1c1412] text-white font-semibold'
                      : 'text-[#4a3f35] hover:bg-[#f0ece6]'
                  }`}
                  style={{ borderRadius: 3 }}
                >
                  <span className="flex items-center gap-1.5">
                    {cat.key === 'favorites' && <Star size={11} className={activeCategory === 'favorites' ? 'text-white/70 fill-white/50' : 'text-[#9b8c7a] fill-[#e8e0d8]'} />}
                    {cat.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-[#e8e0d8]" />

          <div>
            <p className="eyebrow mb-3">Print Method</p>
            <div className="space-y-0.5">
              {PRINT_METHODS.map(m => (
                <button
                  key={m.key}
                  onClick={() => setPrintMethod(m.key)}
                  className={`w-full text-left px-3 py-2 text-[13px] transition-all flex items-center gap-2.5 ${
                    printMethod === m.key
                      ? 'bg-[#1c1412] text-white font-semibold'
                      : 'text-[#4a3f35] hover:bg-[#f0ece6]'
                  }`}
                  style={{ borderRadius: 3 }}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${printMethod === m.key ? 'bg-white/70' : m.dot}`} />
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">

          {/* Controls bar */}
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm text-[#8a7660]">
              {loading ? 'Loading…' : (
                <><span className="font-semibold text-[#1c1412]">{filtered.length}</span> products</>
              )}
            </p>
            <div className="flex items-center gap-3">
              <select
                value={sort}
                onChange={e => setSort(e.target.value as SortKey)}
                className="text-[12px] border border-[#e8e0d8] px-3 py-2 bg-white text-[#4a3f35] focus:outline-none focus:border-[#1c1412] cursor-pointer" style={{ borderRadius: 3 }}
              >
                <option value="default">Best Match</option>
                <option value="az">Name A–Z</option>
                <option value="za">Name Z–A</option>
              </select>
              <div className="flex border border-[#e8e0d8] overflow-hidden bg-white" style={{ borderRadius: 3 }}>
                <button
                  onClick={() => setView('grid')}
                  className={`p-2 transition ${view === 'grid' ? 'bg-[#1c1412] text-white' : 'text-[#9b8c7a] hover:bg-[#f0ece6]'}`}
                >
                  <Grid3X3 size={14} />
                </button>
                <button
                  onClick={() => setView('list')}
                  className={`p-2 transition ${view === 'list' ? 'bg-[#1c1412] text-white' : 'text-[#9b8c7a] hover:bg-[#f0ece6]'}`}
                >
                  <List size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Active filters strip */}
          {(activeCategory !== 'all' || printMethod !== 'all' || q) && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {activeCategory !== 'all' && (
                <button onClick={() => setCategory('all')} className="flex items-center gap-1.5 text-[11px] bg-[#1c1412] text-white px-3 py-1.5 hover:opacity-80 transition" style={{ borderRadius: 2 }}>
                  {activeCatLabel} <X size={10} />
                </button>
              )}
              {printMethod !== 'all' && (
                <button onClick={() => setPrintMethod('all')} className="flex items-center gap-1.5 text-[11px] bg-[#1c1412] text-white px-3 py-1.5 hover:opacity-80 transition" style={{ borderRadius: 2 }}>
                  {PRINT_METHODS.find(m => m.key === printMethod)?.label} <X size={10} />
                </button>
              )}
              {q && (
                <button onClick={() => setQ('')} className="flex items-center gap-1.5 text-[11px] bg-[#1c1412] text-white px-3 py-1.5 hover:opacity-80 transition" style={{ borderRadius: 2 }}>
                  "{q}" <X size={10} />
                </button>
              )}
              <button
                onClick={() => { setCategory('all'); setPrintMethod('all'); setQ('') }}
                className="text-[11px] text-[#9b8c7a] hover:text-[#1c1412] transition underline underline-offset-2"
              >
                Clear all
              </button>
            </div>
          )}

          {error && (
            <div className="bg-white p-8 text-center {activeCatLabel}… text-sm mb-6" style={{ borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              {error}
            </div>
          )}

          {view === 'grid' ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {loading ? <SkeletonGrid /> : visible.map(p => <ProductCardGrid key={p.id} p={p} onExpand={() => setExpandedId(p.id)} />)}
              {!loading && visible.length === 0 && (
                <div className="col-span-full py-20 text-center text-[#9b8c7a] text-sm">
                  No products match your filters.
                  <button onClick={() => { setCategory('all'); setPrintMethod('all'); setQ('') }} className="block mx-auto mt-2 text-[#9b8c7a] underline underline-offset-2 text-[11px] hover:text-[#1c1412] transition">Clear filters</button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="bg-white h-20 animate-pulse" style={{ borderRadius: 4 }} />
                  ))
                : visible.map(p => <ProductCardList key={p.id} p={p} />)
              }
              {!loading && visible.length === 0 && (
                <div className="py-20 text-center text-[#9b8c7a] text-sm">No products match your filters.</div>
              )}
            </div>
          )}

          {!loading && hasMore && (
            <div className="text-center mt-10">
              <button
                onClick={() => setPage(p => p + 1)}
                className="px-10 py-3 bg-white border border-[#e8e0d8] text-[13px] font-medium text-[#4a3f35] hover:border-[#1c1412] hover:text-[#1c1412] transition-all"
                style={{ borderRadius: 3 }}
              >
                Load more · {filtered.length - visible.length} remaining
              </button>
            </div>
          )}
        </div>
      </div>

      {expandedProduct && (
        <ProductExpandPopup p={expandedProduct} onClose={() => setExpandedId(null)} />
      )}
    </div>
  )
}
