import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getPrintfulClient } from '@/lib/printful'
import StudioEditorClient from './StudioEditorClient'

export default async function StudioEditorPage({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string; designId?: string }>
}) {
  const { productId: pidParam, designId } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const client = getPrintfulClient()

  // Load existing design if editing
  let existingDesign: any = null
  let logoSignedUrl: string | null = null
  let productId: number

  if (designId) {
    const { data: design } = await supabase
      .from('designs').select('*').eq('id', designId).eq('user_id', user.id).single()
    if (!design) redirect('/studio')
    existingDesign = design
    productId = (design as any).product_id

    if ((design as any).logo_path) {
      const { data } = await (await createAdminClient()).storage
        .from('cqs-assets')
        .createSignedUrl((design as any).logo_path, 3600)
      logoSignedUrl = data?.signedUrl || null
    }
  } else if (pidParam) {
    productId = parseInt(pidParam)
  } else {
    redirect('/studio/catalog')
  }

  // Fetch product data + printfiles
  const raw = await client.getProduct(productId!) as any
  const productInfo = raw.product ?? raw
  const variantsList: any[] = raw.variants ?? []

  const printfiles = await client.getPrintfiles(productId!)

  const colorMap: Record<string, number[]> = {}
  for (const v of variantsList) {
    const color = v.color || 'Default'
    if (!colorMap[color]) colorMap[color] = []
    colorMap[color].push(v.id)
  }

  const placements = Object.entries(printfiles.available_placements || {}).map(
    ([key, label]) => ({ key, label: String(label) })
  )

  // Fetch Printful templates for live preview
  let templatesResponse = { templates: [], variant_mapping: [] }
  try {
    templatesResponse = await client.getTemplates(productId!) as any
  } catch {
    // Non-fatal — live preview shows fallback state
  }

  return (
    <StudioEditorClient
      product={{ id: productId!, title: productInfo.title }}
      colorMap={colorMap}
      placements={placements}
      templatesResponse={templatesResponse}
      existingDesign={existingDesign}
      logoSignedUrl={logoSignedUrl}
    />
  )
}
