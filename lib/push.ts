/**
 * Expo Push Notification sender — server side.
 * Uses Expo's push API, no additional SDK needed.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

interface PushMessage {
  to: string | string[]
  title: string
  body: string
  data?: Record<string, unknown>
  sound?: 'default' | null
  badge?: number
  channelId?: string
}

export async function sendPush(messages: PushMessage | PushMessage[]) {
  const payload = Array.isArray(messages) ? messages : [messages]
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Push failed ${res.status}: ${text}`)
  }
  return res.json()
}

export async function sendPushToUser(pushToken: string, title: string, body: string, data?: Record<string, unknown>) {
  if (!pushToken?.startsWith('ExponentPushToken[')) return
  return sendPush({ to: pushToken, title, body, data, sound: 'default' })
}

export async function sendPushToMany(pushTokens: string[], title: string, body: string, data?: Record<string, unknown>) {
  const valid = pushTokens.filter(t => t?.startsWith('ExponentPushToken['))
  if (valid.length === 0) return
  return sendPush(valid.map(to => ({ to, title, body, data, sound: 'default' })))
}
