'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as fabric from 'fabric'

interface PlacementZone {
  cx: number    // logo center x (fraction of canvas width)
  cy: number    // logo center y (fraction of canvas height)
  fill: number  // logo max dimension as fraction of canvas shorter side
}

const PLACEMENT_ZONES: Record<string, PlacementZone> = {
  front:                  { cx: 0.50, cy: 0.42, fill: 0.50 },
  back:                   { cx: 0.50, cy: 0.42, fill: 0.50 },
  left_chest:             { cx: 0.58, cy: 0.39, fill: 0.14 },
  chest_left:             { cx: 0.58, cy: 0.39, fill: 0.14 },
  embroidery_chest_left:  { cx: 0.58, cy: 0.39, fill: 0.14 },
  right_chest:            { cx: 0.42, cy: 0.39, fill: 0.14 },
  chest_right:            { cx: 0.42, cy: 0.39, fill: 0.14 },
  embroidery_chest_right: { cx: 0.42, cy: 0.39, fill: 0.14 },
  pocket:                 { cx: 0.27, cy: 0.23, fill: 0.13 },
  sleeve_left:            { cx: 0.50, cy: 0.50, fill: 0.55 },
  sleeve_right:           { cx: 0.50, cy: 0.50, fill: 0.55 },
  outside_label:          { cx: 0.50, cy: 0.50, fill: 0.70 },
  inside_label:           { cx: 0.50, cy: 0.50, fill: 0.70 },
}

function getZone(placement?: string): PlacementZone {
  if (!placement) return { cx: 0.50, cy: 0.42, fill: 0.45 }
  if (PLACEMENT_ZONES[placement]) return PLACEMENT_ZONES[placement]
  const key = Object.keys(PLACEMENT_ZONES).find(k => placement.includes(k) || k.includes(placement))
  return key ? PLACEMENT_ZONES[key] : { cx: 0.50, cy: 0.42, fill: 0.45 }
}

interface FabricEditorProps {
  logoUrl?: string
  backgroundImageUrl?: string
  onTransformChange?: (transform: any) => void
  initialTransform?: any
  printAreaWidth?: number
  printAreaHeight?: number
  placement?: string
  placementLabel?: string
}

