import { NextRequest, NextResponse } from 'next/server'
import { getProductsInCollection } from '@/lib/shopify'
import { getAuthUser } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await (admin as any)
      .from('profiles')
      .select('shopify_collection_id, shopify_collection_type')
      .eq('id', user.id)
      .single() as { data: { shopify_collection_id: string; shopify_collection_type: string } | null }

    if (!profile?.shopify_collection_id) {
      return NextResponse.json({ error: 'No collection linked to your account' }, { status: 400 })
    }

    const collectionType = profile.shopify_collection_type === 'smart' ? 'smart' : 'custom'
    const products = await getProductsInCollection(Number(profile.shopify_collection_id), collectionType)
    return NextResponse.json({ products })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
