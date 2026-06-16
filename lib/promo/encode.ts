import type { PromoProduct } from './templates'

export interface PromoData {
  templateId: string
  platformId: string
  groupName: string
  products: PromoProduct[]
  logoPath?: string
}

// Returns the raw JSON string. Callers must put it into a URL via
// URLSearchParams (which encodes once) — never concatenate it into a
// query string directly, and never call encodeURIComponent on it.
export function encodePromoData(data: PromoData): string {
  return JSON.stringify(data)
}

// `raw` must come from searchParams.get(...) — the framework already
// decoded it once when parsing the URL.
export function decodePromoData(raw: string): PromoData {
  return JSON.parse(raw)
}
