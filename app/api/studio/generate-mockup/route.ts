import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getPrintfulClient, getPrintAreaForPlacement, transformToPosition } from '@/lib/printful'

export const runtime = 'nodejs'

const fileUrlCache = new Map<string, string>()
const printfilesCache = new Map<number, any>()

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contentType = req.headers.get('content-type') || ''
  const client = getPrintfulClient()
  const admin = createAdminClient()

  let productId: number
  let variantIds: number[]
  let placement: string
  let transform: any
  let logoBuffer: Buffer
  let cacheKey: string

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData() as any
    productId = parseInt(formData.get('productId') as string)
    variantIds = JSON.parse(formData.get('variantIds') as string)
    placement = formData.get('placement') as string
    transform = JSON.parse(formData.get('transform') as string)
    const logoFile = formData.get('logo') as File
    logoBuffer = Buffer.from(await logoFile.arrayBuffer())
    cacheKey = `user:${user.id}:${logoFile.name}:${logoFile.size}`
  } else {
    const body = await req.json()
    productId = body.productId
    variantIds = body.variantIds
    placement = body.placement
    transform = body.transform
    const logoPath: string = body.logoPath

    const { data: signedData } = await admin.storage
      .from('cqs-assets')
      .createSignedUrl(logoPath, 300)
    if (!signedData?.signedUrl) {
      return NextResponse.json({ error: 'Could not sign logo URL' }, { status: 400 })
    }
    const logoRes = await fetch(signedData.signedUrl)
    logoBuffer = Buffer.from(await logoRes.arrayBuffer())
    cacheKey = logoPath
  }

  try {
    let fileUrl = fileUrlCache.get(cacheKey)
    if (!fileUrl) {
      const fileResult = await client.uploadFile(logoBuffer, 'logo.png')
      fileUrl = fileResult.url || fileResult.preview_url!
      fileUrlCache.set(cacheKey, fileUrl)
    }

    let printfiles = printfilesCache.get(productId)
    if (!printfiles) {
      printfiles = await client.getPrintfiles(productId)
      printfilesCache.set(productId, printfiles)
    }

    const area = getPrintAreaForPlacement(printfiles, placement, variantIds)
      ?? { width: 1800, height: 1800 }
    const position = transformToPosition(transform, area)

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