export default function FabricEditor({
  logoUrl,
  backgroundImageUrl,
  onTransformChange,
  initialTransform,
  printAreaWidth = 800,
  printAreaHeight = 900,
  placement,
  placementLabel,
}: FabricEditorProps) {
  const maxDisplayWidth = 720
  const aspect = printAreaHeight / printAreaWidth
  const displayWidth = maxDisplayWidth
  const displayHeight = Math.round(maxDisplayWidth * aspect)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const logoObjRef = useRef<fabric.Image | null>(null)
  const initialTransformRef = useRef(initialTransform)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    initialTransformRef.current = initialTransform
  })

  // Initialize Fabric canvas — reruns when placement or print area changes
  useEffect(() => {
    if (!canvasRef.current) return

    const canvasWidth = maxDisplayWidth
    const canvasHeight = Math.round(maxDisplayWidth * (printAreaHeight / printAreaWidth))

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
      selection: true,
    })

    fabricRef.current = canvas

    // Constrain logo within print area bounds during drag and scale
    const constrainToBounds = (obj: fabric.Object) => {
      const b = obj.getBoundingRect()
      let left = obj.left || 0
      let top = obj.top || 0
      if (b.left < 0) left -= b.left
      if (b.top < 0) top -= b.top
      if (b.left + b.width > canvasWidth) left -= (b.left + b.width - canvasWidth)
      if (b.top + b.height > canvasHeight) top -= (b.top + b.height - canvasHeight)
      obj.set({ left, top })
      obj.setCoords()
    }
    canvas.on('object:moving', (e: any) => { if (e.target) constrainToBounds(e.target) })
    canvas.on('object:scaling', (e: any) => { if (e.target) constrainToBounds(e.target) })

    // Dashed border showing the print area boundary
    const border = new fabric.Rect({
      left: 1,
      top: 1,
      width: canvasWidth - 2,
      height: canvasHeight - 2,
      fill: 'transparent',
      stroke: '#d4c5b0',
      strokeWidth: 1.5,
      strokeDashArray: [6, 4],
      selectable: false,
      evented: false,
    })
    canvas.add(border)

    // Placement label at top
    const label = placementLabel || (placement ? placement.replace(/_/g, ' ').toUpperCase() : 'PRINT AREA')
    const labelText = new fabric.Text(label.toUpperCase(), {
      left: canvasWidth / 2,
      top: 14,
      fontSize: 10,
      fill: '#9b1c1c',
      fontFamily: 'Inter, system-ui',
      originX: 'center',
      selectable: false,
      evented: false,
      opacity: 0.75,
    })
    canvas.add(labelText)

    // Helper text shown before a logo is uploaded
    const hint = new fabric.Text('Upload your logo to place it here', {
      left: canvasWidth / 2,
      top: canvasHeight / 2,
      fontSize: 11,
      fill: '#b8892a',
      fontFamily: 'Inter, system-ui',
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      opacity: 0.5,
    })
    canvas.add(hint)

    setIsReady(true)

    return () => {
      canvas.dispose()
      fabricRef.current = null
    }
  }, [printAreaWidth, printAreaHeight, placement, placementLabel])

  // Load background garment photo
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas || !backgroundImageUrl) return
    ;(async () => {
      try {
        const img = await fabric.Image.fromURL(backgroundImageUrl)
        if (!img) return
        const cw = maxDisplayWidth
        const ch = Math.round(maxDisplayWidth * (printAreaHeight / printAreaWidth))
        const imgAspect = (img.width || 1) / (img.height || 1)
        const canvasAspect = cw / ch
        const scale = imgAspect > canvasAspect
          ? (ch * 0.95) / (img.height || 1)
          : (cw * 0.95) / (img.width || 1)
        img.set({
          left: cw / 2, top: ch / 2,
          originX: 'center', originY: 'center',
          scaleX: scale, scaleY: scale,
          selectable: false, evented: false,
          opacity: 0.88,
        })
        canvas.add(img)
        canvas.sendObjectToBack(img)
        canvas.renderAll()
      } catch (e) {
        console.warn('Background image load failed', e)
      }
    })()
  }, [backgroundImageUrl, printAreaWidth, printAreaHeight])

  // Load logo
  const loadLogo = useCallback((url: string) => {
    const canvas = fabricRef.current
    if (!canvas) return

    if (logoObjRef.current) {
      canvas.remove(logoObjRef.current)
    }

    // Hide the "upload your logo" hint once a logo is loaded
    const hint = canvas.getObjects().find((o: any) => o.type === 'text' && o.text === 'Upload your logo to place it here')
    if (hint) hint.set('opacity', 0)

    ;(async () => {
      try {
        const img = await fabric.Image.fromURL(url)
        if (!img) return

        canvas.discardActiveObject()

        const zone = getZone(placement)
        const maxLogo = Math.min(displayWidth, displayHeight) * zone.fill
        const fitScale = Math.min(maxLogo / (img.width || 200), maxLogo / (img.height || 200))

        let appliedScaleX = fitScale
        let appliedScaleY = fitScale
        let centerX = displayWidth * zone.cx
        let centerY = displayHeight * zone.cy
        let angle = 0
        let opacity = 1

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
          hasControls: true,
          hasBorders: true,
          lockScalingFlip: true,
          lockUniScaling: true,
          cornerColor: '#b8892a',
          cornerStrokeColor: '#b8892a',
          borderColor: '#b8892a',
          cornerSize: 10,
          transparentCorners: false,
        })

        logoObjRef.current = img
        canvas.add(img)
        canvas.setActiveObject(img)
        canvas.requestRenderAll()

        const emitTransform = () => {
          if (!img || !onTransformChange) return
          const scaledW = (img.width || 0) * (img.scaleX || 1)
          const scaledH = (img.height || 0) * (img.scaleY || 1)
          const leftEdge = (img.left || 0) - scaledW / 2
          const topEdge = (img.top || 0) - scaledH / 2
          onTransformChange({
            normLeft: leftEdge / displayWidth,
            normTop: topEdge / displayHeight,
            normWidth: scaledW / displayWidth,
            normHeight: scaledH / displayHeight,
            angle: Math.round(img.angle || 0),
            opacity: img.opacity ?? 1,
          })
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
  }, [printAreaWidth, printAreaHeight, placement, onTransformChange])

  useEffect(() => {
    if (logoUrl && isReady) {
      loadLogo(logoUrl)
    }
  }, [logoUrl, isReady, loadLogo])

  // Export the full canvas (background + logo) as PNG — used for the customer's placement preview
  const exportCanvasPNG = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const canvas = fabricRef.current
      if (!canvas) return resolve(null)
      try {
        const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 1 })
        fetch(dataUrl).then(r => r.blob()).then(resolve).catch(() => resolve(null))
      } catch {
        resolve(null)
      }
    })
  }

  // Export logo as PNG for Printful upload
  const exportLogoPNG = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const canvas = fabricRef.current
      const logo = logoObjRef.current
      if (!canvas || !logo) return resolve(null)

      const tempCanvas = document.createElement('canvas')
      const scaleFactor = 2
      tempCanvas.width = (logo.width || 400) * scaleFactor
      tempCanvas.height = (logo.height || 400) * scaleFactor

      const tempFabric = new fabric.Canvas(tempCanvas as any, { width: tempCanvas.width, height: tempCanvas.height })

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

  useEffect(() => {
    ;(window as any).__cqsExportLogo = exportLogoPNG
    ;(window as any).__cqsExportCanvas = exportCanvasPNG
  }, [])

  return (
    <div>
      <div
        className="fabric-container inline-block shadow-sm border border-[#e8dcc8] rounded-lg overflow-hidden"
        style={{ width: displayWidth, height: displayHeight, maxWidth: '100%' }}
      >
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
      </div>
      <div className="mt-2 text-[11px] text-[#6b5f54]">
        Drag the logo to reposition. Use the corner handles to resize. The canvas represents the exact print area.
      </div>
    </div>
  )
}
