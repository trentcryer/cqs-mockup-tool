import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/api-auth'
import { getPrintfulClient, getPrintAreaForPlacement, transformToPosition } from '@/lib/printful'

export const runtime = 'nodejs'

const printfilesCache = new Map<number, any>()

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = getPrintfulClient()
  const admin = createAdminClient()

  let productId: number
  let variantIds: number[]
  let placement: string
  let transform: any
  let fileUrl: string

  const contentType = req.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData() as any
    productId = parseInt(formData.get('productId') as string)
    variantIds = JSON.parse(formData.get('variantIds') as string)
    placement = formData.get('placement') as string
    transform = JSON.parse(formData.get('transform') as string)
    const logoFile = formData.get('logo') as File
    const logoBuffer = Buffer.from(await logoFile.arrayBuffer())
    const fileResult = await client.uploadFile(logoBuffer, 'logo.png')
    fileUrl = fileResult.url || fileResult.preview_url!
  } else {
    const body = await req.json()
    productId = body.productId
    variantIds = body.variantIds
    placement = body.placement
    transform = body.transform
    const logoPath: string = body.logoPath

    if (!logoPath) {
      return NextResponse.json({ error: 'logoPath is required' }, { status: 400 })
    }

    // Create a signed URL and pass it directly to Printful — no intermediate upload needed
    const { data: signedData, error: signedError } = await admin.storage
      .from('cqs-assets')
      .createSignedUrl(logoPath, 600)

    if (signedError || !signedData?.signedUrl) {
      console.error('Signed URL error:', signedError)
      return NextResponse.json({ error: 'Could not sign logo URL' }, { status: 400 })
    }

    fileUrl = signedData.signedUrl
  }

  try {
    let printfiles = printfilesCache.get(productId)
    if (!printfiles) {
      printfiles = await client.getPrintfiles(productId)
      printfilesCache.set(productId, printfiles)
    }

    // Validate placement against what this product actually supports
    const availablePlacements = Object.keys(printfiles.available_placements || {})
    if (availablePlacements.length > 0 && !availablePlacements.includes(placement)) {
      console.log(`Placement '${placement}' not valid for product ${productId}, available: ${availablePlacements.join(', ')}. Using '${availablePlacements[0]}'`)
      placement = availablePlacements[0]
    }

    const area = getPrintAreaForPlacement(printfiles, placement, variantIds)
      ?? { width: 1800, height: 1800 }
    const position = transformToPosition(transform, area)

    console.log('Creating mockup task:', { productId, variantIds, placement, fileUrl: fileUrl.substring(0, 80) })

    const taskKey = await client.createMockupTask({
      product_id: productId,
      variant_ids: variantIds,
      placement,
      image_url: fileUrl,
      position,
    })

    const result = await client.pollTask(taskKey, 1500, 30)
    return NextResponse.json({ mockups: result.mockups || [] })
  } catch (e: any) {
    console.error('Studio generate-mockup error:', e)
    return NextResponse.json({ error: e.message || 'Generation failed' }, { status: 500 })
  }
}
