import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { product_id, product_title, color, placement, variant_ids, logo_path, transform, notes, mockup_urls } = await req.json()

    if (!product_id || !placement || !logo_path) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: profile } = await (admin as any)
      .from('profiles')
      .select('quartet_name')
      .eq('id', user.id)
      .single() as { data: { quartet_name: string } | null }

    const { data, error } = await (admin as any)
      .from('designs')
      .insert({
        user_id: user.id,
        quartet_name: profile?.quartet_name || 'Unknown Quartet',
        product_id,
        product_title: product_title || '',
        color: color || null,
        placement,
        variant_ids: variant_ids || [],
        logo_path,
        transform: transform || {},
        notes: notes || null,
        mockup_urls: mockup_urls || [],
        status: 'review_requested',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, design: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
