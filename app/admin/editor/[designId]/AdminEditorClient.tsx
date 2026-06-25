'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { RefreshCw, X } from 'lucide-react'
import type { PrintfulTemplate } from '@/lib/printful'

interface Props {
  design: any
  canvasPreviewUrl: string | null
  logoSignedUrl: string | null
  template: PrintfulTemplate | null
}

export default function AdminEditorClient({ design, canvasPreviewUrl, logoSignedUrl, template }: Props) {
  const t = design.transform || {}

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

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/admin" className="text-sm text-[#6b5f54] hover:underline">← Admin</Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {design.quartet_name} — {design.product_title}
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
            const origNormH = ct.normHeight || origNormW
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
                {template.background_url && (
                  <img src={template.background_url} alt=""
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    style={{ mixBlendMode: 'multiply' }} />
                )}
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

              {/* Logo positioned within the print area */}
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

              {/* Fabric detail/shadow overlay on top */}
              {template.background_url && (
                <img
                  src={template.background_url}
                  alt=""
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{ mixBlendMode: 'multiply' }}
                />
              )}
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
            <input
              type="range" min={0} max={100} value={centerX}
              onChange={e => setCenterX(parseInt(e.target.value))}
              className="w-full accent-[#1c1412]"
            />
          </div>
          <div>
            <div className="flex justify-between text-xs text-[#6b5f54] mb-1.5">
              <span>Up ↑ ↓ Down</span>
              <span>{centerY}%</span>
            </div>
            <input
              type="range" min={0} max={100} value={centerY}
              onChange={e => setCenterY(parseInt(e.target.value))}
              className="w-full accent-[#1c1412]"
            />
          </div>
          <div>
            <div className="flex justify-between text-xs text-[#6b5f54] mb-1.5">
              <span>Logo Size</span>
              <span>{logoSize}%</span>
            </div>
            <input
              type="range" min={5} max={90} value={logoSize}
              onChange={e => setLogoSize(parseInt(e.target.value))}
              className="w-full accent-[#1c1412]"
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      {design.notes && (
        <div className="text-sm text-[#6b5f54] bg-[#f9f6f0] rounded-xl px-4 py-3 border border-[#e8dcc8]">
          <span className="font-medium text-[#1c1412]">Customer notes: </span>{design.notes}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={regenerate}
          disabled={isGenerating}
          className="btn-primary px-8 py-3 rounded-xl flex items-center gap-2 disabled:opacity-50"
        >
          {isGenerating
            ? <><RefreshCw className="animate-spin" size={16} /> Generating… (10–20s)</>
            : 'Generate Mockup'}
        </button>
        <Link href="/admin" className="btn-secondary px-6 py-3 rounded-xl">
          Back to Admin
        </Link>
      </div>

      <p className="text-xs text-[#8a7660]">
        Use the Live Preview to position the logo, then hit <strong>Generate Mockup</strong> once for the photorealistic Printful render.
      </p>

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
