'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

export default function MockupThumbnail({ src }: { src: string }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <img
        src={src}
        alt="mockup"
        className="w-20 h-20 object-cover rounded border border-[#d4c5b0] cursor-zoom-in hover:opacity-90 transition"
        onClick={() => setExpanded(true)}
      />
      {expanded && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setExpanded(false)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition"
            onClick={() => setExpanded(false)}
          >
            <X size={28} />
          </button>
          <img
            src={src}
            alt="Mockup enlarged"
            className="max-h-[90vh] max-w-[90vw] rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
