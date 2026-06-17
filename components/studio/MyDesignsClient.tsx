'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Edit2, Send, Trash2, X, ChevronLeft, ChevronRight, Plus, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Mockup {
  color: string
  mockup_url: string
}

interface Design {
  id: string
  product_title: string
  color: string
  placement: string
  status: string
  notes?: string
  mockup_urls: Mockup[]
  color_variant_map: Record<string, number[]>
}

interface Props {
  designs: Design[]
  showTourTarget?: boolean
}

// ── Color approximation ───────────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  white: '#f5f5f5', black: '#1a1a1a', navy: '#1f3a5f', 'dark navy': '#0f2038',
  red: '#c0392b', 'cardinal red': '#9b1b30', maroon: '#800000', burgundy: '#6d1a2a',
  blue: '#2980b9', 'royal blue': '#2c5fa8', 'carolina blue': '#99badd',
  green: '#27ae60', 'forest green': '#2d5a27', 'military green': '#4a5240', olive: '#6b6e2a',
  yellow: '#f1c40f', gold: '#d4a017', orange: '#e67e22',
  purple: '#6c3d8f', 'dark heather': '#3d3d3d', heather: '#a8a8a8',
  'athletic heather': '#b8b8b8', 'sport grey': '#c0c0c0', grey: '#888888', gray: '#888888',
  'light grey': '#c8c8c8', charcoal: '#444444',
  pink: '#e91e8c', 'hot pink': '#ff69b4', 'light pink': '#ffc0cb',
  teal: '#008b8b', turquoise: '#40e0d0', cream: '#fffdd0', natural: '#f5f0e8',
  brown: '#795548', tan: '#d2b48c', sand: '#c2b280', coral: '#ff7f7f',
  'true royal': '#2c5fa8', 'dark chocolate': '#3b1f0d', 'kelly green': '#4caf50',
}

function swatchColor(name: string): string {
  const lower = name.toLowerCase().trim()
  for (const [key, hex] of Object.entries(COLOR_MAP)) {
    if (lower === key || lower.includes(key)) return hex
  }
  return '#9b8c7a'
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'review_requested' ? 'badge-review'
    : status === 'approved' ? 'badge-approved'
    : status === 'pushed_to_shopify' ? 'badge-pushed'
    : 'badge-draft'
  const label = status === 'pushed_to_shopify' ? 'Pending' : status.replace(/_/g, ' ')
  return <span className={`badge ${cls}`}>{label}</span>
}

// ── Color swatch strip ────────────────────────────────────────────────────────

function ColorStrip({ colors, active, onSelect }: {
  colors: string[]
  active: string
  onSelect: (c: string) => void
}) {
  if (colors.length === 0) return null
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {colors.map(c => (
        <button
          key={c}
          title={c}
          onClick={e => { e.stopPropagation(); onSelect(c) }}
          className={`w-4 h-4 rounded-full border-2 transition-all shrink-0 ${
            c === active ? 'border-[#1c1412] scale-125' : 'border-white/60 hover:border-[#1c1412]/60'
          }`}
          style={{ backgroundColor: swatchColor(c), boxShadow: '0 0 0 1px rgba(0,0,0,0.15)' }}
        />
      ))}
    </div>
  )
}

// ── Expand modal ──────────────────────────────────────────────────────────────

