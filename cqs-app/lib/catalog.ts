export interface ColorOption { name: string; value: string }

export interface PrintfulProduct {
  id: number
  title: string
  image?: string
  printMethod?: 'embroidery' | 'aop' | 'standard'
  description?: string
  colors?: ColorOption[]
  favorite?: boolean
}

export const CATEGORIES = [
  { key: 'favorites', label: '★ Favorites' },
  { key: 'all', label: 'All Products' },
  { key: 'tees', label: 'T-Shirts', test: /t-?shirt|tee\b/i },
  { key: 'polos', label: 'Polos & Shirts', test: /polo/i },
  { key: 'hoodies', label: 'Hoodies', test: /hoodie|sweatshirt|crewneck|crew neck/i },
  { key: 'performance', label: 'Performance', test: /performance|sport|athletic|moisture|dri.?fit/i },
  { key: 'jackets', label: 'Jackets', test: /jacket|vest|windbreaker|zip.?up/i },
  { key: 'hats', label: 'Hats & Caps', test: /\bhat\b|\bcap\b|beanie/i },
  { key: 'accessories', label: 'Accessories', test: /bag|tote|mug|bottle|apron|blanket|pillow|towel|case|cushion|face\s*mask/i },
  { key: 'aop', label: 'All-Over Print', test: /all.?over/i },
  { key: 'embroidery', label: 'Embroidery', test: /embroidery/i },
]

export const PRINT_METHODS = [
  { key: 'all', label: 'All Methods' },
  { key: 'standard', label: 'Standard Print' },
  { key: 'embroidery', label: 'Embroidery' },
  { key: 'aop', label: 'All-Over Print' },
]

export function matchesCategory(p: PrintfulProduct, key: string): boolean {
  if (key === 'favorites') return !!p.favorite
  const cat = CATEGORIES.find(c => c.key === key)
  if (!cat || key === 'all') return p.printMethod !== 'aop'
  if (!cat.test) return false
  if (key === 'aop') return p.printMethod === 'aop' || cat.test.test(p.title)
  if (key === 'embroidery') return p.printMethod === 'embroidery' || cat.test.test(p.title)
  if (p.printMethod === 'aop') return false
  return cat.test.test(p.title)
}

export function descriptionIntro(description: string): string {
  if (!description) return ''
  const firstLine = description.split('\n').find(l => l.trim() && !l.trim().startsWith('•'))
  return firstLine?.trim() || ''
}

export function descriptionParts(description: string): { intro: string; bullets: string[] } {
  if (!description) return { intro: '', bullets: [] }
  const lines = description.split('\n').map(l => l.trim()).filter(Boolean)
  const introLines: string[] = []
  const bullets: string[] = []
  let seenBullet = false
  for (const line of lines) {
    if (line.startsWith('•')) { seenBullet = true; bullets.push(line.slice(1).trim()) }
    else if (!seenBullet) introLines.push(line)
  }
  return { intro: introLines.join(' '), bullets }
}

export const PAGE_SIZE = 36
