import { NextRequest, NextResponse } from 'next/server'
import { listCollections } from '@/lib/shopify'
import { isAdminUser } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  try {
    if (!await isAdminUser(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // lite=true skips per-collection image fetching (saves ~100s for large stores)
    const lite = req.nextUrl.searchParams.get('lite') === 'true'
    const collections = await listCollections(lite)
    return NextResponse.json({ collections })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
