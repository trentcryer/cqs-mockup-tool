import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
    const clientId = process.env.FACEBOOK_APP_ID
    const clientSecret = process.env.FACEBOOK_APP_SECRET
    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin}/api/auth/oauth/facebook/callback`

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(new URL('/studio?error=config_missing', req.url))
    }

    const tokenRes = await fetch('https://graph.facebook.com/v18.0/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }).toString(),
    })

    const tokenData: any = await tokenRes.json()
    if (!tokenData.access_token) {
      return NextResponse.redirect(new URL(`/studio?error=${tokenData.error?.message || 'token_error'}`, req.url))
    }

    // Get user info from Facebook
    const meRes = await fetch('https://graph.facebook.com/v18.0/me?fields=id,name', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    const meData: any = await meRes.json()
    const accountId = meData.id
    const displayName = meData.name || 'Facebook Account'

    // Save connection
    await saveSocialConnection(
      user.id,
      'facebook',
      accountId,
      displayName,
      tokenData.access_token,
      undefined,
      undefined
    )

    return NextResponse.redirect(new URL('/studio/promote?facebook=connected', req.url))
  } catch (e: any) {
    console.error('[Facebook OAuth error]', e)
    return NextResponse.redirect(new URL(`/studio?error=${encodeURIComponent(e.message)}`, req.url))
  }
}
