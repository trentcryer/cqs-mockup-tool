'use client'

import { useState, useMemo } from 'react'
import { PROMO_TEMPLATES, type PromoProduct } from '@/lib/promo/templates'
import { PROMO_PLATFORMS } from '@/lib/promo/platforms'
import { encodePromoData } from '@/lib/promo/encode'

export interface PromoteProductOption extends PromoProduct {
  id: number
  url: string
}

export interface PromoteLogoOption {
  id: string
  storagePath: string
  displayUrl: string | null
  filename: string
}

export default function PromoteBuilder({
  groupName,
  products,
  collectionUrl,
  logos = [],
}: {
  groupName: string
  products: PromoteProductOption[]
  collectionUrl: string
  logos?: PromoteLogoOption[]
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>(products[0] ? [products[0].id] : [])
  const [templateId, setTemplateId] = useState(PROMO_TEMPLATES[0].id)
  const [platformId, setPlatformId] = useState(PROMO_PLATFORMS[0].id)
  const [customCaption, setCustomCaption] = useState<string | null>(null)
  const [logoId, setLogoId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const selectedLogo = logos.find(l => l.id === logoId) || null

  const selectedProducts = useMemo(
    () => products.filter(p => selectedIds.includes(p.id)),
    [products, selectedIds]
  )
  const template = PROMO_TEMPLATES.find(t => t.id === templateId)!
  const suggestedCaption = template.caption(groupName, selectedProducts)
  const caption = customCaption ?? suggestedCaption

  const shopUrl = selectedProducts.length === 1 ? selectedProducts[0].url : collectionUrl

  const encodedData = useMemo(() => encodePromoData({
    templateId,
    platformId,
    groupName,
    products: selectedProducts.map(p => ({ title: p.title, image: p.image, price: p.price })),
    logoPath: selectedLogo?.storagePath,
  }), [templateId, platformId, groupName, selectedProducts, selectedLogo])

  const imageUrl = selectedProducts.length > 0
    ? `/api/promo/image?${new URLSearchParams({ data: encodedData }).toString()}`
    : null

  const landingUrl = useMemo(() => {
    if (typeof window === 'undefined' || !imageUrl) return null
    const params = new URLSearchParams({ data: encodedData, shop: shopUrl, caption })
    return `${window.location.origin}/promo/view?${params.toString()}`
  }, [encodedData, shopUrl, caption, imageUrl])

  function toggleProduct(id: number) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function shareTo(target: 'facebook' | 'x') {
    if (!landingUrl) return
    const url = target === 'facebook'
      ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(landingUrl)}`
      : `https://twitter.com/intent/tweet?text=${encodeURIComponent(caption)}&url=${encodeURIComponent(landingUrl)}`
    window.open(url, '_blank', 'noopener,noreferrer,width=600,height=600')
  }

  function copyCaption() {
    navigator.clipboard.writeText(caption)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex flex-col lg:flex-row rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 text-white min-h-[680px]">
      {/* Template + platform sidebar */}
      <div className="w-full lg:w-60 border-b lg:border-b-0 lg:border-r border-zinc-800 p-5 overflow-auto shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-[2px] text-zinc-500 mb-3">Templates</h2>
        <div className="space-y-2 mb-8">
          {PROMO_TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => setTemplateId(t.id)}
              className={`w-full text-left p-3 rounded-xl transition-all ${
                templateId === t.id ? 'bg-white text-black font-medium' : 'text-zinc-300 hover:bg-zinc-900'
              }`}
            >
              <div className="text-sm">{t.label}</div>
              <div className={`text-[11px] mt-0.5 ${templateId === t.id ? 'text-zinc-600' : 'text-zinc-500'}`}>{t.description}</div>
            </button>
          ))}
        </div>

        <h2 className="text-xs font-semibold uppercase tracking-[2px] text-zinc-500 mb-3">Platform</h2>
        <div className="flex flex-wrap gap-2">
          {PROMO_PLATFORMS.map(pf => (
            <button
              key={pf.id}
              onClick={() => setPlatformId(pf.id)}
              className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                platformId === pf.id ? 'bg-white text-black border-white font-medium' : 'text-zinc-300 border-zinc-700 hover:border-zinc-500'
              }`}
            >
              {pf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Live preview */}
      <div className="flex-1 flex items-center justify-center bg-zinc-900 p-8">
        {imageUrl ? (
          <img
            key={imageUrl}
            src={imageUrl}
            alt="Promo preview"
            className="max-w-full max-h-[640px] rounded-2xl shadow-2xl border border-zinc-800"
          />
        ) : (
          <div className="text-sm text-zinc-500">Select a product to preview</div>
        )}
      </div>

      {/* Controls sidebar */}
      <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-zinc-800 p-6 overflow-auto bg-zinc-950 shrink-0 space-y-8">
        <div>
          <label className="block text-xs uppercase tracking-[2px] text-zinc-500 mb-3">Products</label>
          <div className="grid grid-cols-4 gap-2">
            {products.map(p => {
              const checked = selectedIds.includes(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => toggleProduct(p.id)}
                  title={p.title}
                  className={`relative rounded-lg overflow-hidden border-2 transition ${checked ? 'border-white' : 'border-zinc-800'}`}
                >
                  <img src={p.image} alt={p.title} className="w-full h-14 object-cover bg-white" />
                  {checked && (
                    <div className="absolute top-0.5 right-0.5 bg-white text-black rounded-full w-4 h-4 flex items-center justify-center text-[10px]">✓</div>
                  )}
                </button>
              )
            })}
            {products.length === 0 && <p className="text-sm text-zinc-500 col-span-full">No products found in this collection yet.</p>}
          </div>
        </div>

        {logos.length > 0 && (
          <div>
            <label className="block text-xs uppercase tracking-[2px] text-zinc-500 mb-3">Logo (optional)</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setLogoId(null)}
                className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center text-[9px] text-zinc-400 transition ${logoId === null ? 'border-white' : 'border-zinc-800'}`}
              >
                None
              </button>
              {logos.map(l => (
                <button
                  key={l.id}
                  onClick={() => setLogoId(l.id)}
                  className={`relative w-12 h-12 rounded-lg border-2 overflow-hidden bg-white flex items-center justify-center transition ${logoId === l.id ? 'border-white' : 'border-zinc-800'}`}
                  title={l.filename}
                >
                  {l.displayUrl && <img src={l.displayUrl} alt={l.filename} className="max-h-9 max-w-9 object-contain" />}
                  {logoId === l.id && (
                    <div className="absolute top-0.5 right-0.5 bg-black text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[9px]">✓</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs uppercase tracking-[2px] text-zinc-500 mb-2">Caption</label>
          <textarea
            value={caption}
            onChange={e => setCustomCaption(e.target.value)}
            rows={4}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white focus:border-zinc-400 outline-none"
          />
          <button onClick={() => setCustomCaption(null)} className="text-xs text-zinc-400 mt-1.5 hover:text-white transition">
            Reset to suggested wording
          </button>
        </div>

        {imageUrl && (
          <div className="space-y-2">
            <button
              onClick={() => shareTo('facebook')}
              className="w-full bg-[#1877f2] hover:opacity-90 text-white font-semibold py-3 rounded-xl text-sm transition-all"
            >
              Share on Facebook
            </button>
            <button
              onClick={() => shareTo('x')}
              className="w-full bg-white hover:bg-zinc-200 text-black font-semibold py-3 rounded-xl text-sm transition-all"
            >
              Share on X
            </button>
            <p className="text-[11px] text-zinc-500 text-center pt-1">
              Opens a post pre-loaded with a link back to your shop. Facebook doesn&apos;t accept pre-filled captions — copy yours above and paste it into the post.
            </p>
            <button onClick={copyCaption} className="w-full text-xs text-zinc-400 hover:text-white transition py-1">
              {copied ? 'Copied!' : 'Copy caption text'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
