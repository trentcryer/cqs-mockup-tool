import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'

export const runtime = 'nodejs'

const LOGO_PROCESSOR_URL = process.env.LOGO_PROCESSOR_URL || 'http://localhost:8000'

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('image') as File | null
    if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    if (file.size === 0) return NextResponse.json({ error: 'Empty file' }, { status: 400 })

    // SVGs have transparency already — skip processing and return as-is
    if (file.type === 'image/svg+xml') {
      const buf = Buffer.from(await file.arrayBuffer())
      return new NextResponse(buf, { headers: { 'Content-Type': 'image/svg+xml' } })
    }

    const fd = new FormData()
    fd.append('file', file)

    const res = await fetch(`${LOGO_PROCESSOR_URL}/remove-background`, {
      method: 'POST',
      body: fd,
      signal: AbortSignal.timeout(60_000),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('Logo processor error:', res.status, text)
      throw new Error(`Logo processor returned ${res.status}`)
    }

    const buffer = Buffer.from(await res.arrayBuffer())
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(buffer.length),
      },
    })
  } catch (e: any) {
    console.error('Background removal error:', e)
    return NextResponse.json({ error: e.message || 'Background removal failed' }, { status: 500 })
  }
}
