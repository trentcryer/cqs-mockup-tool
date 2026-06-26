import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  await (admin.from('profiles') as any).update({
    facebook_access_token: null,
    facebook_page_id: null,
    facebook_page_name: null,
  }).eq('id', user.id)

  return NextResponse.json({ ok: true })
}
