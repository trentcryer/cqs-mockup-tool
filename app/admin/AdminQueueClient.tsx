'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Users, Clock } from 'lucide-react'
import CollectionAssigner from './CollectionAssigner'
import MockupThumbnail from './MockupThumbnail'
import PricingModal from './PricingModal'

type SidebarMode = 'group' | 'date'

interface Props {
  designs: any[]
  quartets: any[]
  collections: any[]
  assignAction: (fd: FormData) => Promise<void>
  createAction: (fd: FormData) => Promise<void>
  generateAction: (fd: FormData) => Promise<void>
  approveAction: (fd: FormData) => Promise<void>
  updateStatusAction: (fd: FormData) => Promise<void>
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    review_requested: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-700',
    pushed_to_shopify: 'bg-blue-100 text-blue-700',
  }
  return `inline-block text-[10px] px-2 py-0.5 rounded-full font-medium ${map[status] ?? 'bg-gray-100 text-gray-500'}`
}

function DesignCard({ d, defaultKickback, generateAction, approveAction, updateStatusAction }: {
  d: any
  defaultKickback: number
  generateAction: (fd: FormData) => Promise<void>
  approveAction: (fd: FormData) => Promise<void>
  updateStatusAction: (fd: FormData) => Promise<void>
}) {
  const [showPricing, setShowPricing] = useState(false)
  const firstMockup = (d.mockup_urls as any[])?.[0]?.mockup_url
  const isPublished = d.status === 'pushed_to_shopify'

  return (
    <div className="card p-4 flex gap-4">
      <div className="shrink-0">
        {firstMockup ? (
          <MockupThumbnail src={firstMockup} />
        ) : d.canvas_preview_signed ? (
          <img src={d.canvas_preview_signed} alt="preview"
            className="w-20 h-20 object-cover rounded border border-[#d4c5b0]" />
        ) : (
          <div className="w-20 h-20 rounded border border-[#d4c5b0] bg-[#f9f6f0] flex items-center justify-center text-[10px] text-[#8a7660] text-center px-1">
            no preview
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div>
            <div className="font-medium text-sm">{d.product_title}</div>
            <div className="text-xs text-[#b8892a]">{d.color} · {d.placement}</div>
          </div>
          <span className={statusBadge(d.status)}>{d.status.replace(/_/g, ' ')}</span>
        </div>
        <div className="text-[10px] text-[#8a7660] mb-1">
          Requested {new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
        {d.notes && (
          <div className="text-xs text-[#6b5f54] italic line-clamp-2">"{d.notes}"</div>
        )}
      </div>

      <div className="shrink-0 flex flex-col gap-1.5 min-w-[130px]">
        <Link href={`/admin/editor/${d.id}`}
          className="text-xs text-center px-3 py-1.5 border border-[#d4c5b0] rounded hover:bg-[#f9f6f0] transition">
          Edit Mockup
        </Link>
        {d.profiles?.shopify_collection_id && (
          <Link
            href={`/admin/collections?id=${d.profiles.shopify_collection_id}`}
            className="text-xs text-center px-3 py-1.5 border border-[#b8892a] text-[#b8892a] rounded hover:bg-[#f9f6f0] transition"
          >
            Go to Collection
          </Link>
        )}
        {!isPublished && (
          <form action={generateAction}>
            <input type="hidden" name="designId" value={d.id} />
            <button type="submit" disabled={!d.logo_path}
              className="w-full text-xs px-3 py-1.5 bg-[#1c1412] text-white rounded disabled:opacity-40 hover:bg-[#3a2820] transition">
              Generate Mockup
            </button>
          </form>
        )}
        {!isPublished && (
          <button
            onClick={() => setShowPricing(true)}
            disabled={!firstMockup}
            title={!firstMockup ? 'Generate a mockup first' : ''}
            className="w-full text-xs px-3 py-1.5 bg-[#9b1c1c] text-white rounded disabled:opacity-40 hover:bg-[#7a1616] transition"
          >
            Approve &amp; Publish
          </button>
        )}
        {d.status !== 'draft' && !isPublished && (
          <form action={updateStatusAction}>
            <input type="hidden" name="designId" value={d.id} />
            <input type="hidden" name="status" value="draft" />
            <button className="text-[10px] text-[#8a7660] underline w-full text-center">Revert to draft</button>
          </form>
        )}
        {d.shopify_product_url && (
          <a href={d.shopify_product_url} target="_blank" rel="noreferrer"
            className="text-[10px] text-[#b8892a] underline text-center">
            View in Shopify →
          </a>
        )}
      </div>

      {showPricing && (
        <PricingModal
          design={d}
          defaultKickback={defaultKickback}
          approveAction={approveAction}
          onClose={() => setShowPricing(false)}
        />
      )}
    </div>
  )
}

export default function AdminQueueClient({
  designs, quartets, collections,
  assignAction, createAction, generateAction, approveAction, updateStatusAction,
}: Props) {
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('group')
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [selectedDesignId, setSelectedDesignId] = useState<string | null>(null)

  // Groups with pending designs, sorted by oldest request
  const pendingGroups = useMemo(() => {
    const pending = designs.filter(d => d.status === 'review_requested')
    const byGroup: Record<string, { userId: string; name: string; email: string; designs: any[] }> = {}
    for (const d of pending) {
      const uid = d.user_id
      if (!byGroup[uid]) {
        byGroup[uid] = {
          userId: uid,
          name: d.profiles?.quartet_name || d.quartet_name || 'Unknown',
          email: d.profiles?.email || '',
          designs: [],
        }
      }
      byGroup[uid].designs.push(d)
    }
    return Object.values(byGroup)
      .map(g => ({
        ...g,
        designs: g.designs.sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ),
        oldestRequest: new Date(Math.min(...g.designs.map(d => new Date(d.created_at).getTime()))),
      }))
      .sort((a, b) => a.oldestRequest.getTime() - b.oldestRequest.getTime())
  }, [designs])

  // All pending sorted by date oldest first
  const pendingByDate = useMemo(() =>
    designs
      .filter(d => d.status === 'review_requested')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [designs]
  )

  const selectedGroup = pendingGroups.find(g => g.userId === selectedGroupId)
  const selectedQuartet = quartets.find(q => q.id === selectedGroupId)
  const selectedDesign = pendingByDate.find(d => d.id === selectedDesignId)
  const selectedDesignQuartet = selectedDesign
    ? quartets.find(q => q.id === selectedDesign.user_id)
    : null

  const totalPending = pendingByDate.length

  // Determine which quartet to show in the collection assigner
  const activeQuartet = sidebarMode === 'group' ? selectedQuartet
    : sidebarMode === 'date' ? selectedDesignQuartet
    : null

  return (
    <div className="space-y-4">

      {/* ── Shopify Collection — separate section above the queue ── */}
      {activeQuartet && (
        <div className="card p-5">
          <div className="text-xs uppercase tracking-widest text-[#9b1c1c] mb-3">
            Shopify Collection
            <span className="ml-2 normal-case font-normal text-[#6b5f54]">— {activeQuartet.quartet_name}</span>
          </div>
          <CollectionAssigner
            userId={activeQuartet.id}
            quartetName={activeQuartet.quartet_name || 'Quartet'}
            currentCollectionId={activeQuartet.shopify_collection_id}
            currentCollectionTitle={activeQuartet.shopify_collection_title}
            collections={collections}
            assignAction={assignAction}
            createAction={createAction}
          />
        </div>
      )}

    <div className="flex gap-5 min-h-[600px]">

      {/* ── Sidebar ── */}
      <aside className="w-56 shrink-0 bg-[#1c1412] flex flex-col rounded-xl overflow-hidden border border-[#1c1412]">

        {/* Sidebar header + toggle */}
        <div className="px-4 pt-3 pb-2 border-b border-white/10">
          <div className="text-[10px] uppercase tracking-widest text-[#b8892a] mb-2">Review Queue</div>
          <div className="flex rounded-md overflow-hidden border border-white/20 text-[10px]">
            <button
              onClick={() => setSidebarMode('group')}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 transition ${
                sidebarMode === 'group' ? 'bg-[#b8892a] text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Users size={10} /> By Group
            </button>
            <button
              onClick={() => setSidebarMode('date')}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 border-l border-white/20 transition ${
                sidebarMode === 'date' ? 'bg-[#b8892a] text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Clock size={10} /> By Date
            </button>
          </div>
          <div className="text-[10px] text-white/40 mt-1.5">
            {sidebarMode === 'group'
              ? `${pendingGroups.length} group${pendingGroups.length !== 1 ? 's' : ''} pending`
              : `${totalPending} request${totalPending !== 1 ? 's' : ''} · oldest first`}
          </div>
        </div>

        {/* Sidebar list */}
        <div className="flex-1 overflow-y-auto py-1">
          {totalPending === 0 && (
            <div className="px-4 py-6 text-center text-xs text-white/40">No pending requests</div>
          )}

          {/* BY GROUP */}
          {sidebarMode === 'group' && pendingGroups.map(g => (
            <button
              key={g.userId}
              onClick={() => setSelectedGroupId(g.userId)}
              className={`w-full text-left px-4 py-3 transition border-l-2 ${
                selectedGroupId === g.userId
                  ? 'bg-white/10 border-[#b8892a]'
                  : 'border-transparent hover:bg-white/5'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm text-white font-medium truncate">{g.name}</div>
                <span className="shrink-0 text-[10px] bg-[#9b1c1c] text-white rounded-full px-1.5 py-0.5">
                  {g.designs.length}
                </span>
              </div>
              <div className="text-[10px] text-white/40 mt-0.5">
                Since {g.oldestRequest.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </button>
          ))}

          {/* BY DATE */}
          {sidebarMode === 'date' && pendingByDate.map(d => (
            <button
              key={d.id}
              onClick={() => setSelectedDesignId(d.id)}
              className={`w-full text-left px-4 py-2.5 transition border-l-2 ${
                selectedDesignId === d.id
                  ? 'bg-white/10 border-[#b8892a]'
                  : 'border-transparent hover:bg-white/5'
              }`}
            >
              <div className="text-xs text-white font-medium truncate">
                {d.profiles?.quartet_name || d.quartet_name}
              </div>
              <div className="text-[10px] text-white/60 truncate mt-0.5">{d.product_title}</div>
              <div className="text-[10px] text-white/30 mt-0.5">
                {new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#faf7f2] rounded-xl overflow-hidden border border-[#d4c5b0]">

        {/* Toolbar */}
        <div className="flex items-center px-5 py-3 border-b border-[#e8dcc8] bg-white min-h-[49px]">
          {sidebarMode === 'group' && selectedGroup && (
            <div className="text-sm font-medium text-[#1c1412]">
              {selectedGroup.name}
              <span className="text-xs text-[#8a7660] font-normal ml-2">{selectedGroup.email}</span>
              <span className="text-xs text-[#b8892a] ml-2">{selectedGroup.designs.length} pending</span>
            </div>
          )}
          {sidebarMode === 'date' && selectedDesign && (
            <div className="text-sm font-medium text-[#1c1412]">
              {selectedDesign.profiles?.quartet_name || selectedDesign.quartet_name}
              <span className="text-xs text-[#8a7660] font-normal ml-2">
                {selectedDesign.product_title} · {new Date(selectedDesign.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          )}
          {!selectedGroup && sidebarMode === 'group' && (
            <div className="text-xs text-[#8a7660]">Select a group from the sidebar</div>
          )}
          {!selectedDesign && sidebarMode === 'date' && (
            <div className="text-xs text-[#8a7660]">Select a request from the sidebar</div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* GROUP MODE */}
          {sidebarMode === 'group' && (
            !selectedGroup ? (
              <div className="flex items-center justify-center h-40 text-sm text-[#8a7660]">
                {pendingGroups.length === 0
                  ? 'No pending review requests.'
                  : 'Select a group from the sidebar to review their requests.'}
              </div>
            ) : (
              selectedGroup.designs.map(d => (
                <DesignCard key={d.id} d={d}
                  defaultKickback={selectedQuartet?.kickback_percentage ?? 0}
                  generateAction={generateAction}
                  approveAction={approveAction}
                  updateStatusAction={updateStatusAction}
                />
              ))
            )
          )}

          {/* DATE MODE */}
          {sidebarMode === 'date' && (
            !selectedDesign ? (
              <div className="flex items-center justify-center h-40 text-sm text-[#8a7660]">
                {totalPending === 0
                  ? 'No pending review requests.'
                  : 'Select a request from the sidebar.'}
              </div>
            ) : (
              <DesignCard d={selectedDesign}
                defaultKickback={selectedDesignQuartet?.kickback_percentage ?? 0}
                generateAction={generateAction}
                approveAction={approveAction}
                updateStatusAction={updateStatusAction}
              />
            )
          )}
        </div>
      </div>
    </div>
    </div>
  )
}
