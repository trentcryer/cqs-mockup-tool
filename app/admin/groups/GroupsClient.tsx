'use client'

import { useState, useTransition } from 'react'
import { Loader2, Plus, Copy, Check, Trash2, CheckCircle2, AlertCircle, Link2, RefreshCw, Paintbrush } from 'lucide-react'

export interface CollectionRow {
  id: number
  title: string
  handle: string
  account: {
    id: string
    email: string
    quartet_name: string
    design_count: number
    created_at: string
  } | null
}

interface Props {
  collections: CollectionRow[]
  createCollectionAction: (fd: FormData) => Promise<{ magicLink: string; collectionTitle: string } | { error: string }>
  assignEmailAction: (fd: FormData) => Promise<{ magicLink: string; collectionTitle: string } | { error: string }>
  generateLinkAction: (fd: FormData) => Promise<{ magicLink: string } | { error: string }>
  deleteAction: (fd: FormData) => Promise<void>
  bulkDeleteAction: (fd: FormData) => Promise<void>
}

// ── Helpers ──────────────────────────────────────────────────────

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[#d4c5b0] hover:bg-[#f0e8d8] transition"
    >
      {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
      {copied ? 'Copied!' : label}
    </button>
  )
}

function MagicLinkBanner({ link, title, onDismiss }: { link: string; title: string; onDismiss: () => void }) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-green-800">
            Sign-in link ready for <span className="font-bold">{title}</span>
          </p>
          <p className="text-xs text-green-600 mt-0.5">Send this link to the group — it signs them straight in. Expires in 1 hour.</p>
        </div>
        <button onClick={onDismiss} className="text-xs text-green-600 hover:underline shrink-0">Dismiss</button>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-white border border-green-200 rounded-lg px-3 py-2 text-xs font-mono text-green-900 truncate">{link}</div>
        <CopyButton text={link} label="Copy Link" />
      </div>
    </div>
  )
}

function formatDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Bulk Delete Bar ───────────────────────────────────────────────

