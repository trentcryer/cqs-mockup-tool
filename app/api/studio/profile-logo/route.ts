import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { storagePath } = await req.json()
  if (!storagePath) return NextResponse.json({ error: 'Missing storagePath' }, { status: 400 })

  await (supabase.from('profiles') as any)
    .update({ profile_logo_path: storagePath })
    .eq('id', user.id)

  return NextResponse.json({ ok: true })
}
