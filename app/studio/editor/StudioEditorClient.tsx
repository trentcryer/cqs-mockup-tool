'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useTour } from '@/components/tour/TourProvider'
import { RefreshCw, Save, ArrowLeft, ImageIcon } from 'lucide-react'
import type { PrintfulTemplatesResponse, PrintfulTemplate } from '@/lib/printful'

interface SavedLogo {
  id: string
  filename: string
  storagePath: string
  displayUrl: string
}

interface Props {
  product: { id: number; title: string; isAop?: boolean }
  colorMap: Record<string, number[]>
  placements: { key: string; label: string }[]
  templatesResponse: PrintfulTemplatesResponse
  existingDesign: any | null
  logoSignedUrl: string | null
  savedLogos: SavedLogo[]
  adminLogos?: SavedLogo[]
  asUserId?: string | null
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
  product, colorMap, placements, templatesResponse, existingDesign, logoSignedUrl, savedLogos, adminLogos = [], asUserId,
}: Props) {
  const supabase = createClient()

  const initColor = existingDesign?.color || Object.keys(colorMap)[0] || ''
  const initPlacement = existingDesign?.placement || placements[0]?.key || ''
  const initVariantIds = existingDesign?.variant_ids || colorMap[initColor] || []

  const t = existingDesign?.transform || {}
  const initNormW = t.normWidth || 0.25
  const initNormH = t.normHeight || initNormW
  const initAvailW = Math.max(0.001, 1 - initNormW)
  const initAvailH = Math.max(0.001, 1 - initNormH)
  const initCenterX = t.normLeft !== undefined ? Math.round((t.normLeft / initAvailW) * 100) : 50
  const initCenterY = t.normTop  !== undefined ? Math.round((t.normTop  / initAvailH) * 100) : 40
  const initSize = Math.round(initNormW * 100)
  const initAspect = t.normHeight && t.normWidth ? t.normHeight / t.normWidth : 1

  const [selectedColor, setSelectedColor] = useState(initColor)
  const [selectedPlacement, setSelectedPlacement] = useState(initPlacement)
  const [variantIds, setVariantIds] = useState<number[]>(initVariantIds)
  const [centerX, setCenterX] = useState(initCenterX)
  const [centerY, setCenterY] = useState(initCenterY)
  const [logoSize, setLogoSize] = useState(initSize)
  const [logoAspect, setLogoAspect] = useState(initAspect)

  const [aopMode, setAopMode] = useState<'straight' | 'diagonal' | 'random'>('straight')
  const [entireShirt, setEntireShirt] = useState(!!product.isAop)
  const [gapPct, setGapPct] = useState(5)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(logoSignedUrl)
  const [savedLogoPath, setSavedLogoPath] = useState<string | null>(existingDesign?.logo_path || null)
  const [removingBg, setRemovingBg] = useState(false)
  const [bgRemoved, setBgRemoved] = useState(false)
  const [originalLogoFile, setOriginalLogoFile] = useState<File | null>(null)
  const [originalLogoUrl, setOriginalLogoUrl] = useState<string | null>(null)

  const [mockups, setMockups] = useState<any[]>(existingDesign?.mockup_urls || [])
  const [notes, setNotes] = useState(existingDesign?.notes || '')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  // Restore extra colors from existing design's color_variant_map on edit
  const initExtraColors: string[] = existingDesign?.color_variant_map
    ? Object.keys(existingDesign.color_variant_map).filter((c: string) => c !== initColor)
    : []
  const [extraColors, setExtraColors] = useState<string[]>(initExtraColors)
  const [showLogoPicker, setShowLogoPicker] = useState(!logoSignedUrl)
  const { continueTour } = useTour()
  const pickerWasOpen = useRef(!logoSignedUrl)

  // When the logo picker closes (user uploaded/selected a logo), advance tour to main editor steps
  useEffect(() => {
    if (pickerWasOpen.current && !showLogoPicker) {
      pickerWasOpen.current = false
      setTimeout(continueTour, 400)
    }
  }, [showLogoPicker])

  const template = useMemo(
    () => findTemplate(templatesResponse, selectedPlacement, variantIds),
    [templatesResponse, selectedPlacement, variantIds]
  )

  function buildTransform() {
    const normWidth  = Math.min(logoSize / 100, 1)
    const normHeight = normWidth * logoAspect
    // Map slider 0–100 across the actual available space so every slider position moves the logo.
    // availW/availH shrink as the logo grows, but the full slider range always does something.
    const availW  = Math.max(0, 1 - normWidth)
    const availH  = Math.max(0, 1 - normHeight)
    const normLeft = (centerX / 100) * availW
    const normTop  = (centerY / 100) * availH
    return { normLeft, normTop, normWidth, normHeight, angle: 0, opacity: 1 }
  }

  function handleColorChange(color: string) {
    setSelectedColor(color)
    setVariantIds(colorMap[color] || [])
    setMockups([])
    setExtraColors(prev => prev.filter(c => c !== color))
  }

  function toggleExtraColor(color: string) {
    setExtraColors(prev =>
      prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]
    )
  }

  function handlePlacementChange(placement: string) {
    setSelectedPlacement(placement)
    setCenterX(50)
    setCenterY(40)
    setMockups([])
  }

  function applyLogo(file: File, url: string) {
    setLogoFile(file)
    setLogoPreviewUrl(url)
    setSavedLogoPath(null)
    setMockups([])
    setShowLogoPicker(false)
    const img = new Image()
    img.onload = () => setLogoAspect(img.naturalHeight / img.naturalWidth)
    img.src = url
  }

  function selectLibraryLogo(logo: SavedLogo) {
    setLogoPreviewUrl(logo.displayUrl)
    setSavedLogoPath(logo.storagePath)
    setLogoFile(null)
    setMockups([])
    setShowLogoPicker(false)
    const img = new Image()
    img.onload = () => setLogoAspect(img.naturalHeight / img.naturalWidth)
    img.src = logo.displayUrl
  }

  async function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    const url = URL.createObjectURL(file)
    applyLogo(file, url)
    setOriginalLogoFile(file)
    setOriginalLogoUrl(url)
    setBgRemoved(false)

    // SVGs are already vector with transparency — skip removal
    if (file.type === 'image/svg+xml') return

    setRemovingBg(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await fetch('/api/studio/remove-background', { method: 'POST', body: fd })
      if (!res.ok) throw new Error(await res.text())

      const blob = await res.blob()
      const processedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.png'), { type: 'image/png' })
      const processedUrl = URL.createObjectURL(processedFile)
      applyLogo(processedFile, processedUrl)
      setBgRemoved(true)
    } catch (err: any) {
      console.error('Background removal client error:', err)
      toast.error('Background removal failed — using original image')
    } finally {
      setRemovingBg(false)
    }
  }

  function revertToOriginal() {
    if (!originalLogoFile || !originalLogoUrl) return
    applyLogo(originalLogoFile, originalLogoUrl)
    setBgRemoved(false)
  }

  async function generateMockup() {
    if (!logoPreviewUrl) { toast.error('Upload a logo first'); return }

    setIsGenerating(true)
    try {
      const transform = buildTransform()
      const allColorEntries: [string, number[]][] = [
        [selectedColor, variantIds],
        ...extraColors.map(c => [c, colorMap[c] || []] as [string, number[]]),
      ]
      const hasMultipleColors = allColorEntries.length > 1

      // Convert logo file to base64 once so parallel requests can share it
      let logoBase64: string | null = null
      if (logoFile && hasMultipleColors) {
        const buf = await logoFile.arrayBuffer()
        const bytes = new Uint8Array(buf)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
        logoBase64 = btoa(binary)
      }

      async function generateForColor(colorName: string, ids: number[]): Promise<any[]> {
        let res: Response
        if (logoFile) {
          if (hasMultipleColors) {
            res = await fetch('/api/studio/generate-mockup', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                productId: product.id, variantIds: ids, placement: selectedPlacement,
                transform, logoBase64, isAop: product.isAop ?? false, aopMode, entireShirt, gapPct,
              }),
            })
          } else {
            const fd = new FormData()
            fd.append('productId', String(product.id))
            fd.append('variantIds', JSON.stringify(ids))
            fd.append('placement', selectedPlacement)
            fd.append('transform', JSON.stringify(transform))
            fd.append('isAop', product.isAop ? 'true' : 'false')
            fd.append('aopMode', aopMode)
            fd.append('entireShirt', entireShirt ? 'true' : 'false')
            fd.append('gapPct', String(gapPct))
            fd.append('logo', logoFile)
            res = await fetch('/api/studio/generate-mockup', { method: 'POST', body: fd })
          }
        } else {
          res = await fetch('/api/studio/generate-mockup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productId: product.id, variantIds: ids, placement: selectedPlacement,
              transform, logoPath: savedLogoPath, isAop: product.isAop ?? false, aopMode, entireShirt, gapPct,
            }),
          })
        }
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `Generation failed for ${colorName}`)
        return (data.mockups || []).map((m: any) => ({ ...m, color: colorName }))
      }

      const results = await Promise.all(allColorEntries.map(([color, ids]) => generateForColor(color, ids)))
      const allMockups = results.flat()
      setMockups(allMockups)
      toast.success(hasMultipleColors
        ? `Mockups generated for ${allColorEntries.length} colors!`
        : 'Mockup generated!')
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

      const effectiveUserId = asUserId ?? user.id
      let finalLogoPath = savedLogoPath

      if (logoFile) {
        finalLogoPath = `logos/${effectiveUserId}/${Date.now()}-${logoFile.name}`
        const { error } = await supabase.storage
          .from('cqs-assets').upload(finalLogoPath, logoFile, { upsert: true })
        if (error) throw error
        await supabase.from('logos').insert({
          user_id: effectiveUserId, storage_path: finalLogoPath,
          filename: logoFile.name, mime_type: logoFile.type, size_bytes: logoFile.size,
        } as any)
        setSavedLogoPath(finalLogoPath)
        setLogoFile(null)
      }

      const { data: profile } = await supabase
        .from('profiles').select('quartet_name').eq('id', user.id).single()

      const colorVariantMap: Record<string, number[]> = {
        [selectedColor]: variantIds,
        ...Object.fromEntries(extraColors.map(c => [c, colorMap[c] || []])),
      }

      const designPayload = {
        ...(existingDesign?.id ? { id: existingDesign.id } : {}),
        user_id: effectiveUserId,
        quartet_name: (profile as any)?.quartet_name || 'My Quartet',
        product_id: product.id,
        product_title: product.title,
        placement: selectedPlacement,
        logo_path: finalLogoPath,
        transform: buildTransform(),
        notes: notes || null,
        status: 'draft',
        color: selectedColor,
        variant_ids: variantIds,
        color_variant_map: colorVariantMap,
        mockup_urls: mockups,
      }

      if (asUserId) {
        // Save on behalf of a group — use the admin endpoint to bypass RLS
        const res = await fetch('/api/admin/save-design', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...designPayload, asUserId }),
        })
        if (!res.ok) throw new Error((await res.json()).error || 'Save failed')
      } else if (existingDesign?.id) {
        const { error } = await supabase.from('designs').update(designPayload).eq('id', existingDesign.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('designs').insert(designPayload)
        if (error) throw error
      }

      const colorCount = Object.keys(colorVariantMap).length
      toast.success(existingDesign?.id ? 'Design updated!' : `Design saved for group!`)
      window.location.href = asUserId ? '/admin/groups' : '/studio'
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

      {/* Logo picker modal — shown on first load when no logo is selected */}
      {showLogoPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
          <div data-tour="editor-logo-modal" className="bg-white shadow-2xl w-full max-w-lg overflow-hidden">

            {/* Header */}
            <div className="px-8 pt-8 pb-5 border-b border-[#f0ebe3]">
              <p className="text-[10px] text-[#9b8c7a] uppercase tracking-[2.5px] font-bold mb-1.5">
                {product.title}
              </p>
              <h2 className="text-2xl font-semibold text-[#1c1412] tracking-tight">Choose your logo</h2>
              <p className="text-sm text-[#8a7660] mt-1">
                {savedLogos.length > 0
                  ? 'Pick from your library or upload something new'
                  : 'Upload your logo to get started — background removed automatically'}
              </p>
            </div>

            {/* Saved logo library */}
            {savedLogos.length > 0 && (
              <div className="px-8 py-5 border-b border-[#f0ebe3] max-h-64 overflow-y-auto">
                <p className="text-[9px] uppercase tracking-[2px] font-bold text-[#9b8c7a] mb-3">
                  Your Logo Library
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {savedLogos.map(logo => (
                    <button
                      key={logo.id}
                      onClick={() => selectLibraryLogo(logo)}
                      className="group relative aspect-square bg-[#f7f5f2] overflow-hidden transition-all duration-200 hover:shadow-sm focus:outline-none border-2 border-transparent hover:border-[#1c1412]"
                    >
                      <img
                        src={logo.displayUrl}
                        alt={logo.filename}
                        className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-x-0 bottom-0 py-1.5 bg-white/95 text-[9px] text-[#4a3f35] text-center truncate px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {logo.filename}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Admin's own logo library — admin mode only */}
            {asUserId && adminLogos.length > 0 && (
              <div className="px-8 py-5 border-b border-[#f0ebe3] max-h-64 overflow-y-auto">
                <p className="text-[9px] uppercase tracking-[2px] font-bold text-[#9b8c7a] mb-3">
                  Your File Library
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {adminLogos.map(logo => (
                    <button
                      key={logo.id}
                      onClick={() => selectLibraryLogo(logo)}
                      className="group relative aspect-square bg-[#f7f5f2] overflow-hidden transition-all duration-200 hover:shadow-sm focus:outline-none border-2 border-transparent hover:border-[#1c1412]"
                    >
                      <img
                        src={logo.displayUrl}
                        alt={logo.filename}
                        className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-x-0 bottom-0 py-1.5 bg-white/95 text-[9px] text-[#4a3f35] text-center truncate px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {logo.filename}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Upload option */}
            <div className="px-8 py-6">
              {savedLogos.length > 0 && (
                <p className="text-[9px] uppercase tracking-[2px] font-bold text-[#9b8c7a] mb-3">
                  Upload New
                </p>
              )}
              <label data-tour="editor-upload-btn" className="flex items-center gap-4 border-2 border-dashed border-[#d4c5b0] px-5 py-4 cursor-pointer hover:border-[#1c1412] hover:bg-[#f7f5f2] transition-all group">
                <input type="file" accept="image/*" onChange={handleLogoSelect} className="hidden" />
                <div className="w-10 h-10 bg-[#f0ece6] flex items-center justify-center shrink-0 transition-colors">
                  <ImageIcon size={20} className="text-[#9b8c7a]" />
                </div>
                <div>
                  <div className="text-sm font-medium text-[#1c1412]">
                    {savedLogos.length > 0 ? 'Upload a different logo' : 'Upload your logo'}
                  </div>
                  <div className="text-xs text-[#8a7660] mt-0.5">
                    PNG, JPG, SVG · Background removed automatically
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>
      )}

      {asUserId && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-sm" style={{ borderRadius: 4 }}>
          <span className="font-semibold">Admin mode:</span> designing on behalf of a group — saves to their account
          <Link href="/admin/groups" className="ml-auto text-xs underline text-amber-700 hover:text-amber-900">← Back to Groups</Link>
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <Link href={asUserId ? '/admin/groups' : '/studio'} className="text-[#6b5f54] hover:text-[#1c1412]"><ArrowLeft size={20} /></Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{product.title}</h1>
          <div className="text-xs text-[#9b8c7a] mt-0.5">{selectedPlacement.replace(/_/g, ' ')} · {selectedColor}</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[300px_1fr] gap-8 items-start">
        {/* Sidebar */}
        <div className="space-y-5">

          {/* 1. Product & Variant */}
          <div data-tour="editor-color" className="card p-5">
            <div className="uppercase text-xs tracking-[1.5px] text-[#9b8c7a] mb-3">1. Product &amp; Variant</div>
            <Link href="/studio/catalog" className="text-sm text-[#9b8c7a] hover:text-[#1c1412] underline block mb-3">
              ← Pick a different item
            </Link>
            {Object.keys(colorMap).length > 0 && (
              <div className="mb-3">
                <label className="text-xs uppercase text-[#9b8c7a] block mb-1.5">Color</label>
                <select value={selectedColor} onChange={e => handleColorChange(e.target.value)}
                  className="w-full border border-[#d4c5b0] rounded-lg px-3 py-2 bg-white text-sm">
                  {Object.keys(colorMap).sort().map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                {Object.keys(colorMap).length > 1 && (
                  <div className="mt-2.5">
                    <div className="text-[10px] uppercase tracking-wider text-[#8a7660] mb-1.5">
                      Also available in:
                    </div>
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                      {Object.keys(colorMap).sort()
                        .filter(c => c !== selectedColor)
                        .map(c => (
                          <label key={c} className="flex items-center gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={extraColors.includes(c)}
                              onChange={() => toggleExtraColor(c)}
                              className="w-3.5 h-3.5 shrink-0"
                            />
                            <span className="text-sm text-[#4a3f35] group-hover:text-[#1c1412]">{c}</span>
                          </label>
                        ))
                      }
                    </div>
                    {extraColors.length > 0 && (
                      <div className="mt-1.5 text-[10px] text-[#9b8c7a]">
                        {1 + extraColors.length} colors on one product listing
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {placements.length > 0 && (
              <div data-tour="editor-placement">
                <label className="text-xs uppercase text-[#9b8c7a] block mb-1.5">Placement</label>
                <select value={selectedPlacement} onChange={e => handlePlacementChange(e.target.value)}
                  className="w-full border border-[#d4c5b0] rounded-lg px-3 py-2 bg-white text-sm">
                  {placements.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* 2. Logo */}
          <div data-tour="editor-logo" className="card p-5">
            <div className="uppercase text-xs tracking-[1.5px] text-[#9b8c7a] mb-3">2. Your Logo</div>
            {logoPreviewUrl ? (
              <div className="border-2 border-[#1c1412] p-3 bg-[#faf9f7]">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded border border-[#d4c5b0] bg-[repeating-conic-gradient(#ccc_0%_25%,white_0%_50%)] bg-[length:12px_12px] shrink-0 overflow-hidden">
                    <img src={logoPreviewUrl} alt="Logo" className="w-full h-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{logoFile?.name || 'Saved logo'}</div>
                    {removingBg ? (
                      <div className="text-xs text-[#9b8c7a] mt-0.5 flex items-center gap-1">
                        <RefreshCw size={10} className="animate-spin" /> Removing background…
                      </div>
                    ) : bgRemoved ? (
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-green-700">✓ Background removed</span>
                        <button onClick={revertToOriginal} className="text-xs text-[#8a7660] hover:underline">
                          Use original
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-green-700 mt-0.5">✓ Ready</div>
                    )}
                  </div>
                  <label className="text-xs px-2 py-1.5 border border-[#e8e0d8] cursor-pointer hover:border-[#1c1412] shrink-0">
                    Change
                    <input type="file" accept="image/*" onChange={handleLogoSelect} className="hidden" />
                  </label>
                </div>
              </div>
            ) : (
              <label className="block border-2 border-dashed border-[#d4c5b0] p-6 text-center cursor-pointer hover:bg-[#f0ece6] transition">
                <input type="file" accept="image/*" onChange={handleLogoSelect} className="hidden" />
                <ImageIcon className="mx-auto mb-2 text-[#9b8c7a]" size={24} />
                <div className="text-sm font-medium">Upload any image</div>
                <div className="text-xs text-[#8a7660] mt-1">Background removed automatically</div>
              </label>
            )}
          </div>

          {/* 3. Position & Size */}
          <div className="card p-5">
            <div className="uppercase text-xs tracking-[1.5px] text-[#9b8c7a] mb-4">3. Position &amp; Size</div>
            <div className="space-y-4">
              {logoSize < 100 ? (
                <>
                  <div>
                    <div className="flex justify-between text-xs text-[#6b5f54] mb-1.5">
                      <span>← Left / Right →</span>
                      <span className="text-[#9b8c7a] font-medium">
                        {centerX < 10 ? 'Far Left' : centerX > 90 ? 'Far Right' : centerX === 50 ? 'Centered' : centerX < 50 ? 'Left' : 'Right'}
                      </span>
                    </div>
                    <input type="range" min={0} max={100} value={centerX}
                      onChange={e => setCenterX(parseInt(e.target.value))}
                      className="w-full accent-[#1c1412]" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-[#6b5f54] mb-1.5">
                      <span>↑ Up / Down ↓</span>
                      <span className="text-[#9b8c7a] font-medium">
                        {centerY < 10 ? 'Top' : centerY > 90 ? 'Bottom' : centerY === 50 ? 'Centered' : centerY < 50 ? 'Upper' : 'Lower'}
                      </span>
                    </div>
                    <input type="range" min={0} max={100} value={centerY}
                      onChange={e => setCenterY(parseInt(e.target.value))}
                      className="w-full accent-[#1c1412]" />
                  </div>
                </>
              ) : (
                <div className="text-xs text-[#8a7660] bg-[#f7f3ee] rounded-lg px-3 py-2">
                  Logo fills the print area — reduce size to enable positioning
                </div>
              )}
              <div>
                <div className="flex justify-between text-xs text-[#6b5f54] mb-1.5">
                  <span>Logo Size</span>
                  <span className="text-[#9b8c7a] font-medium">{logoSize}%</span>
                </div>
                <input type="range" min={5} max={product.isAop ? 150 : 100} value={logoSize}
                  onChange={e => setLogoSize(parseInt(e.target.value))}
                  className="w-full accent-[#1c1412]" />
              </div>
              {product.isAop && (
                <>
                  <div>
                    <label className="text-xs text-[#6b5f54] block mb-1.5">Tile Style</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {([
                        { value: 'straight', label: 'Straight' },
                        { value: 'diagonal', label: 'Diagonal' },
                        { value: 'random',   label: 'Random' },
                      ] as const).map(opt => (
                        <button key={opt.value} type="button"
                          onClick={() => setAopMode(opt.value)}
                          className={`py-1.5 text-xs rounded-lg border transition ${
                            aopMode === opt.value
                              ? 'bg-[#1c1412] border-[#1c1412] text-white font-medium'
                              : 'border-[#e8e0d8] text-[#4a3f35] hover:border-[#1c1412]'
                          }`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-[#6b5f54] mb-1.5">
                      <span>Tile Spacing</span>
                      <span>{gapPct === 0 ? 'Touching' : `${gapPct}% gap`}</span>
                    </div>
                    <input type="range" min={0} max={60} value={gapPct}
                      onChange={e => setGapPct(parseInt(e.target.value))}
                      className="w-full accent-[#1c1412]" />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={entireShirt} onChange={e => setEntireShirt(e.target.checked)}
                      className="w-4 h-4" />
                    <span className="text-xs text-[#6b5f54]">Entire shirt (front, back &amp; sleeves)</span>
                  </label>
                </>
              )}
            </div>
          </div>

          {/* 4. Notes */}
          <div className="card p-5">
            <div className="uppercase text-xs tracking-[1.5px] text-[#9b8c7a] mb-2">4. Notes for Trent</div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Special requests, preferred sizes, etc."
              className="w-full h-20 border border-[#d4c5b0] rounded-lg p-3 text-sm resize-y"
            />
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button data-tour="editor-generate" onClick={generateMockup} disabled={isGenerating || !logoPreviewUrl}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50">
              {isGenerating
                ? <><RefreshCw className="animate-spin" size={16} /> Generating… (10–20s)</>
                : 'Generate Mockup'}
            </button>
            <button data-tour="editor-save" onClick={saveDraft} disabled={isSaving || (!logoPreviewUrl && !savedLogoPath)}
              className="btn-secondary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50">
              <Save size={16} />{isSaving ? ' Saving…' : ' Save Draft'}
            </button>
            <Link href="/studio" className="block text-center text-sm text-[#6b5f54] hover:text-[#1c1412] py-1">
              Cancel
            </Link>
          </div>
        </div>

        {/* Preview area */}
        <div data-tour="editor-preview" className="space-y-6">
          {/* Live preview */}
          <div>
            <div className="text-xs uppercase tracking-widest text-[#9b8c7a] mb-2">
              Live Preview
              <span className="ml-2 text-blue-600 normal-case font-normal">● instant</span>
            </div>
            {template && logoPreviewUrl ? (
              <div className="relative w-full overflow-hidden border border-[#e8e0d8] shadow-sm" style={{ borderRadius: 4, backgroundColor: template.background_color || undefined }}>
                <img src={template.image_url} alt="Garment" className="w-full block" />
                <div style={{
                  position: 'absolute',
                  top: `${(template.print_area_top / template.template_height) * 100}%`,
                  left: `${(template.print_area_left / template.template_width) * 100}%`,
                  width: `${(template.print_area_width / template.template_width) * 100}%`,
                  height: `${(template.print_area_height / template.template_height) * 100}%`,
                  border: '1.5px dashed rgba(220,38,38,0.55)',
                  boxSizing: 'border-box',
                }}>
                  {/* PRINT AREA label — sits at the top edge of the border */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    transform: 'translateX(-50%) translateY(-50%)',
                    background: 'rgba(255,255,255,0.85)',
                    border: '1px solid rgba(220,38,38,0.4)',
                    borderRadius: 3,
                    padding: '1px 6px',
                    fontSize: 8,
                    letterSpacing: '0.15em',
                    color: 'rgba(185,28,28,0.9)',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    userSelect: 'none',
                    lineHeight: '14px',
                  }}>
                    PRINT AREA
                  </div>
                  <img src={logoPreviewUrl} alt="Logo" style={logoOverlayStyle} />
                </div>
                {/* No background_url (heather/tri-blend fabric swatch) overlay: multiplying it over the
                    white-bg ghost flooded the whole preview with the fabric color. The true garment color
                    is shown in the rendered Product Mockup below; this live preview is for logo placement. */}
              </div>
            ) : !logoPreviewUrl ? (
              <div className="w-full aspect-[3/4] rounded-2xl border-2 border-dashed border-[#d4c5b0] bg-[#f9f6f0] flex items-center justify-center text-center px-8">
                <div>
                  <div className="text-[#9b8c7a] text-sm font-medium mb-1">Upload your logo to see the preview</div>
                  <div className="text-xs text-[#8a7660]">Use the position &amp; size sliders to place it exactly where you want</div>
                </div>
              </div>
            ) : (
              <div className="w-full aspect-[3/4] rounded-2xl border border-dashed border-[#d4c5b0] bg-[#f9f6f0] flex items-center justify-center text-sm text-[#8a7660]">
                Preview not available for this product
              </div>
            )}
          </div>

          {/* Product mockup */}
          {mockups.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-widest text-[#9b8c7a] mb-2">
                Product Mockup
                <span className="ml-2 text-green-700 normal-case font-normal">● rendered</span>
              </div>
              <div className="space-y-4">
                {mockups.map((m: any, i: number) => (
                  <div key={i}>
                    {mockups.length > 1 && (
                      <div className="text-xs text-[#8a7660] mb-1 capitalize">
                        {[m.color, m.placement?.replace(/_/g, ' ')].filter(Boolean).join(' – ') || `View ${i + 1}`}
                      </div>
                    )}
                    <img src={m.mockup_url} alt={m.placement || `Mockup ${i + 1}`}
                      className="w-full rounded-2xl border border-[#d4c5b0] shadow-sm" />
                    {m.extra?.map((ex: any, j: number) => (
                      <img key={j} src={ex.url} alt={ex.title || `Extra ${j + 1}`}
                        className="w-full rounded-2xl border border-[#d4c5b0] shadow-sm mt-2" />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
