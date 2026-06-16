import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/api-auth'
import { listCollections } from '@/lib/shopify'

export async function GET(req: NextRequest) {
  if (!await isAdminUser(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const admin = createAdminClient()

  const [collections, profilesRes, designsRes] = await Promise.all([
    listCollections(true).catch(() => []),
    admin.from('profiles').select('id, email, quartet_name, shopify_collection_id, created_at'),
    admin.from('designs').select('user_id'),
  ])
  const profiles = profilesRes.data as any[] | null
  const designs = designsRes.data as any[] | null

  const profileByCollectionId = new Map(
    (profiles ?? []).filter((p: any) => p.shopify_collection_id).map((p: any) => [String(p.shopify_collection_id), p])
  )
  const designCountByUserId = new Map<string, number>()
  for (const d of (designs ?? [])) {
    designCountByUserId.set(d.user_id, (designCountByUserId.get(d.user_id) ?? 0) + 1)
  }

  const rows = collections.map(c => {
    const profile = profileByCollectionId.get(String(c.id))
    return {
      id: c.id,
      title: c.title,
      handle: c.handle,
      account: profile ? {
        id: profile.id,
        email: profile.email,
        quartet_name: profile.quartet_name,
        design_count: designCountByUserId.get(profile.id) ?? 0,
        created_at: profile.created_at,
      } : null,
    }
  })

  return NextResponse.json({ groups: rows })
}

export async function PATCH(req: NextRequest) {
  if (!await isAdminUser(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { profileId, collectionId, collectionTitle } = await req.json()
  if (!profileId) return NextResponse.json({ error: 'profileId is required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await (admin.from('profiles') as any)
    .update({
      shopify_collection_id: collectionId ?? null,
      shopify_collection_title: collectionTitle ?? null,
    })
    .eq('id', profileId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
