import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/api-auth'
import { createCollection, addToQuartetDirectory } from '@/lib/shopify'
import { sendMagicLinkEmail } from '@/lib/resend'

export async function POST(req: NextRequest) {
  if (!await isAdminUser(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { collectionTitle, email } = await req.json()
  const title = collectionTitle?.trim()
  const cleanEmail = email?.trim().toLowerCase()
  if (!title || !cleanEmail) {
    return NextResponse.json({ error: 'Collection name and email are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  let newCollection: any
  try {
    newCollection = await createCollection(title)
  } catch (e: any) {
    return NextResponse.json({ error: `Shopify error: ${e.message}` }, { status: 500 })
  }

  const { data: linkData, error: linkErr } = await (admin.auth.admin as any).generateLink({
    type: 'magiclink',
    email: cleanEmail,
  })
  if (linkErr || !linkData?.properties?.action_link) {
    return NextResponse.json({ error: linkErr?.message ?? 'Failed to generate sign-in link' }, { status: 500 })
  }

  await (admin.from('profiles') as any).upsert({
    id: linkData.user.id,
    email: cleanEmail,
    quartet_name: title,
    shopify_collection_id: newCollection.id,
    shopify_collection_title: newCollection.title,
  }, { onConflict: 'id' })

  await addToQuartetDirectory(title, newCollection.handle).catch(() => {})

  await sendMagicLinkEmail({
    to: cleanEmail,
    magicLink: linkData.properties.action_link,
    quartetName: title,
    isNewAccount: true,
  }).catch(e => console.error('[CQS EMAIL] failed to send magic link:', e.message))

  return NextResponse.json({ magicLink: linkData.properties.action_link, collectionTitle: title })
}
