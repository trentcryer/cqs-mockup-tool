'use client'

import { useTour } from './TourProvider'
import { HelpCircle, X } from 'lucide-react'

export function TourControls() {
  const { isTourActive, startTour, stopTour } = useTour()

  if (isTourActive) {
    return (
      <button
        onClick={stopTour}
        title="Exit guided tour"
        className="flex items-center gap-1.5 transition text-[12px] px-2.5 py-1.5 font-medium border"
        style={{
          borderRadius: 3,
          background: 'rgba(220,38,38,0.12)',
          borderColor: 'rgba(220,38,38,0.35)',
          color: '#fca5a5',
        }}
      >
        <X size={13} />
        <span>Exit Tutorial</span>
      </button>
    )
  }

  return (
    <button
      onClick={startTour}
      title="Start guided tour"
      className="flex items-center gap-1.5 text-white/40 hover:text-white/80 transition text-[12px] px-2 py-2"
    >
      <HelpCircle size={15} />
      <span className="hidden sm:inline">Tour</span>
    </button>
  )
}
