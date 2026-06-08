import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/api-auth'
import { getPrintfulClient, getPrintAreaForPlacement, transformToPosition } from '@/lib/printful'

export const runtime = 'nodejs'

const printfilesCache = new Map<number, any>()
// Cache Printful CDN file URLs by logoPath so we don't re-upload on every generate
const printfulFileCache = new Map<string, string>()

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

  try {
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

      // Check cache first — avoid re-uploading to Printful on every generate
      const cached = printfulFileCache.get(logoPath)
      if (cached) {
        fileUrl = cached
      } else {
        // Get a signed URL so Printful can download the logo from Supabase
        const { data: signedData, error: signedError } = await admin.storage
          .from('cqs-assets')
          .createSignedUrl(logoPath, 600)

        if (signedError || !signedData?.signedUrl) {
          console.error('Signed URL error:', signedError)
          return NextResponse.json({ error: 'Could not sign logo URL' }, { status: 400 })
        }

        // Upload to Printful file library — they download from Supabase and give back a CDN URL
        console.log('Uploading logo to Printful:', logoPath)
        const fileResult = await client.uploadFile(signedData.signedUrl, 'logo.png')
        fileUrl = fileResult.url || fileResult.preview_url!
        if (!fileUrl) {
          return NextResponse.json({ error: 'Printful file upload returned no URL' }, { status: 500 })
        }
        printfulFileCache.set(logoPath, fileUrl)
        console.log('Logo uploaded to Printful:', fileUrl)
      }
    }

    let printfiles = printfilesCache.get(productId)
    if (!printfiles) {
      printfiles = await client.getPrintfiles(productId)
      printfilesCache.set(productId, printfiles)
    }

    // Validate placement against what this product actually supports
    const availablePlacements = Object.keys(printfiles.available_placements || {})
    if (availablePlacements.length > 0 && !availablePlacements.includes(placement)) {
      console.log(`Placement '${placement}' not valid, available: ${availablePlacements.join(', ')}. Using '${availablePlacements[0]}'`)
      placement = availablePlacements[0]
    }

    const area = getPrintAreaForPlacement(printfiles, placement, variantIds)
      ?? { width: 1800, height: 1800 }
    const position = transformToPosition(transform, area)

    console.log('Creating mockup task:', { productId, variantIds: variantIds.slice(0, 3), placement, position })

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
