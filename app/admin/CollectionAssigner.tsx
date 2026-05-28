'use client'

import { useState, useTransition } from 'react'
import type { ShopifyCollection } from '@/types/supabase'

interface Props {
  userId: string
  quartetName: string
  currentCollectionId: number | null
  currentCollectionTitle: string | null
  collections: ShopifyCollection[]
  assignAction: (formData: FormData) => Promise<void>
  createAction: (formData: FormData) => Promise<void>
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
      <form
        action={fd => {
          fd.set('userId', userId)
          fd.set('collectionId', selected)
          const col = collections.find(c => c.id.toString() === selected)
          fd.set('collectionTitle', col?.title ?? '')
          startTransition(() => assignAction(fd))
        }}
      >
        <button
          type="submit"
          disabled={!selected || isPending}
          className="text-xs px-3 py-1 bg-[#1c1412] text-white rounded disabled:opacity-40"
        >
          {isPending ? 'Saving…' : 'Assign'}
        </button>
      </form>

      {/* Create new collection */}
      <form
        action={fd => {
          fd.set('userId', userId)
          fd.set('collectionTitle', quartetName)
          startTransition(() => createAction(fd))
        }}
      >
        <button
          type="submit"
          disabled={isPending}
          className="text-xs px-3 py-1 border border-[#b8892a] text-[#b8892a] rounded hover:bg-[#f9f6f0] disabled:opacity-40"
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
