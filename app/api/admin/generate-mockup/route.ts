import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getPrintfulClient, getPrintAreaForPlacement, transformToPosition } from '@/lib/printful'

export const runtime = 'nodejs'

// Cache Printful file URLs and printfiles per server process to avoid redundant uploads/fetches
const fileUrlCache = new Map<string, string>()   // logo_path → printful file url
const printfilesCache = new Map<number, any>()   // product_id → printfiles

export async function POST(req: NextRequest) {
  // Admin-only
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const trentEmail = process.env.TRENT_EMAIL?.toLowerCase()
  if (!user || !trentEmail || user.email?.toLowerCase() !== trentEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { designId, transform } = await req.json()
  if (!designId) return NextResponse.json({ error: 'Missing designId' }, { status: 400 })

  const admin = createAdminClient()
  const { data: design } = await admin.from('designs').select('*').eq('id', designId).single()
  if (!design) return NextResponse.json({ error: 'Design not found' }, { status: 404 })

  const client = getPrintfulClient()
  const logoPath = (design as any).logo_path

  try {
    // Use cached file URL if available, otherwise upload
    let fileUrl = fileUrlCache.get(logoPath)
    if (!fileUrl) {
      const { data: signedData } = await admin.storage
        .from('cqs-assets')
        .createSignedUrl(logoPath, 300)
      if (!signedData?.signedUrl) throw new Error('Could not sign logo URL')

      const logoRes = await fetch(signedData.signedUrl)
      const buffer = Buffer.from(await logoRes.arrayBuffer())
      const fileResult = await client.uploadFile(buffer, 'logo.png')
      fileUrl = fileResult.url || fileResult.preview_url!
      fileUrlCache.set(logoPath, fileUrl)
    }

    // Use cached printfiles if available
    const productId = (design as any).product_id
    let printfiles = printfilesCache.get(productId)
    if (!printfiles) {
      printfiles = await client.getPrintfiles(productId)
      printfilesCache.set(productId, printfiles)
    }

    const area = getPrintAreaForPlacement(printfiles, (design as any).placement, (design as any).variant_ids)
      ?? { width: 1800, height: 1800 }
    const finalTransform = transform || (design as any).transform
    const position = transformToPosition(finalTransform, area)

    const taskKey = await client.createMockupTask({
      product_id: productId,
      variant_ids: (design as any).variant_ids,
      placement: (design as any).placement,
      image_url: fileUrl,
      position,
    })

    const result = await client.pollTask(taskKey, 1500, 30)

    await (admin.from('designs') as any).update({
      transform: finalTransform,
      mockup_urls: result.mockups || [],
    }).eq('id', designId)

    return NextResponse.json({ mockups: result.mockups || [] })
  } catch (e: any) {
    console.error('Admin generate-mockup error:', e)
    return NextResponse.json({ error: e.message || 'Generation failed' }, { status: 500 })
  }
}
