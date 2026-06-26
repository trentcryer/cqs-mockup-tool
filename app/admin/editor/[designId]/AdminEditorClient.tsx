'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { RefreshCw, X, Save } from 'lucide-react'
import type { PrintfulTemplate } from '@/lib/printful'
import { buildBodyHtml } from '@/lib/description-html'

interface ProductInfo {
  description: string
  sizes: string[]
  sizeTables: any[]
  colors: Array<{ name: string; value: string }>
}

interface Props {
  design: any
  canvasPreviewUrl: string | null
  logoSignedUrl: string | null
  template: PrintfulTemplate | null
  productInfo: ProductInfo | null
}

// Stable string for array dirty-checks (order-independent)
const norm = (arr: string[]) => JSON.stringify([...arr].sort())

export default function AdminEditorClient({ design, canvasPreviewUrl, logoSignedUrl, template, productInfo }: Props) {
  const t = design.transform || {}
  const overrides = design.publish_overrides || {}

  const normW = t.normWidth || 0.30
  const normH = t.normHeight || normW
  const initCenterX = Math.round(((t.normLeft || 0.35) + normW / 2) * 100)
  const initCenterY = Math.round(((t.normTop || 0.10) + normH / 2) * 100)
  const initSize = Math.round(normW * 100)

  const [centerX, setCenterX] = useState(initCenterX)
  const [centerY, setCenterY] = useState(initCenterY)
  const [logoSize, setLogoSize] = useState(initSize)
  const [mockups, setMockups] = useState<any[]>(design.mockup_urls || [])
  const [isGenerating, setIsGenerating] = useState(false)
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // --- Available options for this design -----------------------------------
  // Colors come from the design's color_variant_map (the colors that actually
  // have Printful variant IDs to publish), not Printful's full catalog list.
  const colorVariantMap: Record<string, number[]> =
    design.color_variant_map || (design.color ? { [design.color]: design.variant_ids || [] } : {})
  const availableColors = Object.keys(colorVariantMap)
  const availableSizes = productInfo?.sizes || []

  // --- Editable state (defaults from saved overrides, else Printful) --------
  const [productTitle, setProductTitle] = useState<string>(design.product_title || '')
  const [notes, setNotes] = useState<string>(design.notes || '')
  const [printfulDesc, setPrintfulDesc] = useState<string>(
    overrides.printful_description ?? productInfo?.description ?? ''
  )
  const [sizeGuideEnabled, setSizeGuideEnabled] = useState<boolean>(
    overrides.size_guide_enabled !== false
  )
  const [selectedColors, setSelectedColors] = useState<string[]>(
    Array.isArray(overrides.selected_colors) ? overrides.selected_colors : availableColors
  )
  const [selectedSizes, setSelectedSizes] = useState<string[]>(
    Array.isArray(overrides.selected_sizes) ? overrides.selected_sizes : availableSizes
  )

  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState({
    title: design.product_title || '',
    notes: design.notes || '',
    desc: overrides.printful_description ?? productInfo?.description ?? '',
    sizeGuide: overrides.size_guide_enabled !== false,
    colors: norm(Array.isArray(overrides.selected_colors) ? overrides.selected_colors : availableColors),
    sizes: norm(Array.isArray(overrides.selected_sizes) ? overrides.selected_sizes : availableSizes),
  })

  const dirty =
    productTitle.trim() !== saved.title ||
    notes.trim() !== saved.notes ||
    printfulDesc.trim() !== saved.desc.trim() ||
    sizeGuideEnabled !== saved.sizeGuide ||
    norm(selectedColors) !== saved.colors ||
    norm(selectedSizes) !== saved.sizes

  function toggleColor(c: string) {
    setSelectedColors(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }
  function toggleSize(s: string) {
    setSelectedSizes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  async function saveAll() {
    if (!productTitle.trim()) { toast.error('Title cannot be empty'); return }
    if (selectedColors.length === 0) { toast.error('Select at least one color'); return }
    if (availableSizes.length > 0 && selectedSizes.length === 0) { toast.error('Select at least one size'); return }
    setIsSaving(true)
    try {
      const res = await fetch(`/api/admin/designs/${design.id}/details`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productTitle,
          notes,
          printfulDescription: printfulDesc,
          sizeGuideEnabled,
          selectedColors,
          selectedSizes,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setSaved({
        title: productTitle.trim(),
        notes: notes.trim(),
        desc: printfulDesc.trim(),
        sizeGuide: sizeGuideEnabled,
        colors: norm(selectedColors),
        sizes: norm(selectedSizes),
      })
      toast.success('Saved — these are the defaults used when you publish')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsSaving(false)
    }
  }

  function buildTransform() {
    const normWidth = logoSize / 100
    const origAspect = t.normHeight && t.normWidth ? t.normHeight / t.normWidth : 1
    const normHeight = normWidth * origAspect
    const normLeft = Math.max(0, Math.min(1 - normWidth, centerX / 100 - normWidth / 2))
    const normTop = Math.max(0, Math.min(1 - normHeight, centerY / 100 - normHeight / 2))
    return { normLeft, normTop, normWidth, normHeight, angle: t.angle || 0, opacity: t.opacity ?? 1 }
  }

  async function regenerate() {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsGenerating(true)
    try {
      const res = await fetch('/api/admin/generate-mockup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ designId: design.id, transform: buildTransform() }),
        signal: controller.signal,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setMockups(data.mockups || [])
      toast.success('Mockup updated!')
    } catch (e: any) {
      if ((e as any).name !== 'AbortError') toast.error(e.message)
    } finally {
      setIsGenerating(false)
    }
  }

  // Compute logo CSS position within the print area overlay
  const liveTransform = buildTransform()
  const logoStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${liveTransform.normLeft * 100}%`,
    top: `${liveTransform.normTop * 100}%`,
    width: `${liveTransform.normWidth * 100}%`,
    transform: liveTransform.angle ? `rotate(${liveTransform.angle}deg)` : undefined,
    opacity: liveTransform.opacity ?? 1,
    pointerEvents: 'none',
  }

  // Published preview — mirrors exactly what approveAndPublish ships to Shopify
  const colorLabel = selectedColors.length > 1
    ? `${selectedColors.length} Colors`
    : (selectedColors[0] || design.color || design.placement)
  const previewTitle = `${design.quartet_name} — ${productTitle || '…'} (${colorLabel})`
  const previewBodyHtml = buildBodyHtml({
    notes,
    descriptionText: printfulDesc,
    sizeTables: productInfo?.sizeTables,
    sizeGuideEnabled,
  })

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/admin" className="text-sm text-[#6b5f54] hover:underline">← Admin</Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {design.quartet_name}
          </h1>
          <div className="text-xs text-[#9b8c7a] mt-0.5">
            {design.placement.replace(/_/g, ' ')} · {design.color}
          </div>
        </div>
      </div>

      {/* Three-column preview: customer → live → printful */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Customer's original placement — read-only live preview */}
        <div>
          <div className="eyebrow mb-2">Customer</div>
          {(() => {
            const ct = design.transform || {}
            const origNormW = ct.normWidth || 0.25
            const origStyle: React.CSSProperties = {
              position: 'absolute',
              left: `${(ct.normLeft || 0) * 100}%`,
              top: `${(ct.normTop || 0) * 100}%`,
              width: `${origNormW * 100}%`,
              opacity: ct.opacity ?? 1,
              pointerEvents: 'none',
            }
            return template && logoSignedUrl ? (
              <div className="relative w-full rounded-xl overflow-hidden border border-[#d4c5b0] shadow-sm"
                style={{ backgroundColor: template.background_color || undefined }}>
                <img src={template.image_url} alt="Garment" className="w-full block" />
                <div style={{
                  position: 'absolute',
                  top: `${(template.print_area_top / template.template_height) * 100}%`,
                  left: `${(template.print_area_left / template.template_width) * 100}%`,
                  width: `${(template.print_area_width / template.template_width) * 100}%`,
                  height: `${(template.print_area_height / template.template_height) * 100}%`,
                }}>
                  <img src={logoSignedUrl} alt="Logo" style={origStyle} />
                </div>
              </div>
            ) : canvasPreviewUrl ? (
              <img src={canvasPreviewUrl} alt="Customer placement"
                className="w-full rounded-xl border border-[#d4c5b0] shadow-sm" />
            ) : (
              <div className="w-full aspect-square rounded-xl border border-dashed border-[#d4c5b0] bg-[#f9f6f0] flex items-center justify-center text-sm text-[#8a7660]">
                No preview saved
              </div>
            )
          })()}
        </div>

        {/* Live preview — instant, no API */}
        <div>
          <div className="eyebrow mb-2">
            Live Preview
            <span className="ml-2 text-blue-600 normal-case font-normal">● instant</span>
          </div>
          {template && logoSignedUrl ? (
            <div
              className="relative w-full rounded-xl overflow-hidden border border-[#d4c5b0] shadow-sm"
              style={{ backgroundColor: template.background_color || undefined }}
            >
              <img src={template.image_url} alt="Garment" className="w-full block" />
              <div
                style={{
                  position: 'absolute',
                  top: `${(template.print_area_top / template.template_height) * 100}%`,
                  left: `${(template.print_area_left / template.template_width) * 100}%`,
                  width: `${(template.print_area_width / template.template_width) * 100}%`,
                  height: `${(template.print_area_height / template.template_height) * 100}%`,
                }}
              >
                <img src={logoSignedUrl} alt="Logo" style={logoStyle} />
              </div>
            </div>
          ) : (
            <div className="w-full aspect-square rounded-xl border border-dashed border-[#d4c5b0] bg-[#f9f6f0] flex items-center justify-center text-center px-6 text-sm text-[#8a7660]">
              {!template ? 'No garment template available' : 'No logo on file'}
            </div>
          )}
        </div>

        {/* Printful photorealistic mockup */}
        <div>
          <div className="eyebrow mb-2">
            Printful Mockup
            {mockups.length > 0 && (
              <span className="ml-2 text-green-700 normal-case font-normal">● rendered</span>
            )}
          </div>
          {mockups.length > 0 ? (
            <div className="space-y-3">
              {mockups.map((m: any, i: number) => (
                <div key={i} className="relative group cursor-zoom-in" onClick={() => setExpandedUrl(m.mockup_url)}>
                  <img
                    src={m.mockup_url}
                    alt={`Mockup ${i + 1}`}
                    className="w-full rounded-xl border border-[#d4c5b0] shadow-sm"
                  />
                  <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/10 transition flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition text-white text-xs font-medium bg-black/50 px-2 py-1 rounded">
                      Click to expand
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="w-full aspect-square rounded-xl border border-dashed border-[#d4c5b0] bg-[#f9f6f0] flex items-center justify-center text-center px-6 text-sm text-[#8a7660]">
              Happy with the preview?<br />
              <span className="font-medium text-[#1c1412]">Generate Mockup</span>
            </div>
          )}
        </div>
      </div>

      {/* Position controls */}
      <div className="card p-6">
        <div className="text-sm font-semibold mb-5">Adjust Logo Position &amp; Size</div>
        <div className="space-y-5">
          <div>
            <div className="flex justify-between text-xs text-[#6b5f54] mb-1.5">
              <span>Left ← → Right</span>
              <span>{centerX}%</span>
            </div>
            <input type="range" min={0} max={100} value={centerX}
              onChange={e => setCenterX(parseInt(e.target.value))} className="w-full accent-[#1c1412]" />
          </div>
          <div>
            <div className="flex justify-between text-xs text-[#6b5f54] mb-1.5">
              <span>Up ↑ ↓ Down</span>
              <span>{centerY}%</span>
            </div>
            <input type="range" min={0} max={100} value={centerY}
              onChange={e => setCenterY(parseInt(e.target.value))} className="w-full accent-[#1c1412]" />
          </div>
          <div>
            <div className="flex justify-between text-xs text-[#6b5f54] mb-1.5">
              <span>Logo Size</span>
              <span>{logoSize}%</span>
            </div>
            <input type="range" min={5} max={90} value={logoSize}
              onChange={e => setLogoSize(parseInt(e.target.value))} className="w-full accent-[#1c1412]" />
          </div>
          <div>
            <button onClick={regenerate} disabled={isGenerating}
              className="btn-primary px-6 py-2.5 rounded-xl flex items-center gap-2 disabled:opacity-50 text-sm">
              {isGenerating
                ? <><RefreshCw className="animate-spin" size={16} /> Generating… (10–20s)</>
                : 'Generate Mockup'}
            </button>
          </div>
        </div>
      </div>

      {/* ================= LISTING EDITOR ================= */}
      <div className="border-t border-[#e8e0d8] pt-2">
        <div className="text-xs uppercase tracking-wide text-[#9b8c7a] font-medium">Listing — everything below publishes to the store</div>
      </div>

      {/* Title + intro notes */}
      <div className="card p-6 space-y-4">
        <div className="text-sm font-semibold">Product Title &amp; Intro</div>
        <div>
          <label className="eyebrow block mb-1.5">Product Title</label>
          <input
            type="text"
            value={productTitle}
            onChange={e => setProductTitle(e.target.value)}
            placeholder="e.g. Unisex Heavy Cotton Tee"
            className="w-full text-sm border border-[#e8e0d8] px-3 py-2 rounded-lg focus:outline-none focus:border-[#1c1412] bg-[#faf7f2]"
          />
          <div className="text-xs text-[#9b8c7a] mt-1">
            Publishes as <span className="font-medium">{previewTitle}</span>
          </div>
        </div>
        <div>
          <label className="eyebrow block mb-1.5">Intro / Special Notes <span className="text-[#9b8c7a] normal-case">(optional — shown italic above the description)</span></label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="e.g. A portion of every sale supports the chapter"
            className="w-full text-sm border border-[#e8e0d8] px-3 py-2 rounded-lg focus:outline-none focus:border-[#1c1412] bg-[#faf7f2] resize-y"
          />
        </div>
      </div>

      {/* Printful description */}
      <div className="card p-6 space-y-3">
        <div className="text-sm font-semibold">Product Description</div>
        <p className="text-xs text-[#9b8c7a]">
          Pulled from Printful — edit freely. Each line becomes a paragraph; lines starting with “•” become bullet points.
        </p>
        <textarea
          value={printfulDesc}
          onChange={e => setPrintfulDesc(e.target.value)}
          rows={10}
          placeholder="Full product description"
          className="w-full text-sm border border-[#e8e0d8] px-3 py-2 rounded-lg focus:outline-none focus:border-[#1c1412] bg-[#faf7f2] resize-y font-mono"
        />
      </div>

      {/* Size guide */}
      <div className="card p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Size Guide</div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={sizeGuideEnabled}
              onChange={e => setSizeGuideEnabled(e.target.checked)}
              className="accent-[#1c1412] w-4 h-4"
            />
            Include in listing
          </label>
        </div>
        {productInfo?.sizeTables?.length ? (
          <div
            className={`prose-table overflow-x-auto text-sm transition ${sizeGuideEnabled ? '' : 'opacity-40'}`}
            dangerouslySetInnerHTML={{ __html: buildBodyHtml({ sizeTables: productInfo.sizeTables, sizeGuideEnabled: true }) }}
          />
        ) : (
          <p className="text-xs text-[#9b8c7a]">No size guide available from Printful for this product.</p>
        )}
      </div>

      {/* Colors */}
      <div className="card p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Colors <span className="text-[#9b8c7a] font-normal">({selectedColors.length}/{availableColors.length} selected)</span></div>
          <div className="flex gap-3 text-xs">
            <button onClick={() => setSelectedColors(availableColors)} className="text-[#6b5f54] hover:underline">Select all</button>
            <button onClick={() => setSelectedColors([])} className="text-[#6b5f54] hover:underline">Clear</button>
          </div>
        </div>
        {availableColors.length ? (
          <div className="flex flex-wrap gap-2">
            {availableColors.map(c => {
              const on = selectedColors.includes(c)
              const swatch = productInfo?.colors?.find(pc => pc.name === c)?.value
              return (
                <button
                  key={c}
                  onClick={() => toggleColor(c)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition ${
                    on ? 'border-[#1c1412] bg-[#1c1412] text-white' : 'border-[#e8e0d8] bg-[#faf7f2] text-[#6b5f54]'
                  }`}
                >
                  {swatch && (
                    <span className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ backgroundColor: swatch }} />
                  )}
                  {c}
                </button>
              )
            })}
          </div>
        ) : (
          <p className="text-xs text-[#9b8c7a]">No color variants mapped for this design.</p>
        )}
      </div>

      {/* Sizes */}
      <div className="card p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Sizes <span className="text-[#9b8c7a] font-normal">({selectedSizes.length}/{availableSizes.length} selected)</span></div>
          <div className="flex gap-3 text-xs">
            <button onClick={() => setSelectedSizes(availableSizes)} className="text-[#6b5f54] hover:underline">Select all</button>
            <button onClick={() => setSelectedSizes([])} className="text-[#6b5f54] hover:underline">Clear</button>
          </div>
        </div>
        {availableSizes.length ? (
          <div className="flex flex-wrap gap-2">
            {availableSizes.map(s => {
              const on = selectedSizes.includes(s)
              return (
                <button
                  key={s}
                  onClick={() => toggleSize(s)}
                  className={`px-3.5 py-1.5 rounded-lg border text-sm transition ${
                    on ? 'border-[#1c1412] bg-[#1c1412] text-white' : 'border-[#e8e0d8] bg-[#faf7f2] text-[#6b5f54]'
                  }`}
                >
                  {s}
                </button>
              )
            })}
          </div>
        ) : (
          <p className="text-xs text-[#9b8c7a]">No size data available from Printful — this product publishes without size options.</p>
        )}
        <p className="text-xs text-[#9b8c7a]">Per-size pricing is set in the publish step.</p>
      </div>

      {/* Published preview */}
      <div className="card p-6 space-y-3 bg-[#faf7f2]">
        <div className="text-sm font-semibold">Published Listing Preview</div>
        <div className="text-base font-semibold">{previewTitle}</div>
        {previewBodyHtml ? (
          <div
            className="prose-table text-sm leading-relaxed text-[#3a2f28] space-y-2 [&_h4]:font-semibold [&_h4]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_table]:w-full [&_table]:text-xs [&_th]:text-left [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_td]:border [&_th]:border-[#e8e0d8] [&_td]:border-[#e8e0d8]"
            dangerouslySetInnerHTML={{ __html: previewBodyHtml }}
          />
        ) : (
          <p className="text-xs text-[#9b8c7a]">Add a description to see the preview.</p>
        )}
      </div>

      {/* Sticky save bar */}
      <div className="sticky bottom-4 z-10">
        <div className="card p-4 flex items-center justify-between shadow-lg border-[#d4c5b0]">
          <div className="text-sm">
            {dirty
              ? <span className="text-[#b4541f] font-medium">Unsaved changes</span>
              : <span className="text-[#9b8c7a]">All changes saved</span>}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin" className="btn-secondary px-5 py-2.5 rounded-xl text-sm">Back to Admin</Link>
            <button
              onClick={saveAll}
              disabled={isSaving || !dirty}
              className="btn-primary px-6 py-2.5 rounded-xl flex items-center gap-2 text-sm disabled:opacity-40"
            >
              {isSaving
                ? <><RefreshCw className="animate-spin" size={14} /> Saving…</>
                : <><Save size={14} /> Save Listing</>}
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {expandedUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setExpandedUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition"
            onClick={() => setExpandedUrl(null)}
          >
            <X size={28} />
          </button>
          <img
            src={expandedUrl}
            alt="Mockup enlarged"
            className="max-h-[90vh] max-w-[90vw] rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
