import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Same patterns as the catalog page CATEGORIES — keeps them in sync
const CATEGORY_PATTERNS: { key: string; test: RegExp }[] = [
  { key: 'tees',        test: /t-?shirt|tee\b/i },
  { key: 'polos',       test: /polo/i },
  { key: 'hoodies',     test: /hoodie|sweatshirt|crewneck|crew neck/i },
  { key: 'performance', test: /performance|sport|athletic|moisture|dri.?fit|quarter.?zip/i },
  { key: 'jackets',     test: /jacket|vest|windbreaker|zip.?up/i },
  { key: 'hats',        test: /\bhat\b|\bcap\b|beanie/i },
  { key: 'accessories', test: /bag|tote|mug|bottle|apron|blanket|pillow|towel|case|cushion|face\s*mask/i },
  { key: 'aop',         test: /all.?over/i },
  { key: 'embroidery',  test: /embroid/i },
]

function categorize(productTitle: string): string | null {
  for (const cat of CATEGORY_PATTERNS) {
    if (cat.test.test(productTitle)) return cat.key
  }
  return null
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// Cache the result for 5 minutes so repeated page loads don't hammer Supabase
let cache: { data: Record<string, string>; ts: number } | null = null
const CACHE_TTL = 5 * 60 * 1000

export async function GET() {
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data)
  }

  const admin = createAdminClient()

  const { data: designs } = await (admin as any)
    .from('designs')
    .select('product_title, mockup_urls')
    .eq('status', 'approved')
    .not('mockup_urls', 'is', null)

  const candidates: Record<string, string[]> = {}

  for (const design of (designs || [])) {
    const cat = categorize(design.product_title || '')
    if (!cat) continue

    const mockups: any[] = design.mockup_urls || []
    // Only use fully-resolved http URLs (not Supabase storage paths)
    const url = mockups.find((m: any) => typeof m.mockup_url === 'string' && m.mockup_url.startsWith('http'))?.mockup_url
    if (!url) continue

    if (!candidates[cat]) candidates[cat] = []
    candidates[cat].push(url)
  }

  // Also populate 'all' and 'favorites' with any approved design
  const allUrls = Object.values(candidates).flat()
  if (allUrls.length) {
    candidates['all'] = allUrls
    candidates['favorites'] = allUrls
  }

  const result: Record<string, string> = {}
  for (const [cat, urls] of Object.entries(candidates)) {
    result[cat] = pickRandom(urls)
  }

  cache = { data: result, ts: Date.now() }
  return NextResponse.json(result)
}
