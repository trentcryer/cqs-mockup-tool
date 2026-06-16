export interface Profile {
  id: string
  quartet_name: string
  email: string | null
  group_type: 'quartet' | 'chorus'
  shopify_collection_id: string | null
  shopify_collection_title: string | null
  is_admin: boolean
}

export interface PromoProduct {
  id: number
  title: string
  image: string
  price?: string | null
  url: string
}

export interface PromoLogo {
  id: string
  storagePath: string
  displayUrl: string | null
  filename: string
}

export interface PromoTemplateMeta {
  id: string
  label: string
  description: string
  caption: string
}

export interface PromoPlatform {
  id: string
  label: string
  width: number
  height: number
}

export interface Logo {
  id: string
  user_id: string
  storage_path: string
  filename: string
  displayUrl?: string | null
}

export interface Design {
  id: string
  user_id: string
  product_id: number
  product_title: string
  color: string | null
  placement: string
  logo_path: string | null
  variant_ids: number[] | null
  transform: {
    normLeft: number; normTop: number; normWidth: number; normHeight: number; angle?: number; opacity?: number
  } | null
  color_variant_map: Record<string, number[]> | null
  notes: string | null
  status: 'draft' | 'review_requested' | 'approved' | 'pushed_to_shopify'
  mockup_urls: Array<{ mockup_url: string }> | null
}

export interface AdminVariantPrice {
  variantId: number
  name: string
  size: string | null
  color: string | null
  printfulCost: number
}

export interface PricingData {
  mode: 'flat' | 'by_size'
  flatPrice?: string
  variantPrices?: Record<number, string>
  kickbackEnabled: boolean
  kickbackPercent: number
}

export interface GroupProduct {
  id: number
  title: string
  image?: string
  price?: string
  status: 'active' | 'draft'
}

export interface ReportProduct {
  productId: number
  title: string
  image?: string
  price?: string
  unitsSold: number
  revenue: number
  lastSoldAt: string | null
}

export interface GroupReport {
  products: ReportProduct[]
  totalUnits: number
  totalRevenue: number
}