function ExpandModal({
  design,
  initialColor,
  onClose,
  onColorRemoved,
}: {
  design: Design
  initialColor: string
  onClose: () => void
  onColorRemoved: (designId: string, color: string) => void
}) {
  const colors = Object.keys(design.color_variant_map || {})
  const [activeColor, setActiveColor] = useState(initialColor || colors[0] || '')
  const [removing, setRemoving] = useState<string | null>(null)
  const router = useRouter()

  const mockupForColor = (c: string) =>
    design.mockup_urls?.find(m => m.color === c)?.mockup_url ?? null

  const activeMockup = mockupForColor(activeColor)

  async function removeColor(color: string) {
    if (colors.length <= 1) return // can't remove the last color
    setRemoving(color)
    await fetch('/api/studio/remove-color', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ designId: design.id, color }),
    })
    onColorRemoved(design.id, color)
    if (activeColor === color) {
      const remaining = colors.filter(c => c !== color)
      setActiveColor(remaining[0])
    }
    setRemoving(null)
  }

  async function submitForReview() {
    await fetch('/api/studio/request-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ designId: design.id }),
    })
    router.refresh()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div
        className="relative bg-white w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ borderRadius: 6, maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button onClick={onClose} className="absolute top-3 right-3 z-10 p-1.5 text-[#9b8c7a] hover:text-[#1c1412] bg-white/90 transition" style={{ borderRadius: 3 }}>
          <X size={16} />
        </button>

        {/* Mockup image */}
        <div className="bg-[#f0ece6] relative" style={{ aspectRatio: '4/5', maxHeight: '55vh' }}>
          {activeMockup ? (
            <img src={activeMockup} alt={`${design.product_title} — ${activeColor}`} className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              <span className="text-[11px] tracking-[3px] text-[#c4b49f] uppercase">No Mockup</span>
              <Link href={`/studio/editor?designId=${design.id}`} className="text-xs text-[#9b8c7a] underline hover:text-[#1c1412] transition" onClick={onClose}>
                Open editor to generate
              </Link>
            </div>
          )}
          <div className="absolute top-3 left-3">
            <StatusBadge status={design.status} />
          </div>
        </div>

        {/* Details + controls */}
        <div className="p-5 flex-1 overflow-y-auto">
          <div className="mb-1 font-semibold text-[#1c1412] tracking-tight">{design.product_title}</div>
          <div className="text-[12px] text-[#9b8c7a] mb-4">{activeColor} · {design.placement}</div>

          {/* Color selector */}
          {colors.length > 0 && (
            <div className="mb-5">
              <p className="text-[9px] uppercase tracking-[2px] text-[#9b8c7a] font-bold mb-2.5">Colors</p>
              <div className="flex flex-wrap gap-2">
                {colors.map(c => {
                  const hasMockup = !!mockupForColor(c)
                  return (
                    <div key={c} className="flex items-center gap-1 group">
                      <button
                        onClick={() => setActiveColor(c)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium transition-all border ${
                          c === activeColor
                            ? 'bg-[#1c1412] text-white border-[#1c1412]'
                            : 'bg-white text-[#4a3f35] border-[#e8e0d8] hover:border-[#1c1412]'
                        }`}
                        style={{ borderRadius: 3 }}
                        title={hasMockup ? c : `${c} — no mockup yet`}
                      >
                        <span
                          className="w-3 h-3 rounded-full shrink-0 border"
                          style={{
                            backgroundColor: swatchColor(c),
                            borderColor: c === activeColor ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.12)',
                          }}
                        />
                        {c}
                        {!hasMockup && <span className="text-[9px] opacity-50 ml-0.5">•</span>}
                      </button>
                      {colors.length > 1 && (
                        <button
                          onClick={() => removeColor(c)}
                          disabled={!!removing}
                          title={`Remove ${c}`}
                          className="opacity-0 group-hover:opacity-100 transition text-[#9b8c7a] hover:text-[#9b1c1c] p-0.5"
                        >
                          {removing === c
                            ? <span className="text-[9px]">…</span>
                            : <X size={11} />
                          }
                        </button>
                      )}
                    </div>
                  )
                })}
                <Link
                  href={`/studio/editor?designId=${design.id}`}
                  onClick={onClose}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] text-[#9b8c7a] border border-dashed border-[#d4c5b0] hover:border-[#1c1412] hover:text-[#1c1412] transition"
                  style={{ borderRadius: 3 }}
                  title="Add more colors in the editor"
                >
                  <Plus size={11} /> Add color
                </Link>
              </div>
            </div>
          )}

          {design.notes && (
            <p className="text-xs text-[#9b8c7a] italic mb-4">"{design.notes}"</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t border-[#f0ece6]">
            <Link
              href={`/studio/editor?designId=${design.id}`}
              onClick={onClose}
              className="btn-secondary flex-1 py-2.5 text-center text-xs flex items-center justify-center gap-1.5"
            >
              <Edit2 size={13} /> Edit
            </Link>
            {design.status === 'draft' && (
              <button
                data-tour="studio-request-review"
                onClick={submitForReview}
                className="btn-primary flex-1 py-2.5 text-xs flex items-center justify-center gap-1.5"
              >
                <Send size={13} /> Submit for Review
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Design card ───────────────────────────────────────────────────────────────

function DesignCard({
  design,
  selected,
  onToggleSelect,
  onExpand,
  onDelete,
  showTourTarget,
}: {
  design: Design
  selected: boolean
  onToggleSelect: () => void
  onExpand: (color: string) => void
  onDelete: () => void
  showTourTarget?: boolean
}) {
  const colors = Object.keys(design.color_variant_map || {})
  const primaryColor = design.color || colors[0] || ''
  const [activeColor, setActiveColor] = useState(primaryColor)
  const activeMockup = design.mockup_urls?.find(m => m.color === activeColor)?.mockup_url
    ?? design.mockup_urls?.[0]?.mockup_url

  return (
    <div className={`card overflow-hidden flex flex-col relative transition-all group/card ${selected ? 'ring-2 ring-[#1c1412]' : ''}`}>
      {/* Checkbox */}
      <button
        onClick={onToggleSelect}
        className={`absolute top-2 left-2 z-20 w-5 h-5 flex items-center justify-center transition-all border-2 ${
          selected
            ? 'bg-[#1c1412] border-[#1c1412] opacity-100'
            : 'bg-white/80 border-[#d4c5b0] opacity-0 group-hover/card:opacity-100'
        }`}
        style={{ borderRadius: 3 }}
        title={selected ? 'Deselect' : 'Select'}
      >
        {selected && <Check size={11} className="text-white" />}
      </button>

      {/* Mockup image — click to expand */}
      <div
        className="relative overflow-hidden bg-[#f0ece6] cursor-pointer group"
        style={{ aspectRatio: '4/5' }}
        onClick={() => onExpand(activeColor)}
      >
        {activeMockup ? (
          <img
            src={activeMockup}
            alt={design.product_title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1">
            <span className="text-[10px] tracking-[3px] text-[#c4b49f] uppercase">No Mockup Yet</span>
            <span className="text-[10px] text-[#c4b49f]">Open editor to generate</span>
          </div>
        )}
        <div className="absolute top-3 right-3">
          <StatusBadge status={design.status} />
        </div>
      </div>

      <div className="p-3 flex-1 flex flex-col gap-2">
        <div>
          <div className="font-semibold text-[#1c1412] tracking-tight text-sm leading-snug">{design.product_title}</div>
          <div className="text-[11px] text-[#9b8c7a] mt-0.5">{design.placement}</div>
        </div>

        {/* Color swatches */}
        {colors.length > 0 && (
          <ColorStrip
            colors={colors}
            active={activeColor}
            onSelect={setActiveColor}
          />
        )}

        {design.notes && (
          <div className="text-xs line-clamp-1 text-[#9b8c7a] italic">"{design.notes}"</div>
        )}

        {/* Actions */}
        <div className="mt-auto pt-2 flex gap-1.5 flex-wrap border-t border-[#f0ece6]">
          <Link
            href={`/studio/editor?designId=${design.id}`}
            className="btn-secondary flex-1 text-center py-1.5 flex items-center justify-center gap-1 text-[11px]"
          >
            <Edit2 size={12} /> Edit
          </Link>
          {design.status === 'draft' && (
            <button
              {...(showTourTarget ? { 'data-tour': 'studio-request-review' } : {})}
              onClick={() => onExpand(activeColor)}
              className="btn-primary py-1.5 px-3 flex items-center justify-center gap-1 text-[11px]"
            >
              <Send size={12} /> Submit
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1.5 text-[#9b8c7a] hover:text-[#9b1c1c] transition"
            title="Delete design"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function MyDesignsClient({ designs: initialDesigns, showTourTarget }: Props) {
  const [designs, setDesigns] = useState<Design[]>(initialDesigns)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<{ design: Design; color: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === designs.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(designs.map(d => d.id)))
    }
  }

  async function deleteSelected() {
    if (selected.size === 0) return
    setDeleting(true)
    await fetch('/api/studio/delete-designs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selected] }),
    })
    setDesigns(prev => prev.filter(d => !selected.has(d.id)))
    setSelected(new Set())
    setDeleting(false)
  }

  async function deleteSingle(id: string) {
    await fetch('/api/studio/delete-designs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    })
    setDesigns(prev => prev.filter(d => d.id !== id))
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  function handleColorRemoved(designId: string, color: string) {
    setDesigns(prev => prev.map(d => {
      if (d.id !== designId) return d
      const newMap = { ...d.color_variant_map }
      delete newMap[color]
      return {
        ...d,
        mockup_urls: d.mockup_urls.filter(m => m.color !== color),
        color_variant_map: newMap,
        color: d.color === color ? Object.keys(newMap)[0] ?? '' : d.color,
      }
    }))
    if (expanded?.design.id === designId) {
      setExpanded(prev => prev ? {
        ...prev,
        design: designs.find(d => d.id === designId) ?? prev.design,
      } : null)
    }
  }

  if (designs.length === 0) {
    return (
      <div className="card p-16 text-center">
        <p className="text-[#9b8c7a] mb-6 text-sm">No designs yet.</p>
        <Link href="/studio/catalog" className="btn-primary inline-block px-8 py-3">
          Browse the catalog to begin
        </Link>
      </div>
    )
  }

  const allSelected = selected.size === designs.length && designs.length > 0
  const anySelected = selected.size > 0

  return (
    <>
      {/* Selection toolbar */}
      <div className="flex items-center justify-between mb-4 min-h-[28px]">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <div
            onClick={toggleAll}
            className={`w-4 h-4 flex items-center justify-center border-2 transition-all ${
              allSelected ? 'bg-[#1c1412] border-[#1c1412]' : 'bg-white border-[#d4c5b0] hover:border-[#1c1412]'
            }`}
            style={{ borderRadius: 2 }}
          >
            {allSelected && <Check size={9} className="text-white" />}
            {!allSelected && anySelected && <span className="w-1.5 h-1.5 bg-[#1c1412] rounded-sm" />}
          </div>
          <span className="text-[11px] text-[#9b8c7a]">
            {anySelected ? `${selected.size} selected` : 'Select all'}
          </span>
        </label>

        {anySelected && (
          <button
            onClick={deleteSelected}
            disabled={deleting}
            className="flex items-center gap-1.5 text-[11px] text-[#9b1c1c] hover:text-white hover:bg-[#9b1c1c] border border-[#9b1c1c] px-3 py-1.5 transition-all disabled:opacity-50"
            style={{ borderRadius: 3 }}
          >
            <Trash2 size={12} />
            {deleting ? 'Deleting…' : `Delete ${selected.size}`}
          </button>
        )}
      </div>

      {/* Design grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {designs.map((d, i) => (
          <DesignCard
            key={d.id}
            design={d}
            selected={selected.has(d.id)}
            onToggleSelect={() => toggleSelect(d.id)}
            onExpand={color => setExpanded({ design: d, color })}
            onDelete={() => deleteSingle(d.id)}
            showTourTarget={i === 0 && !!showTourTarget}
          />
        ))}
      </div>

      {/* Expand modal */}
      {expanded && (
        <ExpandModal
          design={expanded.design}
          initialColor={expanded.color}
          onClose={() => setExpanded(null)}
          onColorRemoved={handleColorRemoved}
        />
      )}
    </>
  )
}
