import { NextRequest, NextResponse } from 'next/server'
import { isAdminUser } from '@/lib/api-auth'
import { listCollections } from '@/lib/shopify'

export async function GET(req: NextRequest) {
  if (!await isAdminUser(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const collections = await listCollections(true).catch(() => [])
  return NextResponse.json({ collections })
}
