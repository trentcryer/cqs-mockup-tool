import { NextRequest, NextResponse } from 'next/server'
import { getPrintfulClient, getDefaultPrintPosition, getPrintAreaForPlacement, PrintfulPosition } from '@/lib/printful'

export const runtime = 'nodejs' // needed for Buffer + FormData file handling

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()

    const productId = parseInt(formData.get('productId') as string)
    const variantIds = JSON.parse(formData.get('variantIds') as string) as number[]
    const placement = formData.get('placement') as string
    const logoFile = formData.get('logo') as File
    const transformJson = formData.get('transform') as string | null

    if (!productId || !variantIds.length || !placement || !logoFile) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const client = getPrintfulClient()

    // 1. Get printfiles for accurate positioning
    const printfiles = await client.getPrintfiles(productId)

    // 2. Upload logo to Printful
    const arrayBuffer = await logoFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const fileResult = await client.uploadFile(buffer, logoFile.name)

    // 3. Calculate position from transform OR fall back to sensible default
    let position: PrintfulPosition
    if (transformJson) {
      const t = JSON.parse(transformJson)
      const area = getPrintAreaForPlacement(printfiles, placement, variantIds)
      const aw = area?.width ?? 1800
      const ah = area?.height ?? 1800

      let w = Math.round((t.normWidth ?? 0.5) * aw)
      let h = Math.round((t.normHeight ?? 0.5) * ah)
      let left = Math.round((t.normLeft ?? 0.25) * aw)
      let top = Math.round((t.normTop ?? 0.25) * ah)
      const rotation = Math.round(t.angle ?? 0)

      // Safety clamps
      w = Math.max(10, Math.min(aw, w))
      h = Math.max(10, Math.min(ah, h))
      left = Math.max(0, Math.min(aw - w, left))
      top = Math.max(0, Math.min(ah - h, top))

      position = { area_width: aw, area_height: ah, width: w, height: h, left, top, rotation }
    } else {
      position = getDefaultPrintPosition(printfiles, placement, variantIds, 0.72)
    }

    // 4. Create + poll mockup task
    const taskKey = await client.createMockupTask({
      product_id: productId,
      variant_ids: variantIds,
      placement,
      image_url: fileResult.url || fileResult.preview_url!,
      position,
    })

    const result = await client.pollTask(taskKey, 2800, 22)

    return NextResponse.json({
      success: true,
      mockups: result.mockups || [],
      task_key: taskKey,
    })
  } catch (e: any) {
    console.error('Generate mockup error', e)
    return NextResponse.json({ error: e.message || 'Failed to generate mockups' }, { status: 500 })
  }
}
