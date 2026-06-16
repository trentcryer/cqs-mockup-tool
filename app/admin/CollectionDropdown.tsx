'use client'

import { useRouter } from 'next/navigation'

interface Props {
  collections: { id: number; title: string }[]
}

export default function CollectionDropdown({ collections }: Props) {
  const router = useRouter()
  return (
    <select
      defaultValue=""
      onChange={e => { if (e.target.value) router.push(`/admin/collections?id=${e.target.value}`) }}
      className="border border-[#e8e0d8] px-4 py-2.5 text-sm bg-white text-[#1c1412] focus:outline-none focus:border-[#1c1412] cursor-pointer hover:border-[#1c1412] transition"
    >
      <option value="">Jump to Collection…</option>
      {collections.map(c => (
        <option key={c.id} value={c.id}>{c.title}</option>
      ))}
    </select>
  )
}
