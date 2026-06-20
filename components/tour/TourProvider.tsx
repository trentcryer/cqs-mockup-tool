'use client'

import { Joyride, EventData, STATUS, ACTIONS, Step } from 'react-joyride'
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { usePathname } from 'next/navigation'

const DONE_KEY = 'cqs_tour_done'   // localStorage: permanently disabled by user
const PAGE_KEY = 'cqs_tour_page'   // sessionStorage: current chapter (resets each session)
const MAX_PAGE = 4

// ── Page-scoped step targets ──────────────────────────────────────────────────
// Each page index maps to the exact data-tour targets for that chapter.
// getPageSteps() only considers the targets for the current page index, so
// steps from other pages can never bleed through on a re-visit.

const PAGE_TARGETS: Record<number, string[]> = {
  0: [
    '[data-tour="studio-page"]',
    '[data-tour="studio-dashboard"]',
    '[data-tour="studio-merch"]',
    '[data-tour="browse-catalog-btn"]',
  ],
  1: [
    '[data-tour="catalog-categories"]',
    '[data-tour="catalog-print-method"]',
    '[data-tour="catalog-bella-3001"]',
    '[data-tour="catalog-page"]',
  ],
  2: [
    '[data-tour="editor-logo-modal"]',
    '[data-tour="editor-upload-btn"]',
  ],
  3: [
    '[data-tour="editor-color"]',
    '[data-tour="editor-placement"]',
    '[data-tour="editor-logo"]',
    '[data-tour="editor-preview"]',
    '[data-tour="editor-generate"]',
    '[data-tour="editor-save"]',
  ],
  4: [
    '[data-tour="studio-request-review"]',
  ],
}

// ── All steps (ordered to match PAGE_TARGETS) ─────────────────────────────────

