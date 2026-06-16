import { NextResponse } from 'next/server'
import { listCollections } from '@/lib/shopify'

// DEV ONLY — remove before launch
// Enable by setting ENABLE_DEV_SWITCHER=true in .env.local
export async function GET() {
  if (process.env.ENABLE_DEV_SWITCHER !== 'true') {
    return NextResponse.json({ error: 'Not enabled' }, { status: 404 })
  }

  // Exact same source as the admin "Jump to Collection" dropdown
  const collections = await listCollections(true) // skipImages=true for speed
  return NextResponse.json({ collections })
}
