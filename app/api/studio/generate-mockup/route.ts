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
  let imageData: string  // base64 — passed directly to Printful, no URL needed

  const contentType = req.headers.get('content-type') || ''

  try {
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData() as any
      productId = parseInt(formData.get('productId') as string)
      variantIds = JSON.parse(formData.get('variantIds') as string)
      placement = formData.get('placement') as string
      transform = JSON.parse(formData.get('transform') as string)
      const logoFile = formData.get('logo') as File
      const buf = Buffer.from(await logoFile.arrayBuffer())
      imageData = buf.toString('base64')
    } else {
      const body = await req.json()
      productId = body.productId
      variantIds = body.variantIds
      placement = body.placement
      transform = body.transform
      const logoPath: string = body.logoPath

      // Prefer base64 sent directly from the app (avoids Supabase fetch entirely)
      if (body.logoBase64) {
        imageData = body.logoBase64
        console.log(`Logo base64 received from app for product ${productId}`)
      } else {
        if (!logoPath) {
          return NextResponse.json({ error: 'logoPath or logoBase64 is required' }, { status: 400 })
        }
        const { data: signedData, error: signedError } = await admin.storage
          .from('cqs-assets')
          .createSignedUrl(logoPath, 300)

        if (signedError || !signedData?.signedUrl) {
          return NextResponse.json({ error: 'Could not access logo' }, { status: 400 })
        }
        const logoRes = await fetch(signedData.signedUrl)
        if (!logoRes.ok) {
          return NextResponse.json({ error: `Logo fetch failed: ${logoRes.status}` }, { status: 400 })
        }
        const logoBuf = Buffer.from(await logoRes.arrayBuffer())
        if (logoBuf.length === 0) {
          return NextResponse.json({ error: 'Logo file is empty — re-upload your logo and try again' }, { status: 400 })
        }
        imageData = logoBuf.toString('base64')
        console.log(`Logo fetched from Supabase: ${logoBuf.length} bytes`)
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
      console.log(`Placement '${placement}' not valid, using '${availablePlacements[0]}'`)
      placement = availablePlacements[0]
    }

    const area = getPrintAreaForPlacement(printfiles, placement, variantIds)
      ?? { width: 1800, height: 1800 }
    const position = transformToPosition(transform, area)

    // Upload to Printful file library using base64 — returns a Printful CDN URL
    const fileResult = await client.uploadFile(imageData, 'logo.png')
    const fileUrl = fileResult.url || fileResult.preview_url
    if (!fileUrl) {
      return NextResponse.json({ error: 'Printful file upload returned no URL' }, { status: 500 })
    }
    console.log('Logo uploaded to Printful CDN:', fileUrl.substring(0, 60))

    const taskVariantIds = variantIds.slice(0, 5)
    console.log('Creating mockup task:', { productId, variantIds: taskVariantIds, placement, position })

    const taskKey = await client.createMockupTask({
      product_id: productId,
      variant_ids: taskVariantIds,
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
