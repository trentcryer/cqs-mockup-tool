import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/api-auth'
import { getPrintfulClient, getPrintAreaForPlacement, transformToPosition } from '@/lib/printful'

export const runtime = 'nodejs'

const printfilesCache = new Map<number, any>()

type AopMode = 'straight' | 'diagonal' | 'random'

async function rotateBuf(buf: Buffer, angle: number): Promise<{ buf: Buffer; w: number; h: number }> {
  const rotated = await sharp(buf)
    .rotate(angle, { background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer()
  const meta = await sharp(rotated).metadata()
  return { buf: rotated, w: meta.width!, h: meta.height! }
}

async function tileLogoForAOP(
  logoBase64: string,
  targetWidth: number,
  targetHeight: number,
  normWidth: number,
  normHeight: number,
  mode: AopMode,
  gapPct: number = 5,   // 0 = logos touching, 100 = one logo-width of space between tiles
): Promise<string> {
  const logoBuf = Buffer.from(logoBase64, 'base64')
  const logoW = Math.max(20, Math.round(normWidth * targetWidth))
  const logoH = Math.max(20, Math.round(normHeight * targetHeight))

  const baseBuf = await sharp(logoBuf)
    .resize(logoW, logoH, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer()

  // Grid cell = logo size + user-controlled gap.
  // Rotation doesn't shift grid centers — each logo rotates in place around its cell center.
  const spacing = 1 + Math.max(0, gapPct) / 100
  const cellW = Math.round(logoW * spacing)
  const cellH = Math.round(logoH * spacing)

  // Pre-generate rotated variants
  let variants: Array<{ buf: Buffer; w: number; h: number }>
  if (mode === 'straight') {
    variants = [{ buf: baseBuf, w: logoW, h: logoH }]
  } else if (mode === 'diagonal') {
    variants = [await rotateBuf(baseBuf, 30)]
  } else {
    // 12 evenly-spaced angles — random mode picks one per cell
    const angles = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]
    variants = await Promise.all(angles.map(a => rotateBuf(baseBuf, a)))
  }

  // Oversized canvas with 2-cell bleed on each side so edge tiles composite cleanly
  const bleedX = cellW * 2
  const bleedY = cellH * 2
  const canvasW = targetWidth + bleedX * 2
  const canvasH = targetHeight + bleedY * 2
  const cols = Math.ceil(canvasW / cellW) + 1
  const rows = Math.ceil(canvasH / cellH) + 1

  // LCG — only used for random-mode variant selection
  let seed = 0xdeadbeef
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 0x100000000
  }

  const composites: sharp.OverlayOptions[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const variant = mode === 'random'
        ? variants[Math.floor(rand() * variants.length)]
        : variants[0]

      // Perfect grid: logo centered on its cell's center point
      const centerX = col * cellW + Math.round(cellW / 2)
      const centerY = row * cellH + Math.round(cellH / 2)
      const left = centerX - Math.round(variant.w / 2)
      const top  = centerY - Math.round(variant.h / 2)

      // Skip tiles that would land outside the canvas (sharp requires left/top >= 0)
      if (left < 0 || top < 0 || left + variant.w > canvasW || top + variant.h > canvasH) continue
      composites.push({ input: variant.buf, left, top })
    }
  }

  const tiled = await sharp({
    create: { width: canvasW, height: canvasH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 255 } },
  })
    .composite(composites)
    .extract({ left: bleedX, top: bleedY, width: targetWidth, height: targetHeight })
    .jpeg({ quality: 90 })
    .toBuffer()

  return tiled.toString('base64')
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = getPrintfulClient()
  const admin = createAdminClient()

  let productId: number
  let variantIds: number[]
  let placement: string
  let transform: any
  let imageData: string
  let isAopProduct = false
  let aopMode: AopMode = 'straight'
  let entireShirt = false
  let gapPct = 5

  const contentType = req.headers.get('content-type') || ''

  try {
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData() as any
      productId = parseInt(formData.get('productId') as string)
      variantIds = JSON.parse(formData.get('variantIds') as string)
      placement = formData.get('placement') as string
      transform = JSON.parse(formData.get('transform') as string)
      isAopProduct = formData.get('isAop') === 'true'
      aopMode = (formData.get('aopMode') as AopMode) || 'straight'
      entireShirt = formData.get('entireShirt') === 'true'
      gapPct = parseInt(formData.get('gapPct') as string || '5')
      const logoFile = formData.get('logo') as File
      imageData = Buffer.from(await logoFile.arrayBuffer()).toString('base64')
    } else {
      const body = await req.json()
      productId = body.productId
      variantIds = body.variantIds
      placement = body.placement
      transform = body.transform
      isAopProduct = !!body.isAop
      aopMode = (body.aopMode as AopMode) || 'straight'
      entireShirt = !!body.entireShirt
      gapPct = typeof body.gapPct === 'number' ? body.gapPct : 5

      if (body.logoBase64) {
        imageData = body.logoBase64
      } else {
        const logoPath: string = body.logoPath
        if (!logoPath) return NextResponse.json({ error: 'logoPath or logoBase64 is required' }, { status: 400 })

        const { data: signedData, error: signedError } = await admin.storage.from('cqs-assets').createSignedUrl(logoPath, 300)
        if (signedError || !signedData?.signedUrl) return NextResponse.json({ error: 'Could not access logo' }, { status: 400 })

        const logoRes = await fetch(signedData.signedUrl)
        if (!logoRes.ok) return NextResponse.json({ error: `Logo fetch failed: ${logoRes.status}` }, { status: 400 })
        const logoBuf = Buffer.from(await logoRes.arrayBuffer())
        if (logoBuf.length === 0) return NextResponse.json({ error: 'Logo file is empty — re-upload your logo' }, { status: 400 })
        imageData = logoBuf.toString('base64')
      }
    }

    let printfiles = printfilesCache.get(productId)
    if (!printfiles) {
      printfiles = await client.getPrintfiles(productId)
      printfilesCache.set(productId, printfiles)
    }

    const availablePlacements = Object.keys(printfiles.available_placements || {})
    if (availablePlacements.length > 0 && !availablePlacements.includes(placement)) {
      console.log(`Placement '${placement}' not valid, using '${availablePlacements[0]}'`)
      placement = availablePlacements[0]
    }

    const isAOP = isAopProduct || placement.includes('dtfabric')
    const taskVariantIds = variantIds.slice(0, 5)
    const normW = transform?.normWidth ?? 0.2
    const normH = transform?.normHeight ?? normW

    // Entire shirt: tile every surface placement in one Printful task
    if (isAOP && entireShirt) {
      // Skip non-surface items; accept anything that looks like front/back/sleeve/side/hood
      const SKIP = ['embroidery', 'label', 'preview', 'detail', 'pocket', 'neck', 'wristband', 'tag']
      const KEEP = ['front', 'back', 'sleeve', 'side', 'hood', 'leg', 'left', 'right']
      const surfacePlacements = availablePlacements.filter(p =>
        !SKIP.some(k => p.includes(k)) && KEEP.some(k => p.includes(k))
      )
      console.log(`Entire shirt — all placements: [${availablePlacements.join(', ')}]`)
      console.log(`Entire shirt — surface placements: [${surfacePlacements.join(', ')}]`)

      // Use front (or first) as reference so logo stays the same physical size across surfaces
      const refKey = surfacePlacements.find(p => p === 'front' || p.endsWith('_front')) ?? surfacePlacements[0]
      const refArea = getPrintAreaForPlacement(printfiles, refKey, variantIds) ?? { width: 1800, height: 1800 }
      const refLogoW = Math.round(normW * refArea.width)   // absolute px — same on every surface
      const refLogoH = Math.round(normH * refArea.height)
      console.log(`Reference area (${refKey}): ${refArea.width}x${refArea.height}, logo px: ${refLogoW}x${refLogoH}`)

      const files = await Promise.all(surfacePlacements.map(async p => {
        const area = getPrintAreaForPlacement(printfiles, p, variantIds) ?? { width: 1800, height: 1800 }
        // Keep the logo the same absolute pixel size; derive norm fractions from this area's dimensions
        const adjNormW = refLogoW / area.width
        const adjNormH = refLogoH / area.height
        console.log(`  ${p}: area ${area.width}x${area.height}, adjNorm ${adjNormW.toFixed(3)}x${adjNormH.toFixed(3)}`)
        // Sleeve print areas map to the 3D model at different orientations than front/back,
        // so rotated modes look mismatched. Force straight on sleeves for visual consistency.
        const isSleeve = p.includes('sleeve') || p.includes('arm') || p.includes('leg')
        const effectiveMode: AopMode = isSleeve ? 'straight' : aopMode
        const tiled = await tileLogoForAOP(imageData, area.width, area.height, adjNormW, adjNormH, effectiveMode, gapPct)
        const uploaded = await client.uploadFile(tiled, `aop-${p}.jpg`)
        const pos = { area_width: area.width, area_height: area.height, width: area.width, height: area.height, top: 0, left: 0 }
        return { placement: p, url: uploaded.url, position: pos }
      }))

      console.log(`Sending ${files.length} placements: [${files.map(f => f.placement).join(', ')}]`)
      const taskKey = await client.createMockupTask({ product_id: productId, variant_ids: taskVariantIds, files })
      const result = await client.pollTask(taskKey, 1500, 40)
      console.log(`Printful returned ${result.mockups?.length ?? 0} mockups: [${result.mockups?.map(m => m.placement).join(', ')}]`)
      return NextResponse.json({ mockups: result.mockups || [] })
    }

    // Single placement
    const area = getPrintAreaForPlacement(printfiles, placement, variantIds) ?? { width: 1800, height: 1800 }
    console.log(`Placement: ${placement}, isAOP: ${isAOP}, area: ${area.width}x${area.height}`)

    let finalImageData = imageData
    let position

    if (isAOP) {
      console.log(`AOP — tiling, mode: ${aopMode}, gap: ${gapPct}%, normSize: ${normW.toFixed(3)}x${normH.toFixed(3)}`)
      finalImageData = await tileLogoForAOP(imageData, area.width, area.height, normW, normH, aopMode, gapPct)
      position = { area_width: area.width, area_height: area.height, width: area.width, height: area.height, top: 0, left: 0 }
    } else {
      position = transformToPosition(transform, area)
    }

    const fileResult = await client.uploadFile(finalImageData, isAOP ? 'aop-pattern.jpg' : 'logo.png')
    console.log('Creating mockup task:', { productId, placement, isAOP, position })

    const taskKey = await client.createMockupTask({
      product_id: productId,
      variant_ids: taskVariantIds,
      placement,
      image_url: fileResult.url,
      position,
    })

    const result = await client.pollTask(taskKey, 1500, 30)
    return NextResponse.json({ mockups: result.mockups || [] })
  } catch (e: any) {
    console.error('Studio generate-mockup error:', e)
    return NextResponse.json({ error: e.message || 'Generation failed' }, { status: 500 })
  }
}
