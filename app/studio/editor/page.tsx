import { unstable_cache } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getPrintfulClient } from '@/lib/printful'
import StudioEditorClient from './StudioEditorClient'

// Cache per-product Printful data for 1 hour.
// Product variants, printfiles, and templates change very rarely.
const getCachedProduct = unstable_cache(
  async (productId: number) => getPrintfulClient().getProduct(productId),
  ['pf-product'],
  { revalidate: 3600 }
)

const getCachedPrintfiles = unstable_cache(
  async (productId: number) => getPrintfulClient().getPrintfiles(productId),
  ['pf-printfiles'],
  { revalidate: 3600 }
)

const getCachedTemplates = unstable_cache(
  async (productId: number) => getPrintfulClient().getTemplates(productId),
  ['pf-templates'],
  { revalidate: 3600 }
)

export default async function StudioEditorPage({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string; designId?: string }>
}) {
  const { productId: pidParam, designId } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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

  // Run all three Printful calls + user logo fetch in parallel.
  // Previously these ran sequentially (~3s total); now they're one parallel round-trip
  // and Printful data is cached per product for 1 hour after first load.
  const [raw, printfiles, templatesResponse, logosResult] = await Promise.all([
    getCachedProduct(productId!),
    getCachedPrintfiles(productId!),
    getCachedTemplates(productId!).catch(() => ({ templates: [], variant_mapping: [] })),
    supabase.from('logos').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
  ])

  // Batch-sign the user's saved logos for the picker modal
  const logosRaw: any[] = logosResult.data || []
  const logoPaths = logosRaw.map((l: any) => l.storage_path).filter(Boolean)
  const signedLogoMap: Record<string, string> = {}
  if (logoPaths.length > 0) {
    const { data: signedData } = await supabase.storage
      .from('cqs-assets')
      .createSignedUrls(logoPaths, 3600)
    for (const s of (signedData ?? [])) {
      if (s.path && s.signedUrl) signedLogoMap[s.path] = s.signedUrl
    }
  }
  const savedLogos = logosRaw
    .map((l: any) => ({
      id: l.id as string,
      filename: l.filename as string,
      storagePath: l.storage_path as string,
      displayUrl: (signedLogoMap[l.storage_path] ?? null) as string | null,
    }))
    .filter((l): l is { id: string; filename: string; storagePath: string; displayUrl: string } =>
      !!l.displayUrl
    )

  const productInfo = (raw as any).product ?? raw
  const variantsList: any[] = (raw as any).variants ?? []

  const colorMap: Record<string, number[]> = {}
  for (const v of variantsList) {
    const color = v.color || 'Default'
    if (!colorMap[color]) colorMap[color] = []
    colorMap[color].push(v.id)
  }

  const placements = Object.entries((printfiles as any).available_placements || {}).map(
    ([key, label]) => ({ key, label: String(label) })
  )

  const placementKeys = Object.keys((printfiles as any).available_placements || {})
  const isAop =
    placementKeys.some((k: string) => k.includes('dtfabric')) ||
    /all[\s-]over/i.test(productInfo.title || '')

  return (
    <StudioEditorClient
      product={{ id: productId!, title: productInfo.title, isAop }}
      colorMap={colorMap}
      placements={placements}
      templatesResponse={templatesResponse as any}
      existingDesign={existingDesign}
      logoSignedUrl={logoSignedUrl}
      savedLogos={savedLogos}
    />
  )
}
