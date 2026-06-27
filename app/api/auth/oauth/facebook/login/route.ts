import { NextRequest, NextResponse } from 'next/server'
import { getFacebookAuthUrl } from '@/lib/oauth-handlers'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const authUrl = getFacebookAuthUrl()
    return NextResponse.json({ loginUrl: authUrl })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
