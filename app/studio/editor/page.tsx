'use client'
// @ts-nocheck

/**
 * CQS Interactive Mockup Editor
 * The crown jewel of the studio.
 * - Loads real Printful product + variants + placements
 * - Fabric.js draggable/resizable/rotatable logo placement
 * - Real-time controls + high-quality Printful mockup generation
 * - Save design + logo to Supabase (private)
 */

import { useEffect, useState, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import FabricEditor from '@/components/FabricEditor'
import { ArrowLeft, Save, Image as ImageIcon, RefreshCw } from 'lucide-react'

interface ProductDetail {
  id: number
  title: string
  variants: any[]
}

interface Placement {
  key: string
  label: string
}

export default function EditorPage() {
  const search = useSearchParams()
  const router = useRouter()
  const supabase = createClient()

  const [productId, setProductId] = useState<number | null>(null)
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [colorMap, setColorMap] = useState<Record<string, number[]>>({})
  const [placements, setPlacements] = useState<Placement[]>([])
  const [printfilesData, setPrintfilesData] = useState<any>(null)
  const [selectedColor, setSelectedColor] = useState('')
  const [selectedPlacement, setSelectedPlacement] = useState('')
  const [variantIds, setVariantIds] = useState<number[]>([])

  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null)
  const [currentTransform, setCurrentTransform] = useState<any>(null)

  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedMockups, setGeneratedMockups] = useState<any[]>([])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [isProductLoading, setIsProductLoading] = useState(true)
  // Prevents disabled-attribute hydration mismatch: server renders with mounted=false so
  // disabled is always false on first paint; real disabled state kicks in after client mount.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // Image of the currently selected color's first variant (for the garment thumbnail)
  const selectedVariantImage = useMemo(() => {
    if (!product?.variants?.length) return undefined
    const match = product.variants.find((v: any) => v.color === selectedColor)
    return (match?.image || product.variants[0]?.image) as string | undefined
  }, [product, selectedColor])

  // Compute real aspect ratio from the actual print area, but always give the editor
  // a reasonable fixed display size (720px wide) so the UI stays usable.
  const editorDisplaySize = useMemo(() => {
    if (!printfilesData || !selectedPlacement || variantIds.length === 0) {
      return { width: 720, height: 820 }
    }

    const pfMap = new Map((printfilesData.printfiles || []).map((p: any) => [p.printfile_id, p]))

    for (const vp of printfilesData.variant_printfiles || []) {
      if (variantIds.includes(vp.variant_id)) {
        const pfId = vp.placements?.[selectedPlacement]
        if (pfId && pfMap.has(pfId)) {
          const pf = pfMap.get(pfId)
          if (pf?.width && pf?.height) {
            const realAspect = pf.height / pf.width
            return {
              width: 720,
              height: Math.round(720 * realAspect),
            }
          }
        }
      }
    }
    return { width: 720, height: 820 }
  }, [printfilesData, selectedPlacement, variantIds])



  // For editing existing saved designs
  const [existingDesignId, setExistingDesignId] = useState<string | null>(null)
  const [originalLogoPath, setOriginalLogoPath] = useState<string | null>(null)

  // Load product from URL param
  useEffect(() => {
    const pid = search.get('productId')
    const designId = search.get('designId')

    if (pid) {
      setIsProductLoading(true)
      setProductId(parseInt(pid))
      loadProduct(parseInt(pid))
    } else if (designId) {
      setIsProductLoading(true)
      loadSavedDesign(designId)
    } else {
      // Nothing to load — show the catalog picker
      setIsProductLoading(false)
    }
  }, [search])

  async function loadProduct(pid: number) {
    setIsProductLoading(true)
    try {
      const res = await fetch(`/api/printful/product/${pid}`)
      if (!res.ok) throw new Error('Failed to load product')
      const data = await res.json()

      setProduct(data.product)
      setColorMap(data.colorMap || {})
      setPlacements(data.placements || [])
      setPrintfilesData(data.printfiles || null)

      // Auto select first color + first placement
      const firstColor = Object.keys(data.colorMap || {})[0]
      if (firstColor) {
        setSelectedColor(firstColor)
        setVariantIds(data.colorMap[firstColor])
      }
      if (data.placements?.length) {
        setSelectedPlacement(data.placements[0].key)
      }
    } catch (e: any) {
      toast.error('Could not load product from Printful: ' + e.message)
      // Set a minimal product object so the UI doesn't completely break
      setProduct({ id: pid, title: 'Product (failed to load details)', variants: [] })
    } finally {
      setIsProductLoading(false)
    }
  }

  async function loadSavedDesign(designId: string) {
    setIsProductLoading(true)
    const { data: design } = await supabase.from('designs').select('*').eq('id', designId).single()
    if (!design) {
      setIsProductLoading(false)
      return
    }

    const d = design as any
    setProductId(d.product_id)
    setNotes(d.notes || '')
    setSelectedPlacement(d.placement)
    setSelectedColor(d.color || '')
    setVariantIds(d.variant_ids || [])
    setCurrentTransform(d.transform)

    setExistingDesignId(designId)
    setOriginalLogoPath(d.logo_path || null)

    await loadProduct(d.product_id)

    // Load the logo from storage for the canvas
    if (d.logo_path) {
      // Generate a signed URL because the bucket is private
      const { data: signed } = await supabase
        .storage
        .from('cqs-assets')
        .createSignedUrl(d.logo_path, 60 * 60) // valid for 1 hour

      if (signed?.signedUrl) {
        setLogoPreviewUrl(signed.signedUrl)
      } else {
        // Fallback (will likely 404 if bucket is private)
        const fallback = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/cqs-assets/${d.logo_path}`
        setLogoPreviewUrl(fallback)
      }
    }
  }

  // When color changes
  useEffect(() => {
    if (selectedColor && colorMap[selectedColor]) {
      setVariantIds(colorMap[selectedColor])
    }
  }, [selectedColor, colorMap])

  // Logo file selected → preview + upload later
  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a PNG or SVG with transparency')
      return
    }
    setLogoFile(file)
    const url = URL.createObjectURL(file)
    setLogoPreviewUrl(url)
  }

  async function generateHighQualityMockups() {
    if (!productId || !variantIds.length || !selectedPlacement || !logoPreviewUrl) {
      toast.error('Select a product, color, placement, and upload a logo first')
      return
    }

    setIsGenerating(true)
    setGeneratedMockups([])

    try {
      // If we have a raw file (new upload), use it. Otherwise try to export the
      // currently positioned version from the Fabric canvas (useful for re-generating
      // after editing a saved design's placement/scale/rotation).
      let logoToSend: File | Blob | null = logoFile
      if (!logoToSend && (window as any).__cqsExportLogo) {
        logoToSend = await (window as any).__cqsExportLogo()
      }
      if (!logoToSend) {
        throw new Error('No logo available to send to Printful')
      }

      const form = new FormData()
      form.append('productId', String(productId))
      form.append('variantIds', JSON.stringify(variantIds))
      form.append('placement', selectedPlacement)
      // The API accepts File or Blob
      form.append('logo', logoToSend as any, (logoToSend as any).name || 'logo.png')

      if (currentTransform) {
        form.append('transform', JSON.stringify(currentTransform))
      }

      const res = await fetch('/api/printful/generate-mockup', {
        method: 'POST',
        body: form,
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')

      setGeneratedMockups(data.mockups || [])
      toast.success(`Generated ${data.mockups?.length || 0} beautiful mockups`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsGenerating(false)
    }
  }

  async function saveToMyFolder() {
    const effectivePlacement = selectedPlacement || (placements[0]?.key ?? '')
    if (!product || !effectivePlacement) {
      toast.error('Product or placement is not fully loaded yet. Please wait a few seconds and try again.')
      return
    }
    setSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')

      let finalLogoPath = originalLogoPath
      let logoRowId = null

      // If user selected a new file this session, upload it
      if (logoFile) {
        finalLogoPath = `logos/${user.id}/${Date.now()}-${logoFile.name}`
        const { error: uploadErr } = await supabase.storage
          .from('cqs-assets')
          .upload(finalLogoPath, logoFile, { upsert: true })
        if (uploadErr) throw uploadErr

        const { data: newLogoRow } = await supabase.from('logos').insert({
          user_id: user.id,
          storage_path: finalLogoPath,
          filename: logoFile.name,
          mime_type: logoFile.type,
          size_bytes: logoFile.size,
        } as any).select().single()

        logoRowId = (newLogoRow as any)?.id || null
      } 
      // If no new file, but we have a preview URL (blob from current session) and no original path (new design)
      else if (!originalLogoPath && logoPreviewUrl) {
        // Fetch the current preview (blob URL) and upload it
        const response = await fetch(logoPreviewUrl)
        const blob = await response.blob()
        const filename = `logo-${Date.now()}.png`
        finalLogoPath = `logos/${user.id}/${filename}`

        const { error: uploadErr } = await supabase.storage
          .from('cqs-assets')
          .upload(finalLogoPath, blob, { upsert: true })
        if (uploadErr) throw uploadErr

        const { data: newLogoRow } = await supabase.from('logos').insert({
          user_id: user.id,
          storage_path: finalLogoPath,
          filename,
          mime_type: blob.type,
          size_bytes: blob.size,
        } as any).select().single()

        logoRowId = (newLogoRow as any)?.id || null
      }
      // Otherwise (editing existing design without changing logo) we reuse originalLogoPath

      // Build payload
      const designPayload: any = {
        user_id: user.id,
        quartet_name: ((await supabase.from('profiles').select('quartet_name').eq('id', user.id).single()).data as any)?.quartet_name,
        product_id: product.id,
        product_title: product.title,
        color: selectedColor,
        placement: effectivePlacement,
        variant_ids: variantIds,
        logo_path: finalLogoPath,
        transform: currentTransform || {},
        notes: notes || null,
        status: 'draft' as const,
        ...(generatedMockups.length > 0 && { mockup_urls: generatedMockups }),
      }

      if (logoRowId) {
        designPayload.logo_id = logoRowId
      }

      let result
      if (existingDesignId) {
        // Update existing design
        const { data, error } = await supabase
          .from('designs')
          .update(designPayload)
          .eq('id', existingDesignId)
          .select()
          .single()
        if (error) throw error
        result = data
        toast.success('Design updated!')
      } else {
        // Create new
        const { data, error } = await supabase.from('designs').insert(designPayload).select().single()
        if (error) throw error
        result = data
        toast.success('Design saved to My Studio!')
      }

      router.push(`/studio?saved=${(result as any).id}`)
    } catch (e: any) {
      toast.error('Save failed: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const canGenerate = !!productId && !!variantIds.length && !!selectedPlacement && !!logoPreviewUrl

  return (
    <div className="max-w-[1100px]">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/studio" className="text-[#6b5f54] hover:text-[#1c1412]"><ArrowLeft /></Link>
        <h1 className="text-3xl font-semibold tracking-tight">Interactive Mockup Editor</h1>
      </div>

      <div className="grid lg:grid-cols-5 gap-8">
        {/* Controls sidebar */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-5">
            <div className="uppercase text-xs tracking-[1.5px] text-[#9b1c1c] mb-3">1. PRODUCT &amp; VARIANT</div>

            {product ? (
              <>
                <div className="mb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-lg font-medium leading-snug">{product.title}</div>
                  </div>
                  {/* Very prominent escape hatch so users never feel locked into a garment they didn't choose */}
                  <Link 
                    href="/studio/catalog" 
                    className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-[#9b1c1c] hover:text-[#b8892a] underline"
                  >
                    ← Pick a different apparel or item
                  </Link>
                </div>

                {/* Color selector */}
                {Object.keys(colorMap).length > 0 && (
                  <div className="mt-4">
                    <label className="text-xs uppercase text-[#9b1c1c] block mb-1.5">Color</label>
                    <select
                      value={selectedColor}
                      onChange={(e) => setSelectedColor(e.target.value)}
                      className="w-full border border-[#d4c5b0] rounded-lg px-4 py-2.5 bg-white"
                    >
                      {Object.keys(colorMap).sort().map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Placement */}
                {placements.length > 0 && (
                  <div className="mt-4">
                    <label className="text-xs uppercase text-[#9b1c1c] block mb-1.5">Placement</label>
                    <select
                      value={selectedPlacement}
                      onChange={(e) => setSelectedPlacement(e.target.value)}
                      className="w-full border border-[#d4c5b0] rounded-lg px-4 py-2.5 bg-white"
                    >
                      {placements.map(p => (
                        <option key={p.key} value={p.key}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Extra safety net: big obvious button to change product even after one is loaded */}
                <div className="mt-4 pt-3 border-t border-[#e8dcc8]">
                  <Link 
                    href="/studio/catalog" 
                    className="block w-full text-center btn-secondary py-2 rounded-xl text-sm"
                  >
                    Browse full catalog for a different item
                  </Link>
                </div>
              </>
            ) : (!mounted || isProductLoading) ? (
              // Before mount (SSR) or while fetching — hold the spinner so catalog never flashes prematurely.
              <div className="py-4 text-center">
                <div className="flex items-center justify-center gap-2 text-sm text-[#6b5f54] mb-3">
                  <RefreshCw className="animate-spin text-[#b8892a]" size={16} />
                  Loading product details…
                </div>
                <Link 
                  href="/studio/catalog" 
                  className="inline-block text-sm font-medium text-[#9b1c1c] hover:underline"
                >
                  ← Cancel and pick a different apparel item instead
                </Link>
              </div>
            ) : (
              // No product selected — show the catalog entry point
              <div className="py-4 text-center border border-dashed border-[#b8892a] rounded-xl bg-[#f9f6f0]">
                <div className="text-sm font-medium text-[#1c1412] mb-2">Pick apparel or an item to begin</div>
                <p className="text-xs text-[#6b5f54] mb-4 px-3">Choose from the full Printful catalog (hundreds of shirts, hoodies, hats, mugs &amp; more).</p>
                <Link href="/studio/catalog" className="btn-primary inline-block px-6 py-2 rounded-xl text-sm">
                  Browse Catalog →
                </Link>
                <div className="mt-3 text-[10px] text-[#8a7660]">You can upload your logo after selecting a product</div>
              </div>
            )}
          </div>

          {/* Logo upload */}
          <div className="card p-5">
            <div className="uppercase text-xs tracking-[1.5px] text-[#9b1c1c] mb-3">2. YOUR LOGO</div>
            {!product && (
              <div className="mb-3 text-[10px] text-[#9b1c1c] bg-white/70 border border-[#d4c5b0] rounded px-2 py-1">
                Select a product in the catalog first — then come back here to place your logo.
              </div>
            )}

            {logoPreviewUrl ? (
              <div className="border-2 border-[#b8892a] rounded-xl p-4 bg-[#f9f6f0]">
                <div className="flex items-center gap-3">
                  <img 
                    src={logoPreviewUrl} 
                    alt="Selected logo" 
                    className="w-16 h-16 object-contain rounded border border-[#d4c5b0] bg-white" 
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#1c1412] truncate">
                      {logoFile?.name || "Selected logo"}
                    </div>
                    <div className="text-xs text-green-700 mt-0.5">✓ Ready — drag on canvas to position</div>
                  </div>
                  <label className="text-xs px-3 py-1.5 border border-[#b8892a] rounded cursor-pointer hover:bg-white transition shrink-0">
                    Change
                    <input 
                      type="file" 
                      accept="image/png,image/svg+xml,image/jpeg" 
                      onChange={handleLogoSelect} 
                      className="hidden" 
                    />
                  </label>
                </div>
              </div>
            ) : (
              <label className="block border-2 border-dashed border-[#b8892a] rounded-xl p-8 text-center cursor-pointer hover:bg-[#f9f6f0] transition">
                <input type="file" accept="image/png,image/svg+xml,image/jpeg" onChange={handleLogoSelect} className="hidden" />
                <ImageIcon className="mx-auto mb-2 text-[#b8892a]" />
                <div className="text-sm font-medium">Upload PNG or SVG with transparency</div>
                <div className="text-xs text-[#8a7660] mt-1">Best results with clean logos</div>
              </label>
            )}
          </div>

          {/* Notes */}
          <div className="card p-5">
            <div className="uppercase text-xs tracking-[1.5px] text-[#9b1c1c] mb-2">3. NOTES FOR TRENT</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Special requests, preferred sizes, rush order, etc."
              className="w-full h-24 border border-[#d4c5b0] rounded-lg p-3 text-sm resize-y"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={generateHighQualityMockups}
              disabled={mounted && (!canGenerate || isGenerating)}
              className="btn-primary w-full py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isGenerating ? <><RefreshCw className="animate-spin" size={18} /> Generating with Printful… (15-25s)</> : 'Generate High-Quality Mockups'}
            </button>

<button
              onClick={saveToMyFolder}
              disabled={mounted && (saving || !logoPreviewUrl || !selectedPlacement || isProductLoading || !product)}
              className="btn-secondary w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save size={17} /> {saving ? 'Saving to My Folder...' : 'Save Design to My Studio'}
            </button>

            {(!product || isProductLoading || !logoPreviewUrl || !selectedPlacement) && (
              <p className="text-xs text-[#9b1c1c] text-center">
                {!product 
                  ? "Pick a product from the catalog first." 
                  : isProductLoading 
                    ? "Loading product details..." 
                    : "Upload a logo and select a placement to enable saving."}
              </p>
            )}

            <Link href="/studio" className="text-center text-sm text-[#6b5f54] hover:text-[#1c1412] py-1">Cancel &amp; return to studio</Link>
          </div>
        </div>

        {/* Canvas + Results */}
        <div className="lg:col-span-3">
          <div className="mb-3 text-sm font-medium text-[#9b1c1c] flex items-center gap-2">
            LIVE PLACEMENT EDITOR <span className="text-[#b8892a] text-xs">(fabric.js)</span>
          </div>

          {!product ? (
            <div className="h-[420px] border border-dashed border-[#d4c5b0] rounded-2xl bg-[#f9f6f0] flex items-center justify-center text-center px-6">
              {(!mounted || isProductLoading) ? (
                <div>
                  <RefreshCw className="animate-spin mx-auto mb-3 text-[#b8892a]" size={22} />
                  <div className="text-sm text-[#6b5f54]">Loading product…</div>
                </div>
              ) : (
                <div>
                  <div className="text-[#b8892a] text-sm tracking-widest mb-2">EDITOR PREVIEW</div>
                  <div className="text-lg font-medium mb-1">Select a product from the catalog</div>
                  <p className="text-sm text-[#6b5f54] max-w-xs mx-auto">The interactive placement canvas will appear here once you pick apparel or an item.</p>
                  <Link href="/studio/catalog" className="inline-block mt-4 btn-secondary px-5 py-2 rounded-xl text-sm">Go to catalog</Link>
                </div>
              )}
            </div>
          ) : (
            <>
              <FabricEditor
                logoUrl={logoPreviewUrl || undefined}
                backgroundImageUrl={selectedVariantImage}
                onTransformChange={setCurrentTransform}
                initialTransform={currentTransform}
                printAreaWidth={editorDisplaySize.width}
                printAreaHeight={editorDisplaySize.height}
              />
            </>
          )}

          {/* Generated results */}
          {generatedMockups.length > 0 && (
            <div className="mt-8">
              <div className="font-semibold mb-3 tracking-tight">Printful Mockups — Ready to Download</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {generatedMockups.map((m, i) => (
                  <div key={i} className="card overflow-hidden">
                    <img src={m.mockup_url} alt="mockup" className="w-full" />
                    <div className="p-3 flex gap-2">
                      <a 
                        href={m.mockup_url} 
                        download 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="btn-secondary flex-1 text-center py-2 text-xs rounded"
                        onClick={(e) => {
                          // Force download without replacing current tab
                          e.preventDefault();
                          const link = document.createElement('a');
                          link.href = m.mockup_url;
                          link.download = `mockup-${i + 1}.jpg`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                      >
                        Download
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-[11px] text-[#8a7660] mt-6 leading-snug">
            Tip: The canvas above shows approximate placement. Clicking “Generate” sends your exact logo + transform to Printful for photoreal mockups on the real product.
          </div>
        </div>
      </div>
    </div>
  )
}