const ALL_STEPS: Step[] = [
  // Page 0 — Studio intro
  {
    target: '[data-tour="studio-page"]',
    title: 'Welcome to your Studio',
    content: 'This is your main dashboard. All of your sales and product info, active merchandise and drafts are displayed here.',
    placement: 'center',
    skipBeacon: true,
  },
  {
    target: '[data-tour="studio-dashboard"]',
    title: 'Your Sales Dashboard',
    content: "This is your sales dashboard. This is where you can keep an active pulse on what's going on in your shop.",
    placement: 'bottom',
    skipBeacon: true,
  },
  {
    target: '[data-tour="studio-merch"]',
    title: 'Your Merch',
    content: "Here's an active look at what's currently online for sale in your shop.",
    placement: 'top',
    skipBeacon: true,
  },
  {
    target: '[data-tour="browse-catalog-btn"]',
    title: "Let's Get Started",
    content: "Now let's get started with your first design. Click the button below to browse the catalog and pick a product.",
    placement: 'bottom',
    skipBeacon: true,
    buttons: [],
  },

  // Page 1 — Catalog
  {
    target: '[data-tour="catalog-categories"]',
    title: 'Merch Categories',
    content: 'These are your merch categories — use the tiles up top or the list on the left to filter. Start by selecting the type of merch you are looking for.',
    placement: 'bottom',
    skipBeacon: true,
  },
  {
    target: '[data-tour="catalog-print-method"]',
    title: 'Print Method',
    content: "Standard Print is going to make up the majority of your inventory. All-Over Print replicates your logo across the entire piece of merch. It's probably best to stick with Standard Print for now.",
    placement: 'right',
    skipBeacon: true,
  },
  {
    target: '[data-tour="catalog-bella-3001"]',
    title: 'Click to Expand',
    content: 'Click on this product to see the full details, available colors, and a preview.',
    placement: 'top',
    skipBeacon: true,
  },
  {
    target: '[data-tour="catalog-page"]',
    title: 'Product Details',
    content: 'When you click an item it shows the full description and available colors — click each swatch to preview it on the garment. Click "Design This" to start building your mockup. Once you find something you like, click Design This and there will be more instructions on the next page.',
    placement: 'center',
    skipBeacon: true,
  },

  // Page 2 — Editor logo modal
  {
    target: '[data-tour="editor-logo-modal"]',
    title: 'Choose Your Logo',
    content: "You will start by uploading your logo. For the best looking merch, your logo needs to be in the correct file type. There is a useful guide on the next page that will help with that. For now, let's just select a file to get used to the process.",
    placement: 'right',
    skipBeacon: true,
  },
  {
    target: '[data-tour="editor-upload-btn"]',
    title: 'Upload Your Logo',
    content: 'Click here to select your logo file from your computer.',
    placement: 'top',
    skipBeacon: true,
    buttons: [],
  },

  // Page 3 — Main editor
  {
    target: '[data-tour="editor-color"]',
    title: 'Pick a Color',
    content: 'Select the garment color. You can add multiple colors for the same design.',
    placement: 'right',
    skipBeacon: true,
  },
  {
    target: '[data-tour="editor-placement"]',
    title: 'Choose a Print Location',
    content: 'Front chest, back, left chest — pick where the logo goes on the garment.',
    placement: 'right',
    skipBeacon: true,
  },
  {
    target: '[data-tour="editor-logo"]',
    title: 'Your Logo',
    content: 'Your uploaded logo appears here. You can swap it or upload a new one any time.',
    placement: 'right',
    skipBeacon: true,
  },
  {
    target: '[data-tour="editor-preview"]',
    title: 'Live Mockup Preview',
    content: 'This updates in real time as you make changes.',
    placement: 'left',
    skipBeacon: true,
  },
  {
    target: '[data-tour="editor-generate"]',
    title: 'Generate Your Mockup',
    content: "When you're happy with the placement, click Generate Mockup to create a real preview image of your design on the product.",
    placement: 'top',
    skipBeacon: true,
  },
  {
    target: '[data-tour="editor-save"]',
    title: 'Save Your Draft',
    content: "Click Save Draft to save your design to your studio. You can come back and edit it any time before submitting.",
    placement: 'top',
    skipBeacon: true,
  },

  // Page 4 — Studio finish
  {
    target: '[data-tour="studio-request-review"]',
    title: 'Submit for Review',
    content: "When you're ready, click Submit for Review to send your design to us. We'll approve it and get it listed in your shop.",
    placement: 'top',
    skipBeacon: true,
    buttons: [],
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTourPage(): number {
  return parseInt(sessionStorage.getItem(PAGE_KEY) || '0', 10)
}

function setTourPageStorage(page: number) {
  sessionStorage.setItem(PAGE_KEY, String(page))
}

function getStepsForPage(page: number): Step[] {
  const targets = PAGE_TARGETS[page]
  if (!targets) return []
  return ALL_STEPS.filter(s =>
    typeof s.target === 'string' &&
    targets.includes(s.target as string) &&
    (s.target === 'body' || !!document.querySelector(s.target as string))
  )
}

// ── Context ───────────────────────────────────────────────────────────────────

interface TourCtx {
  isTourActive: boolean
  startTour: () => void
  stopTour: () => void
  continueTour: () => void
}

const TourContext = createContext<TourCtx>({
  isTourActive: false,
  startTour: () => {},
  stopTour: () => {},
  continueTour: () => {},
})

export function useTour() {
  return useContext(TourContext)
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [run, setRun] = useState(false)
  const [steps, setSteps] = useState<Step[]>([])
  const [isTourActive, setIsTourActive] = useState(false)
  const activeRef = useRef(false)
  const pathname = usePathname()

  function setActive(val: boolean) {
    activeRef.current = val
    setIsTourActive(val)
  }

  function endTourPermanently() {
    setRun(false)
    setActive(false)
    localStorage.setItem(DONE_KEY, '1')
    sessionStorage.removeItem(PAGE_KEY)
  }

  function pauseTour() {
    setRun(false)
  }

  // Launch for the current DOM. Always fires unless permanently disabled.
  // Uses sessionStorage for page index so each browser session restarts from 0.
  function launchTour() {
    if (typeof window === 'undefined') return
    if (localStorage.getItem(DONE_KEY)) return  // user clicked "Don't show again"

    let page = getTourPage()

    while (page <= MAX_PAGE) {
      const pageSteps = getStepsForPage(page)
      if (pageSteps.length > 0) {
        setTourPageStorage(page)
        setActive(true)
        setSteps(pageSteps)
        setRun(true)
        return
      }
      page++
    }
    // Finished all pages for this session — reset so it starts fresh next session
    sessionStorage.removeItem(PAGE_KEY)
  }

  // Auto-start on every mount unless permanently disabled
  useEffect(() => {
    if (localStorage.getItem(DONE_KEY)) return
    const t = setTimeout(launchTour, 1200)
    return () => clearTimeout(t)
  }, [])

  // Re-launch when the route changes mid-tour
  useEffect(() => {
    if (!activeRef.current) return
    setRun(false)
    const t = setTimeout(launchTour, 700)
    return () => clearTimeout(t)
  }, [pathname])

  const startTour = useCallback(() => {
    localStorage.removeItem(DONE_KEY)
    localStorage.removeItem(PAGE_KEY)
    setRun(false)
    setTimeout(launchTour, 50)
  }, [])

  const stopTour = useCallback(() => {
    endTourPermanently()
  }, [])

  // Called by the editor when the logo picker modal closes
  const continueTour = useCallback(() => {
    if (!activeRef.current) return
    setRun(false)
    setTimeout(launchTour, 50)
  }, [])

  function handleEvent(data: EventData) {
    const { action, status, type, step } = data


    // "Don't show again" (Skip button) → permanently disable
    if (action === ACTIONS.SKIP || status === STATUS.SKIPPED) {
      endTourPermanently()
      return
    }

    // X close → pause for this session, auto-launches again next visit
    if (action === ACTIONS.CLOSE && status !== STATUS.FINISHED) {
      pauseTour()
      return
    }

    // Completed all steps for this page chapter
    if (status === STATUS.FINISHED) {
      setRun(false)
      const nextPage = getTourPage() + 1
      if (nextPage > MAX_PAGE) {
        sessionStorage.removeItem(PAGE_KEY)  // reset for next session
      } else {
        setTourPageStorage(nextPage)
        // activeRef stays true; next navigation triggers re-launch for next page
      }
    }
  }

  return (
    <TourContext.Provider value={{ isTourActive, startTour, stopTour, continueTour }}>
      <Joyride
        steps={steps}
        run={run}
        continuous
        onEvent={handleEvent}
        options={{
          scrollOffset: 150,
          overlayClickAction: 'close',
          showProgress: true,
          buttons: ['back', 'close', 'primary', 'skip'],
          primaryColor: '#1c1412',
          textColor: '#1c1412',
          arrowColor: '#ffffff',
          overlayColor: 'rgba(28,20,18,0.5)',
          zIndex: 9999,
        }}
        styles={{
          tooltip: {
            backgroundColor: '#ffffff',
            border: '1px solid #e8e0d8',
            borderRadius: 4,
            boxShadow: '0 6px 24px rgba(28,20,18,0.14), 0 2px 8px rgba(28,20,18,0.06)',
            padding: '22px 24px',
            maxWidth: 360,
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
          },
          tooltipContainer: {
            textAlign: 'left',
            lineHeight: 1.5,
          },
          tooltipTitle: {
            fontFamily: 'var(--font-playfair), Georgia, serif',
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: '-0.3px',
            color: '#1c1412',
            margin: '0 0 8px',
          },
          tooltipContent: {
            fontSize: 14,
            color: 'rgba(28,20,18,0.75)',
            padding: '4px 0 16px',
          },
          tooltipFooter: {
            marginTop: 4,
          },
          buttonPrimary: {
            backgroundColor: '#1c1412',
            color: '#ffffff',
            borderRadius: 4,
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.3px',
            padding: '9px 20px',
          },
          buttonBack: {
            color: '#9b8c7a',
            fontSize: 13,
            fontWeight: 500,
            marginRight: 12,
          },
          buttonSkip: {
            color: '#9b8c7a',
            fontSize: 12,
            textDecoration: 'underline',
            textUnderlineOffset: '2px',
          },
          buttonClose: {
            color: '#9b8c7a',
            width: 13,
            height: 13,
            top: 16,
            right: 16,
          },
          beaconInner: {
            backgroundColor: '#1c1412',
          },
          beaconOuter: {
            backgroundColor: 'rgba(28,20,18,0.2)',
            border: '2px solid #1c1412',
          },
        }}
        locale={{
          back: '← Back',
          close: 'Close',
          last: 'Got it ✓',
          next: 'Next →',
          skip: "Don't show again",
        }}
      />
      {children}
    </TourContext.Provider>
  )
}
