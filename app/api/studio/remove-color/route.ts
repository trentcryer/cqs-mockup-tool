import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { designId, color } = await req.json() as { designId: string; color: string }
  if (!designId || !color) return NextResponse.json({ error: 'designId and color required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: design } = await (admin.from('designs') as any)
    .select('mockup_urls, color_variant_map')
    .eq('id', designId)
    .eq('user_id', user.id)
    .single()

  if (!design) return NextResponse.json({ error: 'Design not found' }, { status: 404 })

  const newMockups = (design.mockup_urls || []).filter((m: any) => m.color !== color)
  const newMap = { ...design.color_variant_map }
  delete newMap[color]

  // Pick the first remaining color as the primary
  const remainingColors = Object.keys(newMap)
  const newPrimary = remainingColors[0] ?? null

  await (admin.from('designs') as any)
    .update({
      mockup_urls: newMockups,
      color_variant_map: newMap,
      ...(newPrimary ? { color: newPrimary } : {}),
    })
    .eq('id', designId)
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
