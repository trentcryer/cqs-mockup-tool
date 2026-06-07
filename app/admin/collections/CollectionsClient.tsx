'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, CheckSquare, Square, Trash2, Eye, EyeOff, X, Search, BarChart2 } from 'lucide-react'
import type { ShopifyCollection, ShopifyCollectionProduct } from '@/lib/shopify'
import SalesReport from './SalesReport'

interface Props {
  collections: ShopifyCollection[]
  collectionLogoUrls?: Record<number, string>
}

export default function CollectionsClient({ collections, collectionLogoUrls = {} }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselect = parseInt(searchParams.get('id') || '') || null

  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(preselect)
  const [products, setProducts] = useState<ShopifyCollectionProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [productError, setProductError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [actionPending, setActionPending] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [collectionSearch, setCollectionSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'products' | 'report'>('products')

  const filteredCollections = collectionSearch.trim()
    ? collections.filter(c => c.title.toLowerCase().includes(collectionSearch.toLowerCase()))
    : collections

  const selectedCollection = collections.find(c => c.id === selectedCollectionId)

  const loadProducts = useCallback(async (collectionId: number) => {
    setLoadingProducts(true)
    setProductError(null)
    setProducts([])
    setSelected(new Set())
    try {
      const col = collections.find(c => c.id === collectionId)
      const res = await fetch(`/api/admin/collection-manager?collectionId=${collectionId}&collectionType=${col?.type ?? 'custom'}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setProducts(data.products || [])
    } catch (e: any) {
      setProductError(e.message)
    } finally {
      setLoadingProducts(false)
    }
  }, [])

  useEffect(() => {
    if (selectedCollectionId) loadProducts(selectedCollectionId)
  }, [selectedCollectionId, loadProducts])

  function selectCollection(id: number) {
    setSelectedCollectionId(id)
    router.replace(`/admin/collections?id=${id}`, { scroll: false })
  }

  function toggleProduct(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(prev =>
      prev.size === products.length ? new Set() : new Set(products.map(p => p.id))
    )
  }

  async function runAction(action: 'live' | 'draft' | 'remove' | 'delete') {
    if (!selected.size) return
    setActionPending(true)
    setConfirmDelete(false)
    try {
      const selectedProducts = products.filter(p => selected.has(p.id))
      const productIds = selectedProducts.map(p => p.id)
      const collectIds = selectedProducts.map(p => p.collectId).filter(Boolean) as number[]

      const res = await fetch('/api/admin/collection-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, productIds, collectIds }),
      })
      if (!res.ok) throw new Error((await res.json()).error)

      // Refresh products
      await loadProducts(selectedCollectionId!)
    } catch (e: any) {
      alert('Action failed: ' + e.message)
    } finally {
      setActionPending(false)
    }
  }

  const liveCount = products.filter(p => p.status === 'active').length
  const draftCount = products.filter(p => p.status === 'draft').length

  return (
    <div className="flex gap-5 h-[calc(100vh-160px)]">

      {/* Sidebar */}
      <aside className="w-[28rem] shrink-0 bg-[#1c1412] rounded-xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-widest text-[#b8892a]">Collections</div>
            <div className="text-xs text-white/40">{filteredCollections.length}{collectionSearch.trim() ? ` of ${collections.length}` : ' total'}</div>
          </div>
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            <input
              type="text"
              value={collectionSearch}
              onChange={e => setCollectionSearch(e.target.value)}
              placeholder="Search…"
              className="w-full bg-white/10 text-white text-xs placeholder-white/30 rounded pl-7 pr-7 py-1.5 outline-none focus:ring-1 focus:ring-[#b8892a]/60"
            />
            {collectionSearch && (
              <button onClick={() => setCollectionSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70">
                <X size={11} />
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {filteredCollections.length === 0 && (
            <div className="px-4 py-4 text-xs text-white/30 text-center">No matches</div>
          )}
          {filteredCollections.map(c => (
            <button
              key={c.id}
              onClick={() => selectCollection(c.id)}
              className={`w-full text-left px-3 py-2 transition border-l-2 flex items-center gap-3 ${
                selectedCollectionId === c.id
                  ? 'bg-white/10 border-[#b8892a]'
                  : 'border-transparent hover:bg-white/5'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg overflow-hidden shrink-0 ${collectionLogoUrls[c.id] ? 'bg-white p-0.5' : 'bg-white/10'}`}>
                {collectionLogoUrls[c.id] ? (
                  <img src={collectionLogoUrls[c.id]} alt="" className="w-full h-full object-contain" />
                ) : c.image ? (
                  <img src={c.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-semibold text-white/40">
                    {c.title.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="text-sm text-white leading-snug">{c.title}</div>
            </button>
          ))}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#faf7f2] rounded-xl border border-[#d4c5b0] overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center gap-4 px-5 py-3 border-b border-[#e8dcc8] bg-white min-h-[52px]">
          {selectedCollection ? (
            <>
              {/* Collection name + counts */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="font-medium text-sm truncate">{selectedCollection.title}</div>
                {activeTab === 'products' && !loadingProducts && (
                  <div className="text-xs text-[#8a7660] shrink-0">
                    {liveCount} live · {draftCount} draft · {products.length} total
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setActiveTab('products')}
                  className={`px-3 py-1 text-xs rounded-lg transition ${
                    activeTab === 'products' ? 'bg-[#1c1412] text-white' : 'text-[#6b5f54] hover:bg-[#f0e8d8]'
                  }`}>
                  Products
                </button>
                <button onClick={() => setActiveTab('report')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg transition ${
                    activeTab === 'report' ? 'bg-[#1c1412] text-white' : 'text-[#6b5f54] hover:bg-[#f0e8d8]'
                  }`}>
                  <BarChart2 size={12} /> Sales Report
                </button>
              </div>

              {/* Select all — products tab only */}
              <div className="ml-auto shrink-0">
                {activeTab === 'products' && !loadingProducts && products.length > 0 && (
                  <button onClick={toggleAll}
                    className="flex items-center gap-1.5 text-xs text-[#6b5f54] hover:text-[#1c1412] transition">
                    {selected.size === products.length
                      ? <><CheckSquare size={14} /> Deselect all</>
                      : <><Square size={14} /> Select all</>}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="text-xs text-[#8a7660]">Select a collection from the sidebar</div>
          )}
        </div>

        {activeTab === 'products' ? (
          <>
            {/* Batch action bar */}
            {selected.size > 0 && (
              <div className="flex items-center gap-3 px-5 py-2.5 bg-[#1c1412] text-white text-xs">
                <span className="font-medium">{selected.size} selected</span>
                <div className="flex-1" />
                <button onClick={() => runAction('live')} disabled={actionPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded transition disabled:opacity-50">
                  <Eye size={12} /> Go Live
                </button>
                <button onClick={() => runAction('draft')} disabled={actionPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#b8892a] hover:bg-[#a07820] rounded transition disabled:opacity-50">
                  <EyeOff size={12} /> Unpublish
                </button>
                <button onClick={() => runAction('remove')} disabled={actionPending || selectedCollection?.type === 'smart'}
                  title={selectedCollection?.type === 'smart' ? 'Cannot remove products from a smart collection' : undefined}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded transition disabled:opacity-50">
                  <X size={12} /> Remove from Collection
                </button>
                {!confirmDelete ? (
                  <button onClick={() => setConfirmDelete(true)} disabled={actionPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#9b1c1c] hover:bg-[#7a1616] rounded transition disabled:opacity-50">
                    <Trash2 size={12} /> Delete
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-300 text-[11px]">Delete {selected.size} from Shopify?</span>
                    <button onClick={() => runAction('delete')} disabled={actionPending}
                      className="px-2 py-1 bg-[#9b1c1c] rounded text-[11px]">Yes, delete</button>
                    <button onClick={() => setConfirmDelete(false)}
                      className="px-2 py-1 bg-white/10 rounded text-[11px]">Cancel</button>
                  </div>
                )}
                {actionPending && <Loader2 size={14} className="animate-spin ml-1" />}
              </div>
            )}

            {/* Product grid */}
            <div className="flex-1 overflow-y-auto p-5">
              {!selectedCollectionId && (
                <div className="flex items-center justify-center h-40 text-sm text-[#8a7660]">
                  Select a collection to view its products.
                </div>
              )}
              {loadingProducts && (
                <div className="flex items-center justify-center h-40 gap-2 text-sm text-[#8a7660]">
                  <Loader2 size={16} className="animate-spin" /> Loading products…
                </div>
              )}
              {productError && (
                <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{productError}</div>
              )}
              {!loadingProducts && !productError && selectedCollectionId && products.length === 0 && (
                <div className="flex items-center justify-center h-40 text-sm text-[#8a7660]">
                  No products in this collection yet.
                </div>
              )}
              {!loadingProducts && products.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {products.map(p => {
                    const isSelected = selected.has(p.id)
                    return (
                      <div
                        key={p.id}
                        onClick={() => toggleProduct(p.id)}
                        className={`relative rounded-xl border-2 overflow-hidden cursor-pointer transition select-none ${
                          isSelected ? 'border-[#b8892a] shadow-md' : 'border-[#d4c5b0] hover:border-[#b8892a]/50'
                        }`}
                      >
                        <div className={`absolute top-2 left-2 z-10 w-5 h-5 rounded flex items-center justify-center transition ${
                          isSelected ? 'bg-[#b8892a]' : 'bg-white/80 border border-[#d4c5b0]'
                        }`}>
                          {isSelected && <CheckSquare size={14} className="text-white" />}
                        </div>
                        <div className={`absolute top-2 right-2 z-10 text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                          p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {p.status === 'active' ? 'Live' : 'Draft'}
                        </div>
                        <div className="aspect-square bg-[#f9f6f0]">
                          {p.image ? (
                            <img src={p.image} alt={p.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-[#8a7660]">
                              No image
                            </div>
                          )}
                        </div>
                        <div className="p-2 bg-white">
                          <div className="text-[11px] font-medium line-clamp-2 leading-tight">{p.title}</div>
                          {p.price && <div className="text-[10px] text-[#b8892a] mt-0.5">${p.price}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        ) : selectedCollection ? (
          <SalesReport collection={selectedCollection} />
        ) : null}
      </div>
    </div>
  )
}
