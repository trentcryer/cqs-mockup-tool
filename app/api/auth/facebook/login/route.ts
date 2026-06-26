import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * Returns the Facebook OAuth login URL for the user to visit.
 * After login, Facebook redirects to /api/auth/facebook/callback
 */
export async function GET(req: NextRequest) {
  const fbAppId = process.env.FACEBOOK_APP_ID
  if (!fbAppId) {
    return NextResponse.json({ error: 'Facebook app not configured' }, { status: 500 })
  }

  const redirectUri = encodeURIComponent(
    `${process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin}/api/auth/facebook/callback`
  )

  const facebookLoginUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth')
  facebookLoginUrl.searchParams.set('client_id', fbAppId)
  facebookLoginUrl.searchParams.set('redirect_uri', redirectUri)
  facebookLoginUrl.searchParams.set('scope', 'pages_manage_posts,pages_read_user_content,pages_manage_metadata')
  facebookLoginUrl.searchParams.set('state', Math.random().toString(36).slice(2))

  return NextResponse.json({ loginUrl: facebookLoginUrl.toString() })
}
