import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  try {
    if (!await isAdminUser(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const trentEmail = process.env.TRENT_EMAIL?.toLowerCase()

    const [{ data: { users } }, { data: profiles }] = await Promise.all([
      admin.auth.admin.listUsers({ perPage: 500 }),
      admin.from('profiles').select('id, quartet_name, shopify_collection_title, shopify_collection_id, shopify_collection_type'),
    ])

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]))

    const groups = users
      .filter(u => u.email?.toLowerCase() !== trentEmail)
      .map(u => {
        const p = profileMap.get(u.id) ?? {}
        return {
          id: u.id,
          email: u.email ?? '',
          quartet_name: p.quartet_name ?? 'Unknown Group',
          shopify_collection_title: p.shopify_collection_title ?? null,
          shopify_collection_id: p.shopify_collection_id ?? null,
          shopify_collection_type: p.shopify_collection_type ?? 'custom',
          created_at: u.created_at,
        }
      })
      .sort((a, b) => a.quartet_name.localeCompare(b.quartet_name))

    return NextResponse.json({ groups })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!await isAdminUser(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { quartet_name, email } = await req.json()
    if (!quartet_name?.trim() || !email?.trim()) {
      return NextResponse.json({ error: 'quartet_name and email are required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    const password = 'CQS-' + Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')

    const { data, error } = await admin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await (admin.from('profiles') as any).update({ quartet_name: quartet_name.trim() }).eq('id', data.user.id)

    return NextResponse.json({ ok: true, email: email.trim(), password, userId: data.user.id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
