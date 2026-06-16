import { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const admin = createAdminClient()
    const { data: { user } } = await admin.auth.getUser(token)
    return user
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function isAdminUser(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return false
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('is_admin').eq('id', user.id).single() as { data: any }
  return !!data?.is_admin
}
