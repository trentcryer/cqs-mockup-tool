import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { postingEngine } from '@/lib/posting-engine'

export const runtime = 'nodejs'

/**
 * POST /api/social/post
 * Post to multiple platforms at once (Barber-Feed, Facebook, Instagram, X, LinkedIn)
 *
 * Body: {
 *   caption: string,
 *   media_url: string (storage path or public URL),
 *   content_type: 'image' | 'video',
 *   product_id?: number,
 *   product_title?: string,
 *   platforms: SocialPlatform[]
 * }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Get user's group (profile where user is the group admin)
  const { data: profile } = await (admin.from('profiles') as any)
    .select('id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  }

  try {
    const body = await req.json()
    const { caption, media_url, content_type, product_id, product_title, platforms } = body

    // Validate
    if (!media_url || !content_type || !Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['image', 'video'].includes(content_type)) {
      return NextResponse.json({ error: 'Invalid content_type' }, { status: 400 })
    }

    // Get group's social connections
    const { data: connections } = await (admin.from('social_connections') as any)
      .select('*')
      .eq('group_id', profile.id)

    // Post to all platforms
    const result = await postingEngine.postToMultiplePlatforms(
      profile.id,
      { caption, media_url, content_type, product_id, product_title, platforms },
      connections || []
    )

    // If posted to barber-feed, trigger push notifications to followers
    if (result.barber_feed_post_id) {
      await notifyFollowers(admin, profile.id, result.barber_feed_post_id, profile.quartet_name || 'A group')
    }

    return NextResponse.json(result)
  } catch (e: any) {
    console.error('[Posting Engine Error]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

/**
 * Send push notifications to all followers of a group when new content is posted
 */
async function notifyFollowers(admin: any, group_id: string, post_id: string, group_name: string) {
  try {
    // Get all followers
    const { data: followers } = await admin
      .from('feed_followers')
      .select('user_id')
      .eq('group_id', group_id)

    if (!followers || followers.length === 0) return

    // Get their push subscriptions
    const { data: subscriptions } = await admin
      .from('push_subscriptions')
      .select('*')
      .in('user_id', followers.map((f: any) => f.user_id))

    if (!subscriptions || subscriptions.length === 0) return

    // Send push notifications
    const notificationPayload = {
      title: `${group_name} posted new content`,
      body: 'Check out their latest on the Barber Feed',
      icon: '/icon-192x192.png',
      badge: '/icon-96x96.png',
      click_action: `/barber-feed/post/${post_id}`,
      tag: `post-${post_id}`,
    }

    // Queue notifications (in a real system, use a job queue)
    subscriptions.forEach((sub: any) => {
      // Send via Web Push API (server-side)
      sendWebPushNotification(sub, notificationPayload).catch(e => console.error('[Push error]', e))
    })
  } catch (e: any) {
    console.error('[Notification error]', e)
    // Don't fail the post if notifications fail
  }
}

/**
 * Send Web Push notification
 */
async function sendWebPushNotification(subscription: any, payload: any) {
  // NOTE: In production, use a library like 'web-push'
  // For now, this is a placeholder
  const webPush = require('web-push') // Install: npm install web-push

  try {
    await webPush.sendNotification(subscription, JSON.stringify(payload))
  } catch (e: any) {
    if (e.statusCode === 410) {
      // Subscription expired, delete it
      // await admin.from('push_subscriptions').delete().eq('id', subscription.id)
    } else {
      throw e
    }
  }
}
