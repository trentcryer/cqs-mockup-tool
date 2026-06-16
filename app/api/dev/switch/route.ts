import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// DEV ONLY — remove before launch
// Enable by setting ENABLE_DEV_SWITCHER=true in .env.local
export async function POST(req: NextRequest) {
  if (process.env.ENABLE_DEV_SWITCHER !== 'true') {
    return NextResponse.json({ error: 'Not enabled' }, { status: 404 })
  }

  const { collectionId } = await req.json()
  if (!collectionId) return NextResponse.json({ error: 'collectionId required' }, { status: 400 })

  const admin = createAdminClient()

  // Look up which user is linked to this collection
  const { data: profile } = await admin
    .from('profiles')
    .select('email')
    .eq('shopify_collection_id', collectionId)
    .single() as { data: { email: string } | null }

  if (!profile?.email) {
    return NextResponse.json(
      { error: 'No user account is linked to this collection yet.' },
      { status: 404 }
    )
  }

  const origin = req.nextUrl.origin
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: profile.email,
    options: { redirectTo: `${origin}/studio` },
  })

  if (error || !data?.properties?.action_link) {
    return NextResponse.json(
      { error: error?.message || 'Failed to generate link' },
      { status: 500 }
    )
  }

  return NextResponse.json({ url: data.properties.action_link })
}
