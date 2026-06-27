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
    const clientId = process.env.TIKTOK_CLIENT_ID
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET
    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin}/api/auth/oauth/tiktok/callback`

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(new URL('/studio?error=config_missing', req.url))
    }

    const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }).toString(),
    })

    const tokenData: any = await tokenRes.json()
    if (!tokenData.data?.access_token) {
      return NextResponse.redirect(new URL(`/studio?error=${tokenData.message || 'token_error'}`, req.url))
    }

    // Get user info from TikTok
    const meRes = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name', {
      headers: { Authorization: `Bearer ${tokenData.data.access_token}` },
    })

    const meData: any = await meRes.json()
    const accountId = meData.data?.user?.open_id || 'unknown'
    const displayName = meData.data?.user?.display_name || 'TikTok Account'

    // Save connection (TikTok doesn't provide refresh tokens in Login Kit, so it may need to be handled differently)
    await saveSocialConnection(
      user.id,
      'tiktok',
      accountId,
      displayName,
      tokenData.data.access_token,
      tokenData.data.refresh_token,
      tokenData.data.expires_in ? new Date(Date.now() + tokenData.data.expires_in * 1000).toISOString() : undefined
    )

    return NextResponse.redirect(new URL('/studio/promote?tiktok=connected', req.url))
  } catch (e: any) {
    console.error('[TikTok OAuth error]', e)
    return NextResponse.redirect(new URL(`/studio?error=${encodeURIComponent(e.message)}`, req.url))
  }
}
