import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { email, password, quartet_name } = await req.json()
    if (!email?.trim() || !password?.trim() || !quartet_name?.trim()) {
      return NextResponse.json({ error: 'email, password, and quartet_name are required' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data, error } = await admin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const userId = data.user.id
    await (admin as any).from('profiles').update({ quartet_name: quartet_name.trim() }).eq('id', userId)

    // Generate a signed upload URL for the logo so the client can upload directly
    const logoPath = `logos/${userId}/logo.png`
    const { data: signedData, error: signedError } = await admin.storage
      .from('cqs-assets')
      .createSignedUploadUrl(logoPath)

    if (signedError) {
      // Non-fatal — return success without signed URL, logo upload will be skipped
      return NextResponse.json({ ok: true, userId, logoPath: null })
    }

    return NextResponse.json({ ok: true, userId, logoPath, signedUrl: signedData.signedUrl, token: signedData.token })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
