import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getPrintfulClient } from '@/lib/printful'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const trentEmail = process.env.TRENT_EMAIL?.toLowerCase()
  const admin = createAdminClient()
  const { data: profile } = await (admin.from('profiles') as any)
    .select('is_admin').eq('id', user.id).single()
  const isAdmin = user.email?.toLowerCase() === trentEmail || !!profile?.is_admin
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 100)
  const offset = parseInt(url.searchParams.get('offset') || '0')

  try {
    const files = await getPrintfulClient().listFiles(limit, offset)
    const imageFiles = files.filter(f => f.status === 'ok' && f.visible !== false)
    return NextResponse.json({ files: imageFiles })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
