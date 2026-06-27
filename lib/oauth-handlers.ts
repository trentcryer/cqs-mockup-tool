// OAuth handlers for all platforms
import { createAdminClient } from './supabase/server'

export async function saveSocialConnection(
  group_id: string,
  platform: string,
  account_id: string,
  display_name: string,
  access_token: string,
  refresh_token?: string,
  token_expires_at?: string,
  page_id?: string
) {
  const admin = createAdminClient()

  const { data, error } = await (admin.from('social_connections') as any).upsert({
    group_id,
    platform,
    account_id,
    page_id,
    display_name,
    access_token,
    refresh_token,
    token_expires_at,
    is_default: true,
    connected_at: new Date().toISOString(),
  }, { onConflict: 'group_id,platform,page_id' })

  if (error) throw new Error(`Failed to save connection: ${error.message}`)
  return data
}

export function getOAuthRedirectUri(platform: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  return `${baseUrl}/api/auth/oauth/${platform}/callback`
}

// Twitter/X OAuth URLs
export function getXAuthUrl(): string {
  const clientId = process.env.X_CLIENT_ID
  const redirectUri = getOAuthRedirectUri('x')

  if (!clientId) throw new Error('X_CLIENT_ID not configured')

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'tweet.write tweet.moderate.write users.read',
    state: Math.random().toString(36).slice(2),
    code_challenge_method: 'plain',
    code_challenge: Math.random().toString(36).slice(2),
  })

  return `https://twitter.com/i/oauth2/authorize?${params.toString()}`
}

// LinkedIn OAuth URLs
export function getLinkedInAuthUrl(): string {
  const clientId = process.env.LINKEDIN_CLIENT_ID
  const redirectUri = getOAuthRedirectUri('linkedin')

  if (!clientId) throw new Error('LINKEDIN_CLIENT_ID not configured')

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'w_member_social',
    state: Math.random().toString(36).slice(2),
  })

  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`
}

// Facebook OAuth URLs (already configured but adding for consistency)
export function getFacebookAuthUrl(): string {
  const clientId = process.env.FACEBOOK_APP_ID
  const redirectUri = getOAuthRedirectUri('facebook')

  if (!clientId) throw new Error('FACEBOOK_APP_ID not configured')

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'pages_manage_posts,pages_read_user_content,pages_manage_metadata',
    state: Math.random().toString(36).slice(2),
  })

  return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`
}

// Instagram OAuth (via Facebook Business)
export function getInstagramAuthUrl(): string {
  // Instagram uses Facebook OAuth — same flow as Facebook
  return getFacebookAuthUrl()
}

// TikTok OAuth URLs
export function getTikTokAuthUrl(): string {
  const clientId = process.env.TIKTOK_CLIENT_ID
  const redirectUri = getOAuthRedirectUri('tiktok')

  if (!clientId) throw new Error('TIKTOK_CLIENT_ID not configured')

  const params = new URLSearchParams({
    client_key: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'video.upload,user.info.basic',
    state: Math.random().toString(36).slice(2),
  })

  return `https://www.tiktok.com/v1/oauth/authorize?${params.toString()}`
}

// Token refresh helpers
export async function refreshXToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const response = await fetch('https://twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.X_CLIENT_ID || '',
      client_secret: process.env.X_CLIENT_SECRET || '',
    }).toString(),
  })

  const data = await response.json()
  if (!response.ok) throw new Error(data.error_description || 'Token refresh failed')
  return data
}

export async function refreshLinkedInToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.LINKEDIN_CLIENT_ID || '',
      client_secret: process.env.LINKEDIN_CLIENT_SECRET || '',
    }).toString(),
  })

  const data = await response.json()
  if (!response.ok) throw new Error(data.error_description || 'Token refresh failed')
  return data
}
