import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  if (!await isAdminUser(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || 'review_requested'

  const admin = createAdminClient()

  const { data: designs, error } = await admin
    .from('designs')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(200) as { data: any[] | null; error: any }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userIds = [...new Set((designs ?? []).map((d: any) => d.user_id))]
  const { data: profiles } = userIds.length
    ? await admin.from('profiles').select('id, email, quartet_name').in('id', userIds) as { data: any[] | null }
    : { data: [] as any[] }

  // kickback_percentage column may not exist yet — fetch separately so a missing
  // column doesn't break the whole query, matching app/admin/page.tsx's convention.
  let kickbackMap: Record<string, number> = {}
  try {
    const { data: kb } = await admin.from('profiles')
      .select('id, kickback_percentage').in('id', userIds.length ? userIds : ['__none__']) as { data: any[] | null }
    for (const row of (kb ?? [])) kickbackMap[row.id] = row.kickback_percentage ?? 0
  } catch { /* column not added yet — defaults to 0 */ }

  const profileById = Object.fromEntries((profiles ?? []).map((p: any) => [
    p.id, { ...p, kickback_percentage: kickbackMap[p.id] ?? 0 },
  ]))
  const designsWithProfiles = (designs ?? []).map((d: any) => ({
    ...d,
    profile: profileById[d.user_id] ?? null,
  }))

  return NextResponse.json({ designs: designsWithProfiles })
}
