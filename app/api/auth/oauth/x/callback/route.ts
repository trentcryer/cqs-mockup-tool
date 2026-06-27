import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { saveSocialConnection } from '@/lib/oauth-handlers'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const error = req.nextUrl.searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL(`/studio?error=${encodeURIComponent(error)}`, req.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/studio?error=no_code', req.url))
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    // Exchange code for access token
    const clientId = process.env.X_CLIENT_ID
    const clientSecret = process.env.X_CLIENT_SECRET
    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin}/api/auth/oauth/x/callback`

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(new URL('/studio?error=config_missing', req.url))
    }

    const tokenRes = await fetch('https://twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }).toString(),
    })

    const tokenData: any = await tokenRes.json()
    if (!tokenData.access_token) {
      return NextResponse.redirect(new URL(`/studio?error=${tokenData.error}`, req.url))
    }

    // Get user info from X
    const meRes = await fetch('https://api.twitter.com/2/users/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    const meData: any = await meRes.json()
    const accountId = meData.data?.id
    const displayName = meData.data?.username || meData.data?.name || 'X Account'

    // Save connection
    await saveSocialConnection(
      user.id, // user.id is group_id in profiles
      'x',
      accountId,
      displayName,
      tokenData.access_token,
      tokenData.refresh_token,
      tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : undefined
    )

    return NextResponse.redirect(new URL('/studio/promote?x=connected', req.url))
  } catch (e: any) {
    console.error('[X OAuth error]', e)
    return NextResponse.redirect(new URL(`/studio?error=${encodeURIComponent(e.message)}`, req.url))
  }
}
