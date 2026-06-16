'use client'

import { useState } from 'react'

export interface ColorOption {
  name: string
  code: string
  image: string
}

interface Props {
  defaultImage: string
  title: string
  colors: ColorOption[]
}

export default function ProductImagePicker({ defaultImage, title, colors }: Props) {
  const [activeImage, setActiveImage] = useState(defaultImage)
  const [activeColor, setActiveColor] = useState<string | null>(null)

  return (
    <div className="space-y-5">
      {/* Image display */}
      <div className="bg-white rounded-3xl border border-[#ede9e4] p-8 flex items-center justify-center aspect-square overflow-hidden">
        <img
          key={activeImage}
          src={activeImage}
          alt={title}
          className="max-w-full max-h-full object-contain transition-opacity duration-150"
        />
      </div>

      {/* Color swatches */}
      {colors.length > 0 && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[2px] text-[#9b8c7a] mb-2.5">
            Available Colors
            <span className="ml-2 text-[#9b8c7a] font-normal normal-case tracking-normal">
              {activeColor ? `— ${activeColor}` : `(${colors.length})`}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {colors.map(c => (
              <button
                key={c.name}
                title={c.name}
                onMouseEnter={() => { setActiveImage(c.image); setActiveColor(c.name) }}
                onMouseLeave={() => { setActiveImage(defaultImage); setActiveColor(null) }}
                onClick={() => { setActiveImage(c.image); setActiveColor(c.name) }}
                className={`w-7 h-7 rounded-full border-2 transition-all duration-150 hover:scale-125 ${
                  activeColor === c.name
                    ? 'border-[#1c1412] scale-110'
                    : 'border-[#d4c5b0] hover:border-[#1c1412]'
                }`}
                style={{ backgroundColor: c.code }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
