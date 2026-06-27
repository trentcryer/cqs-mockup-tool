import { NextRequest, NextResponse } from 'next/server'
import { getXAuthUrl } from '@/lib/oauth-handlers'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const authUrl = getXAuthUrl()
    return NextResponse.json({ loginUrl: authUrl })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
