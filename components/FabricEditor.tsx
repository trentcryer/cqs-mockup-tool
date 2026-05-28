'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as fabric from 'fabric'

interface FabricEditorProps {
  backgroundImageUrl?: string
  logoUrl?: string
  onTransformChange?: (transform: any) => void
  initialTransform?: any
  printAreaWidth?: number
  printAreaHeight?: number
}

export default function FabricEditor({
  backgroundImageUrl,
  logoUrl,
  onTransformChange,
  initialTransform,
  printAreaWidth = 800,
  printAreaHeight = 900,
}: FabricEditorProps) {
  // Compute stable display dimensions at the top level so they can be used safely in effects.
  const maxDisplayWidth = 720
  const aspect = printAreaHeight / printAreaWidth
  const displayWidth = maxDisplayWidth
  const displayHeight = Math.round(maxDisplayWidth * aspect)

  const canvasWidth = displayWidth
  const canvasHeight = displayHeight
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const logoObjRef = useRef<fabric.Image | null>(null)
  const backgroundRef = useRef<fabric.Image | null>(null)
  const baseLogoScaleRef = useRef(1) // stores the initial computed scale for "100%" size
  const initialTransformRef = useRef(initialTransform)
  const [logoScale, setLogoScale] = useState(1) // multiplier (1 = 100% of initial computed size)
  const [isReady, setIsReady] = useState(false)

  // Keep the ref in sync but don't let it re-trigger logo reloads
  useEffect(() => {
    initialTransformRef.current = initialTransform
  })

  // Initialize Fabric canvas
  useEffect(() => {
    if (!canvasRef.current) return

    // Always use a reasonable fixed canvas size for performance and usability.
    // We still respect the real aspect ratio from the print area.
    const maxCanvasWidth = 720
    const aspect = printAreaHeight / printAreaWidth
    const canvasWidth = maxCanvasWidth
    const canvasHeight = Math.round(maxCanvasWidth * aspect)

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: '#f9f6f0',
      preserveObjectStacking: true,
      selection: true,
    })

    fabricRef.current = canvas

    // Only show subtle grid + label when there's no product photo background
    // (prevents ghost borders and visual noise when a nice photo is loaded)
    if (!backgroundImageUrl) {
      const grid = new fabric.Rect({
        left: 0,
        top: 0,
        width: canvasWidth,
        height: canvasHeight,
        fill: 'transparent',
        stroke: '#d4c5b0',
        strokeWidth: 1.5,
        selectable: false,
        evented: false,
        opacity: 0.35,
      })
      canvas.add(grid)

      const centerLabel = new fabric.Text('PRINT AREA', {
        left: canvasWidth / 2,
        top: 28,
        fontSize: 10,
        fill: '#b8892a',
        fontFamily: 'Inter, system-ui',
        originX: 'center',
        selectable: false,
        evented: false,
        opacity: 0.6,
      })
      canvas.add(centerLabel)
    }

    setIsReady(true)

    // Cleanup
    return () => {
      canvas.dispose()
      fabricRef.current = null
    }
  }, [printAreaWidth, printAreaHeight])

  // Load background (product variant image or flat template)
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return

    // Remove previous background if exists
    if (backgroundRef.current) {
      canvas.remove(backgroundRef.current)
      backgroundRef.current = null
    }

    if (!backgroundImageUrl) {
      // Show the subtle grid when there's no product photo
      return
    }

    ;(async () => {
      try {
        const img = await fabric.Image.fromURL(backgroundImageUrl)
        if (!img) return

        // Fit the product photo to the canvas while preserving its own aspect ratio.
        // This prevents the photo from being heavily cropped or distorted.
        const imgAspect = (img.width || 1) / (img.height || 1)
        const canvasAspect = canvasWidth / canvasHeight

        let scale
        if (imgAspect > canvasAspect) {
          // Image is wider → fit to height
          scale = (canvasHeight * 0.95) / (img.height || 1)
        } else {
          // Image is taller → fit to width
          scale = (canvasWidth * 0.95) / (img.width || 1)
        }

        img.set({
          left: canvasWidth / 2,
          top: canvasHeight / 2,
          originX: 'center',
          originY: 'center',
          scaleX: scale,
          scaleY: scale,
          selectable: false,
          evented: false,
          opacity: 0.92,
        })

        backgroundRef.current = img
        canvas.add(img)
        canvas.sendObjectToBack(img)

        // Hide the grid when we have a nice product photo
        const grid = canvas.getObjects().find((o: any) => o.type === 'rect' && o.stroke === '#d4c5b0')
        if (grid) grid.set('opacity', 0.15)

        canvas.renderAll()
      } catch (e) {
        console.warn('Background image load failed', e)
      }
    })()
  }, [backgroundImageUrl, canvasWidth, canvasHeight]) // Stable values from top-level useMemo-like calculation

  // Load logo when url changes
  const loadLogo = useCallback((url: string) => {
    const canvas = fabricRef.current
    if (!canvas) return

    // Remove previous logo
    if (logoObjRef.current) {
      canvas.remove(logoObjRef.current)
    }

    ;(async () => {
      try {
        const img = await fabric.Image.fromURL(url)
        if (!img) return

        // Clear any previous selection to avoid conflicts
        canvas.discardActiveObject()

        const maxLogo = Math.min(displayWidth * 0.55, displayHeight * 0.45)
        const fitScale = Math.min(maxLogo / (img.width || 200), maxLogo / (img.height || 200))

        // Restore from initialTransform if provided, otherwise center the logo
        let appliedScaleX = fitScale
        let appliedScaleY = fitScale
        let centerX = displayWidth / 2
        let centerY = displayHeight / 2
        let angle = 0
        let opacity = 1
        let sliderMultiplier = 1

        if (initialTransformRef.current?.normWidth != null) {
          const it = initialTransformRef.current
          const scaledW = it.normWidth * displayWidth
          const scaledH = it.normHeight * displayHeight
          centerX = (it.normLeft + it.normWidth / 2) * displayWidth
          centerY = (it.normTop + it.normHeight / 2) * displayHeight
          appliedScaleX = scaledW / (img.width || 1)
          appliedScaleY = scaledH / (img.height || 1)
          angle = it.angle || 0
          opacity = it.opacity ?? 1
          // Slider: express the restored scale as a multiplier on top of the default fit scale
          sliderMultiplier = appliedScaleX / fitScale
        }

        img.set({
          left: centerX,
          top: centerY,
          originX: 'center',
          originY: 'center',
          scaleX: appliedScaleX,
          scaleY: appliedScaleY,
          angle,
          opacity,
          selectable: true,
          evented: true,
          hasControls: false,
          hasBorders: false,
          lockScalingFlip: true,
          lockUniScaling: true,
        })

        // Store the "100%" base scale so the slider works reliably
        baseLogoScaleRef.current = fitScale
        setLogoScale(sliderMultiplier)

        logoObjRef.current = img
        canvas.add(img)
        canvas.setActiveObject(img)
        canvas.requestRenderAll()

        const emitTransform = () => {
          if (!img || !onTransformChange) return
          const scaledW = (img.width || 0) * (img.scaleX || 1)
          const scaledH = (img.height || 0) * (img.scaleY || 1)
          // originX/Y = 'center', so img.left/top are center coords — convert to top-left edge
          const leftEdge = (img.left || 0) - scaledW / 2
          const topEdge = (img.top || 0) - scaledH / 2

          const transform = {
            normLeft: leftEdge / displayWidth,
            normTop: topEdge / displayHeight,
            normWidth: scaledW / displayWidth,
            normHeight: scaledH / displayHeight,
            angle: Math.round(img.angle || 0),
            opacity: img.opacity ?? 1,
          }

          onTransformChange(transform)
        }

        img.on('moving', emitTransform)
        img.on('scaling', emitTransform)
        img.on('rotating', emitTransform)
        img.on('modified', emitTransform)

        emitTransform()
      } catch (e) {
        console.warn('Logo load failed in editor', e)
      }
    })()
  }, [printAreaWidth, printAreaHeight, onTransformChange])

  useEffect(() => {
    if (logoUrl && isReady) {
      loadLogo(logoUrl)
    }
  }, [logoUrl, isReady, loadLogo])

  // Reliable size control via slider (native Fabric handles are too erratic in React)
  const updateLogoScale = (multiplier: number) => {
    setLogoScale(multiplier)

    const canvas = fabricRef.current
    const logo = logoObjRef.current
    if (!canvas || !logo) return

    const newScale = baseLogoScaleRef.current * multiplier

    logo.set({
      scaleX: newScale,
      scaleY: newScale,
    })
    canvas.requestRenderAll()

    if (onTransformChange) {
      const scaledW = (logo.width || 0) * newScale
      const scaledH = (logo.height || 0) * newScale
      const leftEdge = (logo.left || 0) - scaledW / 2
      const topEdge = (logo.top || 0) - scaledH / 2
      const transform = {
        normLeft: leftEdge / displayWidth,
        normTop: topEdge / displayHeight,
        normWidth: scaledW / displayWidth,
        normHeight: scaledH / displayHeight,
        angle: Math.round(logo.angle || 0),
        opacity: logo.opacity ?? 1,
      }
      onTransformChange(transform)
    }
  }

  // Export current logo as high-res PNG for Printful upload
  const exportLogoPNG = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const canvas = fabricRef.current
      const logo = logoObjRef.current
      if (!canvas || !logo) return resolve(null)

      // Create a temp canvas with only the logo at high resolution
      const tempCanvas = document.createElement('canvas')
      const scaleFactor = 2 // 2x export quality
      tempCanvas.width = (logo.width || 400) * scaleFactor
      tempCanvas.height = (logo.height || 400) * scaleFactor

      const tCtx = tempCanvas.getContext('2d', { alpha: true })!
      const tempFabric = new fabric.Canvas(tempCanvas as any, { width: tempCanvas.width, height: tempCanvas.height })

      // Clone logo cleanly
      logo.clone().then((cloned: fabric.Image) => {
        cloned.set({
          left: tempCanvas.width / 2,
          top: tempCanvas.height / 2,
          originX: 'center',
          originY: 'center',
          scaleX: (logo.scaleX || 1) * scaleFactor,
          scaleY: (logo.scaleY || 1) * scaleFactor,
          angle: logo.angle || 0,
          opacity: logo.opacity ?? 1,
        })
        tempFabric.add(cloned)
        tempFabric.renderAll()

        tempCanvas.toBlob((blob) => {
          tempFabric.dispose()
          resolve(blob)
        }, 'image/png')
      })
    })
  }

  // Expose export method for the "Generate High-Quality Mockups" button
  useEffect(() => {
    ;(window as any).__cqsExportLogo = exportLogoPNG
  }, [])

  return (
    <div>
      <div 
        className="fabric-container inline-block shadow-inner" 
        style={{ 
          width: displayWidth, 
          height: displayHeight,
          maxWidth: '100%' 
        }}
      >
        <canvas 
          ref={canvasRef} 
          style={{ width: '100%', height: '100%' }} 
        />
      </div>

      <div className="mt-4 max-w-md">
        <div className="flex justify-between text-xs uppercase tracking-widest text-[#9b1c1c] mb-1.5">
          <span>Logo Size</span>
          <span>{Math.round(logoScale * 100)}%</span>
        </div>
        <input
          type="range"
          min={0.2}
          max={2.5}
          step={0.05}
          value={logoScale}
          onChange={(e) => updateLogoScale(parseFloat(e.target.value))}
          className="w-full accent-[#b8892a]"
        />
        <div className="mt-2 text-[11px] text-[#6b5f54]">
          Drag the logo anywhere on the canvas to move it. Use the slider to resize.
        </div>
      </div>
    </div>
  )
}
