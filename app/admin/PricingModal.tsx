'use client'

import { useState, useEffect, useMemo, useTransition } from 'react'
import { X, Loader2 } from 'lucide-react'

interface VariantPrice {
  variantId: number
  name: string
  size: string | null
  color: string | null
  printfulCost: number
}

export interface PricingData {
  mode: 'flat' | 'by_size'
  flatPrice?: string
  variantPrices?: Record<number, string>
  kickbackEnabled: boolean
  kickbackPercent: number
}

interface Props {
  design: any
  defaultKickback: number
  approveAction: (fd: FormData) => Promise<void>
  onClose: () => void
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export default function PricingModal({ design, defaultKickback, approveAction, onClose }: Props) {
  const [variants, setVariants] = useState<VariantPrice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [mode, setMode] = useState<'flat' | 'by_size'>('flat')
  const [markupMode, setMarkupMode] = useState<'percentage' | 'custom'>('percentage')
  const [markupPercent, setMarkupPercent] = useState(60)
  const [customPrice, setCustomPrice] = useState('')
  const [kickbackEnabled, setKickbackEnabled] = useState(defaultKickback > 0)
  const [kickbackPercent, setKickbackPercent] = useState(defaultKickback || 15)
  const [saveKickback, setSaveKickback] = useState(false)

  // Per-size custom prices (by_size + custom mode)
  const [sizePrices, setSizePrices] = useState<Record<number, string>>({})

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/admin/product-pricing?productId=${design.product_id}&variantIds=${design.variant_ids.join(',')}`
        )
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setVariants(data.variants || [])
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [design.product_id, design.variant_ids])

  // Unique sizes with their avg/max cost
  const sizeGroups = useMemo(() => {
    const map = new Map<string, number[]>()
    for (const v of variants) {
      const key = v.size || 'One Size'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(v.printfulCost)
    }
    return Array.from(map.entries()).map(([size, costs]) => ({
      size,
      cost: Math.max(...costs),
    }))
  }, [variants])

  const avgCost = useMemo(() => {
    if (!variants.length) return 0
    return variants.reduce((s, v) => s + v.printfulCost, 0) / variants.length
  }, [variants])

  // Compute retail price for a given cost
  function retailFor(cost: number): number {
    if (markupMode === 'custom') return parseFloat(customPrice) || 0
    return cost * (1 + markupPercent / 100)
  }

  // Flat retail (based on avg cost)
  const flatRetail = retailFor(avgCost)
  const flatKickback = kickbackEnabled ? flatRetail * (kickbackPercent / 100) : 0
  const flatMyCut = flatRetail - avgCost - flatKickback

  function buildPricingData(): PricingData {
    if (mode === 'flat') {
      return {
        mode: 'flat',
        flatPrice: flatRetail.toFixed(2),
        kickbackEnabled,
        kickbackPercent,
      }
    } else {
      // by_size: map each variantId to its price
      const variantPrices: Record<number, string> = {}
      for (const v of variants) {
        const size = v.size || 'One Size'
        const customSizePrice = sizePrices[v.variantId]
        if (customSizePrice) {
          variantPrices[v.variantId] = parseFloat(customSizePrice).toFixed(2)
        } else {
          variantPrices[v.variantId] = retailFor(v.printfulCost).toFixed(2)
        }
      }
      return {
        mode: 'by_size',
        variantPrices,
        kickbackEnabled,
        kickbackPercent,
      }
    }
  }

  function handleConfirm() {
    const fd = new FormData()
    fd.append('designId', design.id)
    fd.append('pricingJson', JSON.stringify(buildPricingData()))
    if (saveKickback) fd.append('saveKickback', kickbackPercent.toString())
    startTransition(() => {
      approveAction(fd)
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-[#e8dcc8]">
          <div>
            <div className="font-semibold text-lg tracking-tight">{design.product_title}</div>
            <div className="text-xs text-[#b8892a] mt-0.5">{design.color} · {design.placement}</div>
          </div>
          <button onClick={onClose} className="text-[#8a7660] hover:text-[#1c1412] transition mt-0.5">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {loading && (
            <div className="flex items-center justify-center py-8 gap-2 text-sm text-[#8a7660]">
              <Loader2 className="animate-spin" size={16} /> Loading Printful prices…
            </div>
          )}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</div>
          )}

          {!loading && !error && (
            <>
              {/* Printful costs */}
              <div>
                <div className="text-xs uppercase tracking-widest text-[#9b1c1c] mb-2">Printful Fulfillment Costs</div>
                <div className="flex flex-wrap gap-2">
                  {sizeGroups.map(({ size, cost }) => (
                    <div key={size} className="text-xs bg-[#f9f6f0] border border-[#e8dcc8] rounded-lg px-3 py-1.5">
                      <span className="font-medium">{size}</span>
                      <span className="text-[#6b5f54] ml-1.5">{fmt(cost)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pricing mode */}
              <div>
                <div className="text-xs uppercase tracking-widest text-[#9b1c1c] mb-2">Pricing Mode</div>
                <div className="flex gap-2">
                  {(['flat', 'by_size'] as const).map(m => (
                    <button key={m} onClick={() => setMode(m)}
                      className={`flex-1 py-2 text-xs rounded-lg border transition ${
                        mode === m ? 'bg-[#1c1412] text-white border-[#1c1412]' : 'border-[#d4c5b0] hover:bg-[#f9f6f0]'
                      }`}>
                      {m === 'flat' ? 'One flat price' : 'Price by size'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Markup */}
              <div>
                <div className="text-xs uppercase tracking-widest text-[#9b1c1c] mb-2">Markup</div>
                <div className="flex gap-2 mb-3">
                  {(['percentage', 'custom'] as const).map(m => (
                    <button key={m} onClick={() => setMarkupMode(m)}
                      className={`flex-1 py-1.5 text-xs rounded-lg border transition ${
                        markupMode === m ? 'bg-[#1c1412] text-white border-[#1c1412]' : 'border-[#d4c5b0] hover:bg-[#f9f6f0]'
                      }`}>
                      {m === 'percentage' ? '% Markup' : 'Custom Price'}
                    </button>
                  ))}
                </div>

                {markupMode === 'percentage' && (
                  <div>
                    <div className="flex justify-between text-xs text-[#6b5f54] mb-1.5">
                      <span>Markup percentage</span>
                      <span className="font-medium">{markupPercent}%</span>
                    </div>
                    <input type="range" min={0} max={200} value={markupPercent}
                      onChange={e => setMarkupPercent(parseInt(e.target.value))}
                      className="w-full accent-[#b8892a]" />
                  </div>
                )}

                {markupMode === 'custom' && mode === 'flat' && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#6b5f54]">$</span>
                    <input type="number" min="0" step="0.01" value={customPrice}
                      onChange={e => setCustomPrice(e.target.value)}
                      placeholder="0.00"
                      className="flex-1 border border-[#d4c5b0] rounded-lg px-3 py-2 text-sm" />
                  </div>
                )}

                {markupMode === 'custom' && mode === 'by_size' && (
                  <div className="space-y-2">
                    {sizeGroups.map(({ size, cost }) => {
                      const vIds = variants.filter(v => (v.size || 'One Size') === size).map(v => v.variantId)
                      const val = sizePrices[vIds[0]] ?? ''
                      return (
                        <div key={size} className="flex items-center gap-3">
                          <div className="w-12 text-xs font-medium">{size}</div>
                          <div className="text-xs text-[#8a7660] w-16">cost: {fmt(cost)}</div>
                          <div className="flex items-center gap-1 flex-1">
                            <span className="text-sm text-[#6b5f54]">$</span>
                            <input type="number" min="0" step="0.01"
                              value={val}
                              onChange={e => {
                                const newPrices = { ...sizePrices }
                                vIds.forEach(id => { newPrices[id] = e.target.value })
                                setSizePrices(newPrices)
                              }}
                              placeholder={retailFor(cost).toFixed(2)}
                              className="flex-1 border border-[#d4c5b0] rounded-lg px-3 py-1.5 text-sm" />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Group kickback */}
              <div className="border border-[#e8dcc8] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-widest text-[#9b1c1c]">Group Kickback</div>
                  <button
                    onClick={() => setKickbackEnabled(k => !k)}
                    className={`relative w-10 h-5 rounded-full transition ${kickbackEnabled ? 'bg-[#b8892a]' : 'bg-[#d4c5b0]'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${kickbackEnabled ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>
                {kickbackEnabled && (
                  <>
                    <div>
                      <div className="flex justify-between text-xs text-[#6b5f54] mb-1.5">
                        <span>Kickback percentage</span>
                        <span className="font-medium">{kickbackPercent}%</span>
                      </div>
                      <input type="range" min={0} max={50} value={kickbackPercent}
                        onChange={e => setKickbackPercent(parseInt(e.target.value))}
                        className="w-full accent-[#b8892a]" />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-[#6b5f54] cursor-pointer">
                      <input type="checkbox" checked={saveKickback} onChange={e => setSaveKickback(e.target.checked)}
                        className="accent-[#b8892a]" />
                      Save {kickbackPercent}% as default for this group
                    </label>
                  </>
                )}
              </div>

              {/* Live calculator */}
              <div className="bg-[#f9f6f0] rounded-xl p-4 border border-[#e8dcc8]">
                <div className="text-xs uppercase tracking-widest text-[#9b1c1c] mb-3">Live Breakdown</div>
                {mode === 'flat' ? (
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between text-[#6b5f54]">
                      <span>Printful cost (avg)</span><span>{fmt(avgCost)}</span>
                    </div>
                    <div className="flex justify-between text-[#6b5f54]">
                      <span>Retail price</span><span>{fmt(flatRetail)}</span>
                    </div>
                    {kickbackEnabled && (
                      <div className="flex justify-between text-[#b8892a]">
                        <span>Group kickback ({kickbackPercent}%)</span>
                        <span>− {fmt(flatKickback)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold border-t border-[#e8dcc8] pt-1.5 mt-1.5">
                      <span>My cut</span>
                      <span className={flatMyCut >= 0 ? 'text-green-700' : 'text-red-600'}>{fmt(flatMyCut)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5 text-xs">
                    {sizeGroups.map(({ size, cost }) => {
                      const vIds = variants.filter(v => (v.size || 'One Size') === size).map(v => v.variantId)
                      const customVal = sizePrices[vIds[0]]
                      const retail = customVal ? parseFloat(customVal) : retailFor(cost)
                      const kickback = kickbackEnabled ? retail * (kickbackPercent / 100) : 0
                      const cut = retail - cost - kickback
                      return (
                        <div key={size} className="flex items-center gap-2">
                          <span className="w-10 font-medium">{size}</span>
                          <span className="text-[#8a7660] w-14">cost {fmt(cost)}</span>
                          <span className="text-[#6b5f54] w-16">→ {fmt(retail)}</span>
                          {kickbackEnabled && <span className="text-[#b8892a] w-14">−{fmt(kickback)}</span>}
                          <span className={`font-semibold flex-1 text-right ${cut >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                            {fmt(cut)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-[#e8dcc8]">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm border border-[#d4c5b0] rounded-xl hover:bg-[#f9f6f0] transition">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending || loading || !!error}
            className="flex-1 py-2.5 text-sm bg-[#9b1c1c] text-white rounded-xl hover:bg-[#7a1616] disabled:opacity-40 transition font-medium"
          >
            {isPending ? 'Publishing…' : 'Confirm & Publish'}
          </button>
        </div>
      </div>
    </div>
  )
}
