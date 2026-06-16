import { supabase } from './supabase'
import type { Logo } from './types'

export async function loadSavedLogos(userId: string): Promise<Logo[]> {
  const { data } = await supabase
    .from('logos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  const logosRaw = (data as Logo[]) || []
  const logoPaths = logosRaw.map(l => l.storage_path)
  if (logoPaths.length === 0) return []

  const { data: signedData } = await supabase.storage.from('cqs-assets').createSignedUrls(logoPaths, 3600)
  const signedMap: Record<string, string> = {}
  for (const s of signedData ?? []) {
    if (s.path && s.signedUrl) signedMap[s.path] = s.signedUrl
  }
  return logosRaw.map(l => ({ ...l, displayUrl: signedMap[l.storage_path] ?? null }))
}
