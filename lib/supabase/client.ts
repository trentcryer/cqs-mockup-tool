'use client'

import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/supabase'

/**
 * Browser Supabase client (use sparingly - prefer server actions for mutations)
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    // During build or misconfig, return a stub that will error on use (prevents hard crash)
    console.warn('[CQS] Supabase env vars missing — using stub client')
    return {
      auth: {
        signInWithPassword: async () => ({ error: { message: 'Supabase not configured' } }),
        signInWithOtp: async () => ({ error: { message: 'Supabase not configured' } }),
        signUp: async () => ({ error: { message: 'Supabase not configured' } }),
      },
    } as any
  }

  return createBrowserClient<Database>(url, key)
}

// Note: For security, never put service role in NEXT_PUBLIC_ vars.
// Use server actions / route handlers for Printful, Resend, Shopify, storage uploads.