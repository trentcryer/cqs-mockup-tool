'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw } from 'lucide-react'

interface PrintfulProduct {
  id: number
  title: string
  image?: string
}

export default function CatalogPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [q, setQ] = useState('')
  const [products, setProducts] = useState<PrintfulProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Handle search param (client-side)
  useEffect(() => {
    searchParams.then(params => {
      setQ(params.q || '')
    })
  }, [searchParams])

  // Fetch catalog client-side so we can show spinners/skeletons immediately
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch('/api/printful/catalog')  // We will create this thin proxy if it doesn't exist
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load catalog')
        const data = await res.json()
        if (!cancelled) {
          setProducts(data.products || [])
        }
      })
      .catch((e) => {
        if (!cancelled) {
          console.error('Catalog fetch error', e)
          setError('Could not load the Printful catalog right now. Please try again in a moment.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  const filtered = q
    ? products.filter(p => p.title.toLowerCase().includes(q.toLowerCase()))
    : products

  const apparel = filtered.filter(p => /shirt|hoodie|tank|crew|sweat|jacket/i.test(p.title))
  const other = filtered.filter(p => !apparel.includes(p))

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/studio" className="text-sm flex items-center gap-1 text-[#6b5f54] hover:text-[#1c1412]"><ArrowLeft size={16} /> Back to Studio</Link>
        <h1 className="text-3xl font-semibold tracking-tight">Printful Catalog</h1>
      </div>

      <form className="mb-6" onSubmit={(e) => e.preventDefault()}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products (T-Shirt, Hoodie, Mug...)"
          className="w-full max-w-md border border-[#d4c5b0] rounded-xl px-5 py-3 text-lg focus:border-[#b8892a]"
        />
      </form>

      {loading && (
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-[#6b5f54] mb-4">
            <RefreshCw className="animate-spin" size={16} /> Loading the full Printful catalog…
          </div>
          {/* Skeleton grids so it feels responsive immediately */}
          <div className="mb-4 text-xs uppercase tracking-widest text-[#9b1c1c]">Apparel &amp; Popular</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-10">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card p-4">
                <div className="h-40 bg-[#f0e9dc] rounded mb-3 animate-pulse" />
                <div className="h-4 bg-[#f0e9dc] rounded w-3/4 mb-1 animate-pulse" />
                <div className="h-3 bg-[#f0e9dc] rounded w-1/4 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="card p-6 text-center mb-8 text-[#9b1c1c]">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="mb-4 text-xs uppercase tracking-widest text-[#9b1c1c]">Apparel &amp; Popular</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-10">
            {apparel.slice(0, 24).map(p => (
              <Link key={p.id} href={`/studio/editor?productId=${p.id}`} className="card p-4 hover:border-[#b8892a] group">
                <div className="h-40 bg-[#f9f6f0] rounded mb-3 overflow-hidden flex items-center justify-center">
                  {p.image ? <img src={p.image} alt="" className="max-h-full" /> : <div className="text-[#b8892a] text-xs">PREVIEW</div>}
                </div>
                <div className="font-medium group-hover:text-[#9b1c1c] line-clamp-2">{p.title}</div>
                <div className="text-xs text-[#8a7660] mt-0.5">ID: {p.id}</div>
              </Link>
            ))}
            {apparel.length === 0 && <div className="col-span-full text-sm text-[#6b5f54]">No matching apparel found.</div>}
          </div>

          <div className="mb-4 text-xs uppercase tracking-widest text-[#9b1c1c]">All Other Products</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 text-sm">
            {other.slice(0, 60).map(p => (
              <Link key={p.id} href={`/studio/editor?productId=${p.id}`} className="card px-4 py-3 hover:border-[#b8892a] flex items-center justify-between gap-3">
                <span className="truncate">{p.title}</span>
                <span className="text-[10px] text-[#b8892a] shrink-0">#{p.id}</span>
              </Link>
            ))}
            {other.length === 0 && <div className="col-span-full text-sm text-[#6b5f54]">No other matching products.</div>}
          </div>

          <p className="text-center text-xs text-[#8a7660] mt-10">Catalog data from Printful • Updated hourly • 490+ products available</p>
        </>
      )}
    </div>
  )
}
