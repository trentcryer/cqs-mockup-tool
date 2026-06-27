// Multi-platform posting engine
import { SocialConnection, PostToMultiplePlatforms, PostResult, MultiPlatformPostResponse } from '@/types/social-complete'
import { createAdminClient } from './supabase/server'
import { refreshXToken, refreshLinkedInToken } from './oauth-handlers'

export class PostingEngine {
  private admin = createAdminClient()

  // Main entry point: post to multiple platforms at once
  async postToMultiplePlatforms(
    group_id: string,
    payload: PostToMultiplePlatforms,
    connections: SocialConnection[]
  ): Promise<MultiPlatformPostResponse> {
    const results: PostResult[] = []
    let barber_feed_post_id: string | undefined

    // Post to barber-feed first (always)
    if (payload.platforms.includes('barber-feed')) {
      try {
        barber_feed_post_id = await this.postToBarberFeed(group_id, payload)
        results.push({ platform: 'barber-feed', success: true, post_id: barber_feed_post_id })
      } catch (e: any) {
        results.push({ platform: 'barber-feed', success: false, error: e.message })
      }
    }

    // Post to external platforms in parallel
    const platformPromises = payload.platforms
      .filter(p => p !== 'barber-feed')
      .map(platform => this.postToPlatform(group_id, payload, connections, platform))

    const platformResults = await Promise.allSettled(platformPromises)
    results.push(
      ...platformResults.map((result, idx) => {
        const platform = payload.platforms[idx + (payload.platforms.includes('barber-feed') ? 1 : 0)] as any
        return result.status === 'fulfilled' ? result.value : { platform, success: false, error: 'Failed' }
      })
    )

    return {
      barber_feed_post_id,
      results,
      posted_at: new Date().toISOString(),
    }
  }

  // Post to individual platforms
  private async postToPlatform(
    group_id: string,
    payload: PostToMultiplePlatforms,
    connections: SocialConnection[],
    platform: string
  ): Promise<PostResult> {
    const connection = connections.find(c => c.platform === platform)
    if (!connection) {
      return { platform: platform as any, success: false, error: 'Platform not connected' }
    }

    try {
      switch (platform) {
        case 'x':
          return await this.postToX(connection, payload)
        case 'linkedin':
          return await this.postToLinkedIn(connection, payload)
        case 'facebook':
          return await this.postToFacebook(connection, payload)
        case 'instagram':
          return await this.postToInstagram(connection, payload)
        case 'tiktok':
          return await this.postToTikTok(connection, payload)
        default:
          return { platform: platform as any, success: false, error: 'Platform not supported' }
      }
    } catch (e: any) {
      return { platform: platform as any, success: false, error: e.message }
    }
  }

  // Platform-specific posting logic
  private async postToBarberFeed(group_id: string, payload: PostToMultiplePlatforms): Promise<string> {
    const { data, error } = await this.admin.from('barber_feed_posts').insert({
      group_id,
      content_type: payload.content_type,
      media_url: payload.media_url,
      caption: payload.caption,
      product_id: payload.product_id,
      product_title: payload.product_title,
    })

    if (error) throw new Error(error.message)
    return (data as any)?.[0]?.id
  }

  private async postToX(connection: SocialConnection, payload: PostToMultiplePlatforms): Promise<PostResult> {
    // Check token expiry and refresh if needed
    if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
      if (connection.refresh_token) {
        const refreshed = await refreshXToken(connection.refresh_token)
        connection.access_token = refreshed.access_token
        // Update in DB
        await (this.admin.from('social_connections') as any).update({
          access_token: refreshed.access_token,
          token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        }).eq('id', connection.id)
      }
    }

    const text = `${payload.caption || ''}\n\n${payload.media_url}`.trim()

    const response = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        media: payload.content_type === 'image' ? { media_ids: [await this.uploadToX(connection.access_token, payload.media_url)] } : undefined,
      }),
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.errors?.[0]?.message || 'X post failed')

    return {
      platform: 'x',
      success: true,
      post_id: data.data?.id,
      share_url: `https://twitter.com/i/web/status/${data.data?.id}`,
    }
  }

  private async postToLinkedIn(connection: SocialConnection, payload: PostToMultiplePlatforms): Promise<PostResult> {
    // Check token expiry and refresh if needed
    if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
      if (connection.refresh_token) {
        const refreshed = await refreshLinkedInToken(connection.refresh_token)
        connection.access_token = refreshed.access_token
        // Update in DB
        await (this.admin.from('social_connections') as any).update({
          access_token: refreshed.access_token,
          token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        }).eq('id', connection.id)
      }
    }

    const response = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': '202312',
      },
      body: JSON.stringify({
        author: `urn:li:person:${connection.account_id}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.UGCPost': {
            shareMediaCategory: payload.content_type === 'image' ? 'IMAGE' : 'VIDEO',
            shareContent: {
              shareCommentary: { text: payload.caption || '' },
              media: [{ status: 'READY', media: payload.media_url }],
            },
          },
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      }),
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'LinkedIn post failed')

    return {
      platform: 'linkedin',
      success: true,
      post_id: data.id,
      share_url: `https://www.linkedin.com/feed/update/${data.id}`,
    }
  }

  private async postToFacebook(connection: SocialConnection, payload: PostToMultiplePlatforms): Promise<PostResult> {
    const response = await fetch(`https://graph.facebook.com/v18.0/${connection.page_id}/feed`, {
      method: 'POST',
      body: new URLSearchParams({
        message: payload.caption || '',
        link: payload.media_url,
        access_token: connection.access_token,
      }),
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.error?.message || 'Facebook post failed')

    return {
      platform: 'facebook',
      success: true,
      post_id: data.id,
      share_url: `https://facebook.com/${data.id}`,
    }
  }

  private async postToInstagram(connection: SocialConnection, payload: PostToMultiplePlatforms): Promise<PostResult> {
    // Instagram posts via Facebook Graph API (IG pages managed through FB)
    const response = await fetch(`https://graph.instagram.com/v18.0/${connection.page_id}/media`, {
      method: 'POST',
      body: new URLSearchParams({
        caption: payload.caption || '',
        image_url: payload.media_url,
        access_token: connection.access_token,
      }),
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.error?.message || 'Instagram post failed')

    return {
      platform: 'instagram',
      success: true,
      post_id: data.id,
      share_url: `https://instagram.com/p/${data.id}`,
    }
  }

  private async postToTikTok(connection: SocialConnection, payload: PostToMultiplePlatforms): Promise<PostResult> {
    // TikTok video upload requires SDK or pre-signed URLs
    // For MVP, return success but flag as needing manual upload
    return {
      platform: 'tiktok',
      success: false,
      error: 'TikTok posting requires manual upload (SDK integration in progress)',
    }
  }

  // Helper: upload image to X (returns media_id)
  private async uploadToX(accessToken: string, imageUrl: string): Promise<string> {
    const imageBuffer = await fetch(imageUrl).then(r => r.arrayBuffer())
    const response = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: new FormData().append('media_data', Buffer.from(imageBuffer).toString('base64')),
    })

    const data = await response.json()
    return data.media_id_string
  }
}

export const postingEngine = new PostingEngine()
