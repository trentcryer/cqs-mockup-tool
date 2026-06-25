'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type ClaimState = { error?: string }

/**
 * Activates a group's existing (admin-created) account from the invite link.
 *
 * The invite email links to /claim?token_hash=...&group=...&email=... where the
 * token_hash comes from admin generateLink(). We verify that token here (which
 * establishes the SSR cookie session for the ALREADY-LINKED user — same id, same
 * Shopify collection), then set the password they chose. No new account is created,
 * so their existing inventory stays attached.
 *
 * Validation runs BEFORE verifyOtp because the token is single-use — we must not
 * burn it on a request that fails for a recoverable reason (e.g. password mismatch).
 */
export async function activateAccount(_prev: ClaimState, formData: FormData): Promise<ClaimState> {
  const tokenHash = (formData.get('token_hash') as string || '').trim()
  const password = (formData.get('password') as string) || ''
  const confirm = (formData.get('confirm') as string) || ''

  if (!tokenHash) return { error: 'This link is missing its security token. Ask CQS to resend your invite.' }
  if (password.length < 6) return { error: 'Password must be at least 6 characters.' }
  if (password !== confirm) return { error: 'Passwords do not match.' }

  const supabase = await createClient()

  // Verify the magic-link token → signs into the existing linked account (sets cookies).
  const { error: verifyErr } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
  if (verifyErr) {
    return { error: 'This link has expired or already been used. Ask CQS to send a fresh invite.' }
  }

  // Set the password they just chose so they can sign in normally from now on.
  const { error: pwErr } = await supabase.auth.updateUser({ password })
  if (pwErr) {
    return { error: pwErr.message }
  }

  redirect('/studio')
}
