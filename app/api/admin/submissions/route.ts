import { NextRequest, NextResponse } from 'next/server'
import { isAdminUser } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    if (!await isAdminUser(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data, error } = await (admin as any)
      .from('designs')
      .select('*')
      .eq('status', 'review_requested')
      .order('created_at', { ascending: false }) as { data: any[] | null; error: any }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ submissions: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!await isAdminUser(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { designId, action, notes, shopify_collection_id, shopify_collection_title, shopify_collection_type } = await req.json()

    if (!designId || !action) return NextResponse.json({ error: 'Missing designId or action' }, { status: 400 })

    const admin = createAdminClient()

    if (action === 'approve') {
      await (admin as any).from('designs').update({ status: 'approved', notes: notes || null }).eq('id', designId)

      if (shopify_collection_id) {
        const { data: design } = await (admin as any)
          .from('designs')
          .select('user_id')
          .eq('id', designId)
          .single() as { data: { user_id: string } | null }

        if (design?.user_id) {
          await (admin as any).from('profiles').update({
            shopify_collection_id: String(shopify_collection_id),
            shopify_collection_title: shopify_collection_title || '',
            shopify_collection_type: shopify_collection_type || 'custom',
          }).eq('id', design.user_id)
        }
      }

      return NextResponse.json({ ok: true })
    }

    if (action === 'reject') {
      await (admin as any).from('designs').update({ status: 'draft', notes: notes || null }).eq('id', designId)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
