'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { RefreshCw, Save, ArrowLeft, ImageIcon } from 'lucide-react'
import type { PrintfulTemplatesResponse, PrintfulTemplate } from '@/lib/printful'

interface Props {
  product: { id: number; title: string }
  colorMap: Record<string, number[]>
  placements: { key: string; label: string }[]
  templatesResponse: PrintfulTemplatesResponse
  existingDesign: any | null
  logoSignedUrl: string | null
}

function findTemplate(
  resp: PrintfulTemplatesResponse,
  placement: string,
  variantIds: number[]
): PrintfulTemplate | null {
  const { templates, variant_mapping } = resp
  if (!templates?.length) return null
  for (const vm of (variant_mapping || [])) {
    if (variantIds.includes(vm.variant_id)) {
      const ref = vm.templates?.find((t: any) => t.placement === placement)
      if (ref) {
        const found = templates.find(t => t.template_id === ref.template_id)
        if (found) return found
      }
    }
  }
  return templates[0] ?? null
}

export default function StudioEditorClient({
  product, colorMap, placements, templatesResponse, existingDesign, logoSignedUrl,
}: Props) {
  const supabase = createClient()

  const initColor = existingDesign?.color || Object.keys(colorMap)[0] || ''
  const initPlacement = existingDesign?.placement || placements[0]?.key || ''
  const initVariantIds = existingDesign?.variant_ids || colorMap[initColor] || []

  const t = existingDesign?.transform || {}
  const initNormW = t.normWidth || 0.25
  const initCenterX = t.normLeft !== undefined ? Math.round((t.normLeft + initNormW / 2) * 100) : 50
  const initCenterY = t.normTop !== undefined ? Math.round((t.normTop + (t.normHeight || initNormW) / 2) * 100) : 40
  const initSize = Math.round(initNormW * 100)
  const initAspect = t.normHeight && t.normWidth ? t.normHeight / t.normWidth : 1

  const [selectedColor, setSelectedColor] = useState(initColor)
  const [selectedPlacement, setSelectedPlacement] = useState(initPlacement)
  const [variantIds, setVariantIds] = useState<number[]>(initVariantIds)
  const [centerX, setCenterX] = useState(initCenterX)
  const [centerY, setCenterY] = useState(initCenterY)
  const [logoSize, setLogoSize] = useState(initSize)
  const [logoAspect, setLogoAspect] = useState(initAspect)

  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(logoSignedUrl)
  const [savedLogoPath, setSavedLogoPath] = useState<string | null>(existingDesign?.logo_path || null)

  const [mockups, setMockups] = useState<any[]>(existingDesign?.mockup_urls || [])
  const [notes, setNotes] = useState(existingDesign?.notes || '')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const template = useMemo(
    () => findTemplate(templatesResponse, selectedPlacement, variantIds),
    [templatesResponse, selectedPlacement, variantIds]
  )

  function buildTransform() {
    const normWidth = logoSize / 100
    const normHeight = normWidth * logoAspect
    const normLeft = Math.max(0, Math.min(1 - normWidth, centerX / 100 - normWidth / 2))
    const normTop = Math.max(0, Math.min(1 - normHeight, centerY / 100 - normHeight / 2))
    return { normLeft, normTop, normWidth, normHeight, angle: 0, opacity: 1 }
  }

  function handleColorChange(color: string) {
    setSelectedColor(color)
    setVariantIds(colorMap[color] || [])
    setMockups([])
  }

  function handlePlacementChange(placement: string) {
    setSelectedPlacement(placement)
    setCenterX(50)
    setCenterY(40)
    setMockups([])
  }

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a PNG or SVG with transparency')
      return
    }
    const url = URL.createObjectURL(file)
    setLogoFile(file)
    setLogoPreviewUrl(url)
    setSavedLogoPath(null)
    setMockups([])

    const img = new Image()
    img.onload = () => setLogoAspect(img.naturalHeight / img.naturalWidth)
    img.src = url
  }

  async function generateMockup() {
    if (!logoPreviewUrl) { toast.error('Upload a logo first'); return }

    setIsGenerating(true)
    try {
      const transform = buildTransform()
      let res: Response

      if (logoFile) {
        const fd = new FormData()
        fd.append('productId', String(product.id))
        fd.append('variantIds', JSON.stringify(variantIds))
        fd.append('placement', selectedPlacement)
        fd.append('transform', JSON.stringify(transform))
        fd.append('logo', logoFile)
        res = await fetch('/api/studio/generate-mockup', { method: 'POST', body: fd })
      } else {
        res = await fetch('/api/studio/generate-mockup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: product.id, variantIds, placement: selectedPlacement,
            transform, logoPath: savedLogoPath,
          }),
        })
      }

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setMockups(data.mockups || [])
      toast.success('Mockup generated!')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsGenerating(false)
    }
  }

  async function saveDraft() {
    if (!logoPreviewUrl && !savedLogoPath) { toast.error('Upload a logo first'); return }

    setIsSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')

      let finalLogoPath = savedLogoPath

      if (logoFile) {
        finalLogoPath = `logos/${user.id}/${Date.now()}-${logoFile.name}`
        const { error } = await supabase.storage
          .from('cqs-assets').upload(finalLogoPath, logoFile, { upsert: true })
        if (error) throw error
        await supabase.from('logos').insert({
          user_id: user.id, storage_path: finalLogoPath,
          filename: logoFile.name, mime_type: logoFile.type, size_bytes: logoFile.size,
        } as any)
        setSavedLogoPath(finalLogoPath)
        setLogoFile(null)
      }

      const { data: profile } = await supabase
        .from('profiles').select('quartet_name').eq('id', user.id).single()

      const payload: any = {
        user_id: user.id,
        quartet_name: (profile as any)?.quartet_name || 'My Quartet',
        product_id: product.id,
        product_title: product.title,
        color: selectedColor,
        placement: selectedPlacement,
        variant_ids: variantIds,
        logo_path: finalLogoPath,
        transform: buildTransform(),
        mockup_urls: mockups,
        notes: notes || null,
        status: 'draft',
      }

      if (existingDesign?.id) {
        const { error } = await supabase.from('designs')
          .update(payload).eq('id', existingDesign.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('designs').insert(payload)
        if (error) throw error
      }

      toast.success(existingDesign?.id ? 'Design updated!' : 'Draft saved!')
      window.location.href = '/studio'
    } catch (e: any) {
      toast.error('Save failed: ' + e.message)
    } finally {
      setIsSaving(false)
    }
  }

  const liveTransform = buildTransform()
  const logoOverlayStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${liveTransform.normLeft * 100}%`,
    top: `${liveTransform.normTop * 100}%`,
    width: `${liveTransform.normWidth * 100}%`,
    opacity: liveTransform.opacity ?? 1,
    pointerEvents: 'none',
  }

  return (
    <div className="max-w-[1200px]">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/studio" className="text-[#6b5f54] hover:text-[#1c1412]"><ArrowLeft size={20} /></Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{product.title}</h1>
          <div className="text-xs text-[#b8892a] mt-0.5">{selectedPlacement.replace(/_/g, ' ')} · {selectedColor}</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[300px_1fr] gap-8 items-start">
        {/* Sidebar */}
        <div className="space-y-5">

          {/* 1. Product & Variant */}
          <div className="card p-5">
            <div className="uppercase text-xs tracking-[1.5px] text-[#9b1c1c] mb-3">1. Product &amp; Variant</div>
            <Link href="/studio/catalog" className="text-sm text-[#9b1c1c] hover:underline block mb-3">
              ← Pick a different item
            </Link>
            {Object.keys(colorMap).length > 0 && (
              <div className="mb-3">
                <label className="text-xs uppercase text-[#9b1c1c] block mb-1.5">Color</label>
                <select value={selectedColor} onChange={e => handleColorChange(e.target.value)}
                  className="w-full border border-[#d4c5b0] rounded-lg px-3 py-2 bg-white text-sm">
                  {Object.keys(colorMap).sort().map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
            {placements.length > 0 && (
              <div>
                <label className="text-xs uppercase text-[#9b1c1c] block mb-1.5">Placement</label>
                <select value={selectedPlacement} onChange={e => handlePlacementChange(e.target.value)}
                  className="w-full border border-[#d4c5b0] rounded-lg px-3 py-2 bg-white text-sm">
                  {placements.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* 2. Logo */}
          <div className="card p-5">
            <div className="uppercase text-xs tracking-[1.5px] text-[#9b1c1c] mb-3">2. Your Logo</div>
            {logoPreviewUrl ? (
              <div className="border-2 border-[#b8892a] rounded-xl p-3 bg-[#f9f6f0]">
                <div className="flex items-center gap-3">
                  <img src={logoPreviewUrl} alt="Logo" className="w-12 h-12 object-contain rounded border border-[#d4c5b0] bg-white" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{logoFile?.name || 'Saved logo'}</div>
                    <div className="text-xs text-green-700 mt-0.5">✓ Ready</div>
                  </div>
                  <label className="text-xs px-2 py-1.5 border border-[#b8892a] rounded cursor-pointer hover:bg-white shrink-0">
                    Change
                    <input type="file" accept="image/png,image/svg+xml,image/jpeg" onChange={handleLogoSelect} className="hidden" />
                  </label>
                </div>
              </div>
            ) : (
              <label className="block border-2 border-dashed border-[#b8892a] rounded-xl p-6 text-center cursor-pointer hover:bg-[#f9f6f0] transition">
                <input type="file" accept="image/png,image/svg+xml,image/jpeg" onChange={handleLogoSelect} className="hidden" />
                <ImageIcon className="mx-auto mb-2 text-[#b8892a]" size={24} />
                <div className="text-sm font-medium">Upload PNG or SVG</div>
                <div className="text-xs text-[#8a7660] mt-1">Transparent background works best</div>
              </label>
            )}
          </div>

          {/* 3. Position & Size */}
          <div className="card p-5">
            <div className="uppercase text-xs tracking-[1.5px] text-[#9b1c1c] mb-4">3. Position &amp; Size</div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs text-[#6b5f54] mb-1.5">
                  <span>Left ← → Right</span><span>{centerX}%</span>
                </div>
                <input type="range" min={0} max={100} value={centerX}
                  onChange={e => setCenterX(parseInt(e.target.value))}
                  className="w-full accent-[#b8892a]" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-[#6b5f54] mb-1.5">
                  <span>Up ↑ ↓ Down</span><span>{centerY}%</span>
                </div>
                <input type="range" min={0} max={100} value={centerY}
                  onChange={e => setCenterY(parseInt(e.target.value))}
                  className="w-full accent-[#b8892a]" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-[#6b5f54] mb-1.5">
                  <span>Logo Size</span><span>{logoSize}%</span>
                </div>
                <input type="range" min={5} max={80} value={logoSize}
                  onChange={e => setLogoSize(parseInt(e.target.value))}
                  className="w-full accent-[#b8892a]" />
              </div>
            </div>
          </div>

          {/* 4. Notes */}
          <div className="card p-5">
            <div className="uppercase text-xs tracking-[1.5px] text-[#9b1c1c] mb-2">4. Notes for Trent</div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Special requests, preferred sizes, etc."
              className="w-full h-20 border border-[#d4c5b0] rounded-lg p-3 text-sm resize-y"
            />
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button onClick={generateMockup} disabled={isGenerating || !logoPreviewUrl}
              className="btn-primary w-full py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
              {isGenerating
                ? <><RefreshCw className="animate-spin" size={16} /> Generating… (10–20s)</>
                : 'Generate Mockup'}
            </button>
            <button onClick={saveDraft} disabled={isSaving || (!logoPreviewUrl && !savedLogoPath)}
              className="btn-secondary w-full py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
              <Save size={16} />{isSaving ? ' Saving…' : ' Save Draft'}
            </button>
            <Link href="/studio" className="block text-center text-sm text-[#6b5f54] hover:text-[#1c1412] py-1">
              Cancel
            </Link>
          </div>
        </div>

        {/* Preview area */}
        <div className="space-y-6">
          {/* Live preview */}
          <div>
            <div className="text-xs uppercase tracking-widest text-[#9b1c1c] mb-2">
              Live Preview
              <span className="ml-2 text-blue-600 normal-case font-normal">● instant</span>
            </div>
            {template && logoPreviewUrl ? (
              <div className="relative w-full rounded-2xl overflow-hidden border border-[#d4c5b0] shadow-sm"
                style={{ backgroundColor: template.background_color || undefined }}>
                <img src={template.image_url} alt="Garment" className="w-full block" />
                <div style={{
                  position: 'absolute',
                  top: `${(template.print_area_top / template.template_height) * 100}%`,
                  left: `${(template.print_area_left / template.template_width) * 100}%`,
                  width: `${(template.print_area_width / template.template_width) * 100}%`,
                  height: `${(template.print_area_height / template.template_height) * 100}%`,
                }}>
                  <img src={logoPreviewUrl} alt="Logo" style={logoOverlayStyle} />
                </div>
                {template.background_url && (
                  <img src={template.background_url} alt=""
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    style={{ mixBlendMode: 'multiply' }} />
                )}
              </div>
            ) : !logoPreviewUrl ? (
              <div className="w-full aspect-[3/4] rounded-2xl border-2 border-dashed border-[#d4c5b0] bg-[#f9f6f0] flex items-center justify-center text-center px-8">
                <div>
                  <div className="text-[#b8892a] text-sm font-medium mb-1">Upload your logo to see the preview</div>
                  <div className="text-xs text-[#8a7660]">Use the position &amp; size sliders to place it exactly where you want</div>
                </div>
              </div>
            ) : (
              <div className="w-full aspect-[3/4] rounded-2xl border border-dashed border-[#d4c5b0] bg-[#f9f6f0] flex items-center justify-center text-sm text-[#8a7660]">
                Preview not available for this product
              </div>
            )}
          </div>

          {/* Printful mockup */}
          {mockups.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-widest text-[#9b1c1c] mb-2">
                Printful Mockup
                <span className="ml-2 text-green-700 normal-case font-normal">● rendered</span>
              </div>
              <div className="space-y-3">
                {mockups.map((m: any, i: number) => (
                  <img key={i} src={m.mockup_url} alt={`Mockup ${i + 1}`}
                    className="w-full rounded-2xl border border-[#d4c5b0] shadow-sm" />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
