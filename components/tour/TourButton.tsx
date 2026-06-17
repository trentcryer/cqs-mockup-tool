'use client'

import { useTour } from './TourProvider'
import { HelpCircle } from 'lucide-react'

export function TourButton() {
  const { startTour } = useTour()
  return (
    <button
      onClick={startTour}
      title="Start guided tour"
      className="flex items-center gap-1.5 text-white/50 hover:text-white/90 transition text-[13px] px-2 py-2"
    >
      <HelpCircle size={15} />
      <span className="hidden sm:inline text-[12px]">Tour</span>
    </button>
  )
}
