import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * Facebook OAuth callback. User is redirected here after granting permissions.
 * Exchanges authorization code for access token, fetches their pages, and stores in DB.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const error = req.nextUrl.searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL(`/studio/promote?error=${encodeURIComponent(error)}`, req.url))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/studio/promote?error=missing_params', req.url))
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    // Exchange code for access token
    const fbAppId = process.env.FACEBOOK_APP_ID
    const fbSecret = process.env.FACEBOOK_APP_SECRET
    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin}/api/auth/facebook/callback`

    if (!fbAppId || !fbSecret) {
      return NextResponse.redirect(new URL('/studio/promote?error=config_missing', req.url))
    }

    const tokenRes = await fetch('https://graph.facebook.com/v18.0/oauth/access_token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: fbAppId,
        client_secret: fbSecret,
        redirect_uri: redirectUri,
        code,
      }),
    })

    const tokenData = await tokenRes.json()
    if (tokenData.error) {
      return NextResponse.redirect(new URL(`/studio/promote?error=${tokenData.error.message}`, req.url))
    }

    const accessToken = tokenData.access_token
    if (!accessToken) {
      return NextResponse.redirect(new URL('/studio/promote?error=no_token', req.url))
    }

    // Fetch user's pages
    const pagesRes = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token&access_token=${accessToken}`
    )
    const pagesData = await pagesRes.json()

    if (!pagesData.data || pagesData.data.length === 0) {
      return NextResponse.redirect(new URL('/studio/promote?error=no_pages', req.url))
    }

    // Store the first page as default (user can change in settings)
    const defaultPage = pagesData.data[0]
    const admin = createAdminClient()

    await (admin.from('profiles') as any).update({
      facebook_access_token: defaultPage.access_token,
      facebook_page_id: defaultPage.id,
      facebook_page_name: defaultPage.name,
    }).eq('id', user.id)

    return NextResponse.redirect(new URL('/studio/promote?facebook=success', req.url))
  } catch (e: any) {
    console.error('[Facebook OAuth error]', e)
    return NextResponse.redirect(new URL(`/studio/promote?error=${encodeURIComponent(e.message)}`, req.url))
  }
}
