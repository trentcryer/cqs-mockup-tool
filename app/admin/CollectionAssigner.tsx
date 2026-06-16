'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ShopifyCollection } from '@/types/supabase'

interface Props {
  userId: string
  quartetName: string
  currentCollectionId: number | null
  currentCollectionTitle: string | null
  collections: ShopifyCollection[]
  assignAction: (userId: string, collectionId: number, collectionTitle: string) => Promise<void>
  createAction: (userId: string, collectionTitle: string) => Promise<void>
}

export default function CollectionAssigner({
  userId,
  quartetName,
  currentCollectionId,
  currentCollectionTitle,
  collections,
  assignAction,
  createAction,
}: Props) {
  const [selected, setSelected] = useState<string>(currentCollectionId?.toString() ?? '')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    const col = collections.find(c => c.id.toString() === selected)
    if (!col) return
    startTransition(async () => {
      await assignAction(userId, col.id, col.title)
      router.refresh()
    })
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      await createAction(userId, quartetName)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={selected}
        onChange={e => setSelected(e.target.value)}
        className="text-xs border border-[#d4c5b0] rounded px-2 py-1 bg-white"
        disabled={isPending}
      >
        <option value="">— pick collection —</option>
        {collections.map(c => (
          <option key={c.id} value={c.id.toString()}>{c.title}</option>
        ))}
      </select>

      {/* Assign existing */}
      <form onSubmit={handleAssign}>
        <button
          type="submit"
          disabled={!selected || isPending}
          className="text-xs px-3 py-1 bg-[#1c1412] text-white rounded disabled:opacity-40"
        >
          {isPending ? 'Saving…' : 'Assign'}
        </button>
      </form>

      {/* Create new collection */}
      <form onSubmit={handleCreate}>
        <button
          type="submit"
          disabled={isPending}
          className="text-xs px-3 py-1 border border-[#1c1412] text-[#1c1412] hover:bg-[#f7f5f2] disabled:opacity-40"
        >
          {isPending ? 'Creating…' : `+ Create "${quartetName}"`}
        </button>
      </form>

      {currentCollectionTitle && (
        <span className="text-xs text-green-700">✓ {currentCollectionTitle}</span>
      )}
    </div>
  )
}
