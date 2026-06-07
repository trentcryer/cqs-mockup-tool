import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getPrintfulClient } from '@/lib/printful'
import AdminEditorClient from './AdminEditorClient'

export default async function AdminEditorPage({
  params,
}: {
  params: Promise<{ designId: string }>
}) {
  const { designId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const trentEmail = process.env.TRENT_EMAIL?.toLowerCase()
  if (!trentEmail || user.email?.toLowerCase() !== trentEmail) redirect('/admin')

  const admin = createAdminClient()
  const { data: design } = await admin.from('designs').select('*').eq('id', designId).single()
  if (!design) redirect('/admin')

  // Generate signed URL for canvas preview (stored as storage path)
  let canvasPreviewUrl: string | null = null
  const previewPath = (design as any).canvas_preview_url
  if (previewPath && !previewPath.startsWith('http')) {
    const { data } = await admin.storage.from('cqs-assets').createSignedUrl(previewPath, 3600)
    canvasPreviewUrl = data?.signedUrl || null
  } else {
    canvasPreviewUrl = previewPath || null
  }

  // Signed URL for the logo (for client-side live preview overlay)
  let logoSignedUrl: string | null = null
  const logoPath = (design as any).logo_path
  if (logoPath) {
    const { data } = await admin.storage.from('cqs-assets').createSignedUrl(logoPath, 3600)
    logoSignedUrl = data?.signedUrl || null
  }

  // Fetch Printful template for the live preview garment image
  let template: import('@/lib/printful').PrintfulTemplate | null = null
  try {
    const client = getPrintfulClient()
    const resp = await client.getTemplates((design as any).product_id)
    template = resp.templates?.[0] ?? null
  } catch {
    // Non-fatal — live preview just won't show garment
  }

  return (
    <AdminEditorClient
      design={design}
      canvasPreviewUrl={canvasPreviewUrl}
      logoSignedUrl={logoSignedUrl}
      template={template}
    />
  )
}
