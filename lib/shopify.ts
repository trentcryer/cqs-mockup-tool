/**
 * Minimal Shopify Admin API client for CQS
 * Uses OAuth client_credentials flow with Client ID + Secret.
 * Server-only.
 */

const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01'

const SHOP = SHOPIFY_DOMAIN?.replace('.myshopify.com', '')

let cachedToken: string | null = null
let tokenExpiresAt = 0

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken

  if (!SHOP || !CLIENT_ID || !CLIENT_SECRET) {
    throw new ShopifyError('Shopify credentials not configured (SHOPIFY_STORE_DOMAIN / SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET)')
  }

  const res = await fetch(`https://${SHOP}.myshopify.com/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new ShopifyError(`Token request failed ${res.status}: ${text}`, res.status)
  }

  const { access_token, expires_in } = await res.json()
  cachedToken = access_token
  tokenExpiresAt = Date.now() + (expires_in ?? 3600) * 1000
  return access_token
}

export class ShopifyError extends Error {
  constructor(message: string, public status?: number) {
    super(message)
    this.name = 'ShopifyError'
  }
}

async function shopifyFetch<T>(path: string, options: RequestInit = {}, retries = 3): Promise<T> {
  const token = await getToken()
  const url = `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}${path}`

  const res = await fetch(url, {
    ...options,
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (res.status === 429 && retries > 0) {
    const wait = Math.ceil(parseFloat(res.headers.get('Retry-After') ?? '1') * 1000)
    await new Promise(r => setTimeout(r, wait))
    return shopifyFetch<T>(path, options, retries - 1)
  }

  if (!res.ok) {
    const text = await res.text()
    throw new ShopifyError(`Shopify API error ${res.status}: ${text}`, res.status)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : ({} as T)
}

export interface ShopifyProductInput {
  title: string
  body_html?: string
  vendor?: string
  product_type?: string
  tags?: string
  images?: Array<{ src: string; alt?: string }>
  variants?: Array<{ price?: string; option1?: string; option2?: string }>
}

export async function createProduct(input: ShopifyProductInput) {
  const payload = {
    product: {
      title: input.title,
      body_html: input.body_html || 'Custom design via CQS Mockup Studio',
      vendor: input.vendor || 'Custom Quartet Stuff',
      product_type: input.product_type || 'Barbershop Merch',
      tags: input.tags || 'cqs,barbershop,quartet,custom',
      images: (input.images || []).map((img, i) => ({
        src: img.src, alt: img.alt || `Mockup ${i + 1}`,
      })),
      variants: input.variants?.length ? input.variants : [{ price: '35.00' }],
    },
  }
  const data = await shopifyFetch<{ product: any }>('/products.json', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data.product
}

export async function updateProduct(productId: number, updates: Partial<ShopifyProductInput>) {
  const data = await shopifyFetch<{ product: any }>(`/products/${productId}.json`, {
    method: 'PUT',
    body: JSON.stringify({ product: updates }),
  })
  return data.product
}

export interface ShopifyCollection {
  id: number
  title: string
  handle: string
  type: 'custom' | 'smart'
  image: string | null
}

export async function listCollections(skipImages = false): Promise<ShopifyCollection[]> {
  const [custom, smart] = await Promise.all([
    shopifyFetch<{ custom_collections: any[] }>('/custom_collections.json?limit=250'),
    shopifyFetch<{ smart_collections: any[] }>('/smart_collections.json?limit=250'),
  ])

  const all = [
    ...(custom.custom_collections || []).map((c: any) => ({ id: c.id, title: c.title, handle: c.handle, type: 'custom' as const, image: c.image?.src ?? null })),
    ...(smart.smart_collections || []).map((c: any) => ({ id: c.id, title: c.title, handle: c.handle, type: 'smart' as const, image: c.image?.src ?? null })),
  ]

  if (skipImages) return all.sort((a, b) => a.title.localeCompare(b.title))

  // For collections without their own image, pull the first product's image.
  // Run sequentially to stay within Shopify's 2 calls/sec rate limit.
  const imageless = all.filter(c => !c.image)
  if (imageless.length > 0) {
    const fallbackMap = new Map<number, string | null>()
    for (const c of imageless) {
      try {
        const data = await shopifyFetch<{ products: any[] }>(
          `/products.json?collection_id=${c.id}&limit=1&fields=id,images`
        )
        fallbackMap.set(c.id, data.products?.[0]?.images?.[0]?.src ?? null)
      } catch {
        fallbackMap.set(c.id, null)
      }
    }
    return all
      .map(c => c.image ? c : { ...c, image: fallbackMap.get(c.id) ?? null })
      .sort((a, b) => a.title.localeCompare(b.title))
  }

  return all.sort((a, b) => a.title.localeCompare(b.title))
}

export async function createCollection(title: string): Promise<ShopifyCollection> {
  const data = await shopifyFetch<{ custom_collection: any }>('/custom_collections.json', {
    method: 'POST',
    body: JSON.stringify({ custom_collection: { title } }),
  })
  const c = data.custom_collection
  return { id: c.id, title: c.title, handle: c.handle, type: 'custom', image: c.image?.src ?? null }
}

export async function addProductToCollection(collectionId: number, productId: number): Promise<void> {
  await shopifyFetch<unknown>('/collects.json', {
    method: 'POST',
    body: JSON.stringify({ collect: { collection_id: collectionId, product_id: productId } }),
  })
}

export interface ShopifyCollectionProduct {
  id: number
  title: string
  status: 'active' | 'draft'
  image: string | null
  price: string | null
  collectId: number | null  // junction record ID — needed to remove from collection
}

export async function getProductsInCollection(collectionId: number, collectionType: 'custom' | 'smart' = 'custom'): Promise<ShopifyCollectionProduct[]> {
  const fetchCollects = collectionType === 'custom'
    ? shopifyFetch<{ collects: any[] }>(`/collects.json?collection_id=${collectionId}&limit=250`)
    : Promise.resolve({ collects: [] })

  const [productsData, collectsData] = await Promise.all([
    shopifyFetch<{ products: any[] }>(`/products.json?collection_id=${collectionId}&limit=250`),
    fetchCollects,
  ])
  const collectMap = new Map((collectsData.collects || []).map((c: any) => [c.product_id, c.id]))
  return (productsData.products || []).map((p: any) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    image: p.images?.[0]?.src || null,
    price: p.variants?.[0]?.price || null,
    collectId: collectMap.get(p.id) ?? null,
  }))
}

async function batchShopify(calls: (() => Promise<any>)[], batchSize = 5): Promise<void> {
  for (let i = 0; i < calls.length; i += batchSize) {
    await Promise.allSettled(calls.slice(i, i + batchSize).map(fn => fn()))
  }
}

export async function batchUpdateProductStatus(productIds: number[], status: 'active' | 'draft'): Promise<void> {
  await batchShopify(productIds.map(id => () =>
    shopifyFetch(`/products/${id}.json`, {
      method: 'PUT',
      body: JSON.stringify({ product: { id, status } }),
    })
  ))
}

export async function removeFromCollection(collectIds: number[]): Promise<void> {
  await batchShopify(collectIds.map(id => () =>
    shopifyFetch(`/collects/${id}.json`, { method: 'DELETE' })
  ))
}

export async function deleteProducts(productIds: number[]): Promise<void> {
  await batchShopify(productIds.map(id => () =>
    shopifyFetch(`/products/${id}.json`, { method: 'DELETE' })
  ))
}

export async function applyPriceSuggestion(productId: number, reductionPct = 0.15): Promise<void> {
  const data = await shopifyFetch<{ product: any }>(`/products/${productId}.json?fields=id,variants`)
  const variants: any[] = data.product?.variants ?? []
  if (!variants.length) return
  await shopifyFetch(`/products/${productId}.json`, {
    method: 'PUT',
    body: JSON.stringify({
      product: {
        id: productId,
        variants: variants.map(v => ({
          id: v.id,
          price: (parseFloat(v.price) * (1 - reductionPct)).toFixed(2),
        })),
      },
    }),
  })
}

// Internal: fetch with raw response to read Link header for cursor pagination
async function shopifyRawFetch(url: string, retries = 3): Promise<{ data: any; nextLink: string | null }> {
  const token = await getToken()
  const res = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
  })

  if (res.status === 429 && retries > 0) {
    const wait = Math.ceil(parseFloat(res.headers.get('Retry-After') ?? '1') * 1000)
    await new Promise(r => setTimeout(r, wait))
    return shopifyRawFetch(url, retries - 1)
  }

  if (!res.ok) {
    const text = await res.text()
    throw new ShopifyError(`Shopify API error ${res.status}: ${text}`, res.status)
  }
  const text = await res.text()
  const data = text ? JSON.parse(text) : {}
  const linkHeader = res.headers.get('Link')
  const nextMatch = linkHeader?.match(/<([^>]+)>;\s*rel="next"/)
  return { data, nextLink: nextMatch?.[1] ?? null }
}

export interface SalesLineItem {
  productId: number
  variantId: number
  quantity: number
  price: number
  orderedAt: string
  discountCodes: string[]
}

export async function getOrderLineItemsInDateRange(startDate: string, endDate: string): Promise<SalesLineItem[]> {
  if (!SHOPIFY_DOMAIN) throw new ShopifyError('Shopify domain not configured')

  const items: SalesLineItem[] = []
  let url: string | null =
    `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/orders.json` +
    `?status=any&financial_status=paid` +
    `&created_at_min=${encodeURIComponent(startDate)}` +
    `&created_at_max=${encodeURIComponent(endDate)}` +
    `&limit=250&fields=id,created_at,line_items,discount_codes`

  while (url) {
    const { data, nextLink } = await shopifyRawFetch(url)
    for (const order of data.orders ?? []) {
      const discountCodes: string[] = (order.discount_codes ?? []).map((d: any) => d.code as string)
      for (const item of order.line_items ?? []) {
        if (item.product_id) {
          items.push({
            productId: item.product_id,
            variantId: item.variant_id,
            quantity: item.quantity,
            price: parseFloat(item.price) || 0,
            orderedAt: order.created_at,
            discountCodes,
          })
        }
      }
    }
    url = nextLink
  }

  return items
}
