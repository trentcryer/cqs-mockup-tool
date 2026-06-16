export interface PromoPlatform {
  id: string
  label: string
  width: number
  height: number
}

export const PROMO_PLATFORMS: PromoPlatform[] = [
  { id: 'instagram-post', label: 'Instagram Post', width: 1080, height: 1080 },
  { id: 'instagram-story', label: 'Instagram / FB Story', width: 1080, height: 1920 },
  { id: 'facebook', label: 'Facebook Post', width: 1200, height: 630 },
  { id: 'x', label: 'X (Twitter)', width: 1600, height: 900 },
]

export function getPlatform(id: string): PromoPlatform {
  return PROMO_PLATFORMS.find(p => p.id === id) ?? PROMO_PLATFORMS[0]
}
