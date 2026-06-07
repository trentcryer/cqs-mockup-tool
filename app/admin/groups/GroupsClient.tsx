'use client'

import { useState, useTransition } from 'react'
import { Loader2, Plus, Copy, Check, Trash2, Users } from 'lucide-react'

export interface GroupRow {
  id: string
  email: string
  quartet_name: string
  shopify_collection_title: string | null
  created_at: string
  design_count: number
}

interface Props {
  groups: GroupRow[]
  createAction: (fd: FormData) => Promise<{ email: string; password: string } | { error: string }>
  deleteAction: (fd: FormData) => Promise<void>
  updateNameAction: (fd: FormData) => Promise<void>
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="ml-1 text-[#8a7660] hover:text-[#1c1412] transition"
    >
      {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
    </button>
  )
}

export default function GroupsClient({ groups: initial, createAction, deleteAction, updateNameAction }: Props) {
  const [groups, setGroups] = useState<GroupRow[]>(initial)
  const [showCreate, setShowCreate] = useState(false)
  const [newCreds, setNewCreds] = useState<{ email: string; password: string } | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Create form state
  const [quartetName, setQuartetName] = useState('')
  const [email, setEmail] = useState('')

  // Delete confirm
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Inline name editing
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  function handleCreate() {
    if (!quartetName.trim() || !email.trim()) return
    setCreateError(null)
    const fd = new FormData()
    fd.set('quartetName', quartetName.trim())
    fd.set('email', email.trim().toLowerCase())
    startTransition(async () => {
      const result = await createAction(fd)
      if ('error' in result) {
        setCreateError(result.error)
      } else {
        setNewCreds(result)
        setQuartetName('')
        setEmail('')
        setShowCreate(false)
      }
    })
  }

  function handleDelete(id: string) {
    const fd = new FormData()
    fd.set('userId', id)
    startTransition(async () => {
      await deleteAction(fd)
      setGroups(prev => prev.filter(g => g.id !== id))
      setConfirmDeleteId(null)
    })
  }

  function handleUpdateName(id: string) {
    if (!editingName.trim()) return
    const fd = new FormData()
    fd.set('userId', id)
    fd.set('quartetName', editingName.trim())
    startTransition(async () => {
      await updateNameAction(fd)
      setGroups(prev => prev.map(g => g.id === id ? { ...g, quartet_name: editingName.trim() } : g))
      setEditingId(null)
    })
  }

  return (
    <div className="space-y-5">

      {/* Credentials banner */}
      {newCreds && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 space-y-2">
          <div className="text-sm font-semibold text-green-800">Account created — share these credentials:</div>
          <div className="flex items-center gap-2 text-sm font-mono text-green-900">
            <span className="text-green-600 text-xs w-16">Email</span>
            {newCreds.email}
            <CopyButton text={newCreds.email} />
          </div>
          <div className="flex items-center gap-2 text-sm font-mono text-green-900">
            <span className="text-green-600 text-xs w-16">Password</span>
            {newCreds.password}
            <CopyButton text={newCreds.password} />
          </div>
          <button onClick={() => setNewCreds(null)} className="text-xs text-green-600 hover:underline">Dismiss</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-[#6b5f54]">{groups.length} group{groups.length !== 1 ? 's' : ''} registered</div>
        <button
          onClick={() => { setShowCreate(v => !v); setCreateError(null) }}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1c1412] text-white text-sm rounded-xl hover:bg-[#2d201c] transition"
        >
          <Plus size={14} /> New Group
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-[#faf7f2] border border-[#e8dcc8] rounded-xl p-5 space-y-4">
          <div className="text-sm font-semibold">Create Group Account</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-[#6b5f54]">Quartet / Group Name</label>
              <input
                type="text"
                value={quartetName}
                onChange={e => setQuartetName(e.target.value)}
                placeholder="e.g. The Chord Busters"
                className="w-full border border-[#d4c5b0] rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#b8892a]/60"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[#6b5f54]">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="quartet@example.com"
                className="w-full border border-[#d4c5b0] rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#b8892a]/60"
              />
            </div>
          </div>
          <div className="text-xs text-[#8a7660]">A secure temporary password will be generated automatically.</div>
          {createError && <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{createError}</div>}
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={isPending || !quartetName.trim() || !email.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#9b1c1c] text-white text-sm rounded-xl disabled:opacity-40 transition"
            >
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Create Account
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border border-[#d4c5b0] rounded-xl hover:bg-white transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Groups table */}
      {groups.length === 0 ? (
        <div className="bg-white border border-[#e8dcc8] rounded-xl p-12 text-center">
          <Users size={32} className="mx-auto text-[#d4c5b0] mb-3" />
          <div className="text-sm text-[#8a7660]">No groups yet. Create one above.</div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#e8dcc8] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e8dcc8] bg-[#faf7f2] text-left">
                <th className="px-5 py-3 text-[10px] uppercase tracking-widest text-[#8a7660] font-medium">Group</th>
                <th className="px-5 py-3 text-[10px] uppercase tracking-widest text-[#8a7660] font-medium">Email</th>
                <th className="px-5 py-3 text-[10px] uppercase tracking-widest text-[#8a7660] font-medium">Collection</th>
                <th className="px-5 py-3 text-[10px] uppercase tracking-widest text-[#8a7660] font-medium text-center">Designs</th>
                <th className="px-5 py-3 text-[10px] uppercase tracking-widest text-[#8a7660] font-medium">Joined</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0e8d8]">
              {groups.map(g => (
                <tr key={g.id} className="hover:bg-[#faf7f2] transition-colors">
                  {/* Quartet name — inline editable */}
                  <td className="px-5 py-3">
                    {editingId === g.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleUpdateName(g.id); if (e.key === 'Escape') setEditingId(null) }}
                          autoFocus
                          className="border border-[#b8892a] rounded px-2 py-1 text-sm outline-none w-40"
                        />
                        <button onClick={() => handleUpdateName(g.id)} disabled={isPending}
                          className="text-xs text-[#9b1c1c] hover:underline">Save</button>
                        <button onClick={() => setEditingId(null)} className="text-xs text-[#8a7660] hover:underline">Cancel</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingId(g.id); setEditingName(g.quartet_name) }}
                        className="font-medium hover:text-[#b8892a] transition text-left"
                      >
                        {g.quartet_name}
                      </button>
                    )}
                  </td>
                  <td className="px-5 py-3 text-[#6b5f54]">{g.email}</td>
                  <td className="px-5 py-3 text-[#6b5f54]">
                    {g.shopify_collection_title
                      ? <span className="text-xs bg-[#f0e8d8] text-[#6b5f54] px-2 py-0.5 rounded-full">{g.shopify_collection_title}</span>
                      : <span className="text-xs text-[#c4b49e]">None assigned</span>
                    }
                  </td>
                  <td className="px-5 py-3 text-center tabular-nums text-[#6b5f54]">{g.design_count}</td>
                  <td className="px-5 py-3 text-xs text-[#8a7660]">{formatDate(g.created_at)}</td>
                  <td className="px-5 py-3 text-right">
                    {confirmDeleteId === g.id ? (
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-xs text-red-600">Delete this account?</span>
                        <button onClick={() => handleDelete(g.id)} disabled={isPending}
                          className="text-xs px-2 py-1 bg-[#9b1c1c] text-white rounded">Yes</button>
                        <button onClick={() => setConfirmDeleteId(null)}
                          className="text-xs px-2 py-1 border border-[#d4c5b0] rounded">No</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(g.id)}
                        className="text-[#c4b49e] hover:text-[#9b1c1c] transition">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
