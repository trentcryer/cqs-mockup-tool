import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/api-auth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminUser(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const { notes } = await req.json().catch(() => ({ notes: undefined }))

  const admin = createAdminClient()
  const { error } = await (admin.from('designs') as any)
    .update({ status: 'draft', notes: notes || null })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
