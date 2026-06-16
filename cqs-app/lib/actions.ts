import { supabase } from './supabase'

export async function deleteLogo(logoId: string, storagePath: string, userId: string) {
  await supabase.from('logos').delete().eq('id', logoId).eq('user_id', userId)
  if (storagePath) await supabase.storage.from('cqs-assets').remove([storagePath])
}

export async function deleteDesign(designId: string) {
  await supabase.from('designs').delete().eq('id', designId)
}

export async function updateGroupName(userId: string, name: string) {
  await supabase.from('profiles').update({ quartet_name: name, updated_at: new Date().toISOString() }).eq('id', userId)
}