function BulkDeleteBar({ count, onDelete, isPending }: { count: number; onDelete: () => void; isPending: boolean }) {
  const [confirm, setConfirm] = useState(false)

  if (count === 0) return null

  return (
    <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
      <span className="text-sm text-red-700 font-medium">{count} selected</span>
      {confirm ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-red-600">Delete {count} group{count !== 1 ? 's' : ''}?</span>
          <button
            onClick={() => { onDelete(); setConfirm(false) }}
            disabled={isPending}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[#9b1c1c] text-white rounded-lg disabled:opacity-50"
          >
            {isPending ? <Loader2 size={11} className="animate-spin" /> : null}
            Yes, delete
          </button>
          <button onClick={() => setConfirm(false)} className="text-xs px-3 py-1.5 border border-red-200 rounded-lg text-red-600">Cancel</button>
        </div>
      ) : (
        <button
          onClick={() => setConfirm(true)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[#9b1c1c] text-white rounded-lg hover:bg-red-800 transition"
        >
          <Trash2 size={12} /> Delete Selected
        </button>
      )}
    </div>
  )
}

// ── Create New Collection ─────────────────────────────────────────

function CreateCollectionCard({ createCollectionAction }: { createCollectionAction: Props['createCollectionAction'] }) {
  const [isPending, startTransition] = useTransition()
  const [collectionName, setCollectionName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ magicLink: string; collectionTitle: string } | null>(null)

  function handleSubmit() {
    if (!collectionName.trim() || !email.trim()) return
    setError(null)
    const fd = new FormData()
    fd.set('collectionTitle', collectionName.trim())
    fd.set('email', email.trim())
    startTransition(async () => {
      const res = await createCollectionAction(fd)
      if ('error' in res) { setError(res.error) } else { setResult(res); setCollectionName(''); setEmail('') }
    })
  }

  return (
    <div className="bg-white border border-[#e8dcc8] rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#e8dcc8] bg-[#faf7f2]">
        <h2 className="text-sm font-semibold text-[#1c1412] flex items-center gap-2">
          <Plus size={15} className="text-[#1c1412]" /> Create New Collection
        </h2>
        <p className="text-xs text-[#6b5f54] mt-0.5">Creates the Shopify collection, the studio account, and a sign-in link — all at once.</p>
      </div>
      <div className="px-5 py-4 space-y-4">
        {result && <MagicLinkBanner link={result.magicLink} title={result.collectionTitle} onDismiss={() => setResult(null)} />}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-[#6b5f54]">Collection Name</label>
            <input type="text" value={collectionName} onChange={e => setCollectionName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
              placeholder="e.g. Trent's Trio"
              className="w-full border border-[#e8e0d8] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#1c1412]/30" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[#6b5f54]">Group Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
              placeholder="group@example.com"
              className="w-full border border-[#e8e0d8] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#1c1412]/30" />
          </div>
        </div>
        {error && <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
        <button onClick={handleSubmit} disabled={isPending || !collectionName.trim() || !email.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-[#1c1412] text-white text-sm disabled:opacity-40 transition" style={{ borderRadius: 4 }}>
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          {isPending ? 'Creating…' : 'Create Collection & Generate Link'}
        </button>
      </div>
    </div>
  )
}

// ── Needs Account Row ─────────────────────────────────────────────

function AssignEmailRow({ collection, isSelected, onToggle, assignEmailAction, deleteAction }: {
  collection: CollectionRow
  isSelected: boolean
  onToggle: () => void
  assignEmailAction: Props['assignEmailAction']
  deleteAction: Props['deleteAction']
}) {
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ magicLink: string; collectionTitle: string } | null>(null)

  function handleAssign() {
    if (!email.trim()) return
    setError(null)
    const fd = new FormData()
    fd.set('collectionId', String(collection.id))
    fd.set('collectionTitle', collection.title)
    fd.set('email', email.trim())
    startTransition(async () => {
      const res = await assignEmailAction(fd)
      if ('error' in res) { setError(res.error) } else { setResult(res); setOpen(false); setEmail('') }
    })
  }

  function handleDelete() {
    const fd = new FormData()
    fd.set('collectionId', String(collection.id))
    startTransition(async () => { await deleteAction(fd); setConfirmDelete(false) })
  }

  return (
    <div>
      <div className="flex items-center gap-3 px-5 py-3.5">
        <input type="checkbox" checked={isSelected} onChange={onToggle}
          className="w-4 h-4 rounded border-[#e8e0d8] accent-[#1c1412] cursor-pointer shrink-0" />
        <AlertCircle size={15} className="text-amber-400 shrink-0" />
        <div className="flex-1 font-medium text-sm text-[#1c1412]">{collection.title}</div>
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-600">Delete?</span>
            <button onClick={handleDelete} disabled={isPending} className="text-xs px-2 py-1 bg-[#9b1c1c] text-white rounded">Yes</button>
            <button onClick={() => setConfirmDelete(false)} className="text-xs px-2 py-1 border border-[#d4c5b0] rounded">No</button>
          </div>
        ) : open ? (
          <button onClick={() => setOpen(false)} className="text-xs text-[#8a7660] hover:underline">Cancel</button>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={() => setOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1c1412] text-white text-xs rounded-lg hover:bg-[#2d201c] transition">
              <Link2 size={12} /> Assign Email
            </button>
            <button onClick={() => setConfirmDelete(true)} className="text-[#c4b49f] hover:text-[#9b8c7a] transition">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {result && (
        <div className="px-5 pb-4">
          <MagicLinkBanner link={result.magicLink} title={result.collectionTitle} onDismiss={() => setResult(null)} />
        </div>
      )}

      {open && (
        <div className="px-5 pb-4 bg-[#faf7f2] border-t border-[#e8dcc8] space-y-3 pt-3">
          <p className="text-xs text-[#6b5f54]">Enter the email for <strong>{collection.title}</strong>. A one-click sign-in link will be generated.</p>
          <div className="flex gap-2">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAssign() }}
              placeholder="group@example.com" autoFocus
              className="flex-1 border border-[#e8e0d8] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#1c1412]/30" />
            <button onClick={handleAssign} disabled={isPending || !email.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#1c1412] text-white text-sm disabled:opacity-40 transition whitespace-nowrap" style={{ borderRadius: 4 }}>
              {isPending ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
              Generate Link
            </button>
          </div>
          {error && <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
        </div>
      )}
    </div>
  )
}

// ── Active Account Row ────────────────────────────────────────────

function ActiveAccountRow({ collection, isSelected, onToggle, generateLinkAction, deleteAction }: {
  collection: CollectionRow
  isSelected: boolean
  onToggle: () => void
  generateLinkAction: Props['generateLinkAction']
  deleteAction: Props['deleteAction']
}) {
  const [isPending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [magicLink, setMagicLink] = useState<string | null>(null)

  function handleResendLink() {
    const fd = new FormData()
    fd.set('email', collection.account!.email)
    startTransition(async () => {
      const res = await generateLinkAction(fd)
      if ('magicLink' in res) setMagicLink(res.magicLink)
    })
  }

  function handleDelete() {
    const fd = new FormData()
    fd.set('userId', collection.account!.id)
    fd.set('collectionId', String(collection.id))
    startTransition(async () => { await deleteAction(fd); setConfirmDelete(false) })
  }

  return (
    <>
      <tr className="hover:bg-[#faf7f2] transition-colors">
        <td className="px-5 py-3 w-8">
          <input type="checkbox" checked={isSelected} onChange={onToggle}
            className="w-4 h-4 rounded border-[#e8e0d8] accent-[#1c1412] cursor-pointer" />
        </td>
        <td className="px-5 py-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-green-500 shrink-0" />
            <span className="font-medium text-sm text-[#1c1412]">{collection.title}</span>
          </div>
        </td>
        <td className="px-5 py-3 text-[#6b5f54] font-mono text-xs">{collection.account!.email}</td>
        <td className="px-5 py-3 text-center tabular-nums text-[#6b5f54] text-sm">{collection.account!.design_count}</td>
        <td className="px-5 py-3 text-xs text-[#8a7660]">{formatDate(collection.account!.created_at)}</td>
        <td className="px-5 py-3 text-right w-56">
          <div className="flex items-center justify-end gap-2 flex-nowrap">
            {confirmDelete ? (
              <>
                <span className="text-xs text-red-600">Delete?</span>
                <button onClick={handleDelete} disabled={isPending} className="text-xs px-2 py-1 bg-[#9b1c1c] text-white rounded">Yes</button>
                <button onClick={() => setConfirmDelete(false)} className="text-xs px-2 py-1 border border-[#d4c5b0] rounded">No</button>
              </>
            ) : (
              <>
                <a
                  href={`/studio/catalog?asUser=${collection.account!.id}`}
                  className="flex items-center gap-1 text-xs text-white bg-[#1c1412] hover:bg-[#2d201c] border border-[#1c1412] rounded-lg px-2 py-1 transition"
                >
                  <Paintbrush size={11} /> Add Product
                </a>
                <button onClick={handleResendLink} disabled={isPending} title="Generate new sign-in link"
                  className="flex items-center gap-1 text-xs text-[#6b5f54] hover:text-[#1c1412] border border-[#d4c5b0] rounded-lg px-2 py-1 transition disabled:opacity-40">
                  {isPending ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                  New Link
                </button>
                <button onClick={() => setConfirmDelete(true)} className="text-[#c4b49f] hover:text-[#9b8c7a] transition">
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
      {magicLink && (
        <tr>
          <td colSpan={6} className="px-5 pb-3">
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <span className="text-xs text-green-700 font-mono truncate flex-1">{magicLink}</span>
              <CopyButton text={magicLink} label="Copy Link" />
              <button onClick={() => setMagicLink(null)} className="text-xs text-green-600 hover:underline ml-1">✕</button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Main component ────────────────────────────────────────────────

export default function GroupsClient({ collections, createCollectionAction, assignEmailAction, generateLinkAction, deleteAction, bulkDeleteAction }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkPending, startBulkTransition] = useTransition()

  const withAccount = collections.filter(c => c.account)
  const withoutAccount = collections.filter(c => !c.account)

  function toggle(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll(rows: CollectionRow[]) {
    const allIds = rows.map(r => r.id)
    const allSelected = allIds.every(id => selectedIds.has(id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allSelected) { allIds.forEach(id => next.delete(id)) }
      else { allIds.forEach(id => next.add(id)) }
      return next
    })
  }

  function handleBulkDelete() {
    const items = collections
      .filter(c => selectedIds.has(c.id))
      .map(c => ({ collectionId: c.id, userId: c.account?.id }))
    const fd = new FormData()
    fd.set('items', JSON.stringify(items))
    startBulkTransition(async () => {
      await bulkDeleteAction(fd)
      setSelectedIds(new Set())
    })
  }

  const selectedCount = selectedIds.size
  const noAccountSelectedCount = withoutAccount.filter(c => selectedIds.has(c.id)).length
  const withAccountSelectedCount = withAccount.filter(c => selectedIds.has(c.id)).length

  return (
    <div className="space-y-6">

      <CreateCollectionCard createCollectionAction={createCollectionAction} />

      <div className="flex items-center gap-4 text-sm text-[#6b5f54]">
        <span><span className="font-semibold text-[#1c1412]">{withAccount.length}</span> of {collections.length} collections have accounts</span>
        {withoutAccount.length > 0 && <span className="text-amber-600 font-medium">{withoutAccount.length} still need accounts</span>}
      </div>

      {/* Needs Account */}
      {withoutAccount.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={withoutAccount.length > 0 && withoutAccount.every(c => selectedIds.has(c.id))}
                onChange={() => toggleAll(withoutAccount)}
                className="w-4 h-4 rounded border-[#e8e0d8] accent-[#1c1412] cursor-pointer"
              />
              <h2 className="text-[9px] uppercase tracking-[2px] font-bold text-amber-600">Needs Account</h2>
            </label>
            {noAccountSelectedCount > 0 && (
              <BulkDeleteBar count={noAccountSelectedCount} onDelete={handleBulkDelete} isPending={bulkPending} />
            )}
          </div>
          <div className="bg-white rounded-xl border border-[#e8dcc8] overflow-hidden divide-y divide-[#f0e8d8]">
            {withoutAccount.map(c => (
              <AssignEmailRow
                key={c.id}
                collection={c}
                isSelected={selectedIds.has(c.id)}
                onToggle={() => toggle(c.id)}
                assignEmailAction={assignEmailAction}
                deleteAction={deleteAction}
              />
            ))}
          </div>
        </div>
      )}

      {/* Active Accounts */}
      {withAccount.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={withAccount.length > 0 && withAccount.every(c => selectedIds.has(c.id))}
                onChange={() => toggleAll(withAccount)}
                className="w-4 h-4 rounded border-[#e8e0d8] accent-[#1c1412] cursor-pointer"
              />
              <h2 className="eyebrow">Active Accounts</h2>
            </label>
            {withAccountSelectedCount > 0 && (
              <BulkDeleteBar count={withAccountSelectedCount} onDelete={handleBulkDelete} isPending={bulkPending} />
            )}
          </div>
          <div className="bg-white rounded-xl border border-[#e8dcc8] overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-[#e8dcc8] bg-[#faf7f2] text-left">
                  <th className="px-5 py-3 w-8" />
                  <th className="px-5 py-3 text-[10px] uppercase tracking-widest text-[#8a7660] font-medium">Collection</th>
                  <th className="px-5 py-3 text-[10px] uppercase tracking-widest text-[#8a7660] font-medium">Login Email</th>
                  <th className="px-5 py-3 text-[10px] uppercase tracking-widest text-[#8a7660] font-medium text-center">Designs</th>
                  <th className="px-5 py-3 text-[10px] uppercase tracking-widest text-[#8a7660] font-medium">Created</th>
                  <th className="px-5 py-3 w-56" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0e8d8]">
                {withAccount.map(c => (
                  <ActiveAccountRow
                    key={c.id}
                    collection={c}
                    isSelected={selectedIds.has(c.id)}
                    onToggle={() => toggle(c.id)}
                    generateLinkAction={generateLinkAction}
                    deleteAction={deleteAction}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {collections.length === 0 && (
        <div className="bg-white border border-[#e8dcc8] rounded-xl p-12 text-center text-sm text-[#8a7660]">
          No Shopify collections found. Check your Shopify credentials.
        </div>
      )}
    </div>
  )
}
