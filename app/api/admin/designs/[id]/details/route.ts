import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// Save admin-editable product details (title + description) onto a design.
// These persist to the designs table and become the defaults the publish flow
// uses for the Shopify product title and body_html.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Admin-only — same inline gate as the other /api/admin routes
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const trentEmail = process.env.TRENT_EMAIL?.toLowerCase()
  if (!user || !trentEmail || user.email?.toLowerCase() !== trentEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: designId } = await params
  const body = await req.json()
  const { productTitle, notes, printfulDescription, sizeGuideEnabled, selectedColors, selectedSizes } = body

  const update: Record<string, any> = {}
  if (typeof productTitle === 'string') {
    const trimmed = productTitle.trim()
    if (!trimmed) return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
    update.product_title = trimmed
  }
  if (typeof notes === 'string') update.notes = notes.trim() || null

  // Publish overrides — only built when at least one override field is present, so a
  // title/notes-only save doesn't clobber existing overrides.
  const hasOverrides =
    typeof printfulDescription === 'string' ||
    typeof sizeGuideEnabled === 'boolean' ||
    Array.isArray(selectedColors) ||
    Array.isArray(selectedSizes)
  if (hasOverrides) {
    const overrides: Record<string, any> = {}
    if (typeof printfulDescription === 'string') overrides.printful_description = printfulDescription.trim() || null
    if (typeof sizeGuideEnabled === 'boolean') overrides.size_guide_enabled = sizeGuideEnabled
    if (Array.isArray(selectedColors)) overrides.selected_colors = selectedColors
    if (Array.isArray(selectedSizes)) overrides.selected_sizes = selectedSizes
    update.publish_overrides = overrides
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await (admin.from('designs') as any).update(update).eq('id', designId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
