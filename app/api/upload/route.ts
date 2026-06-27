import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const bucketName = (formData.get('bucketName') || 'cqs-assets') as string
    const uploadPath = (formData.get('uploadPath') || `uploads/${Date.now()}-${file.name}`) as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(uploadPath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: publicData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(uploadPath)

    return NextResponse.json({
      path: data.path,
      publicUrl: publicData.publicUrl,
    })
  } catch (e: any) {
    console.error('[Upload error]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
