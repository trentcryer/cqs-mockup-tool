/**
 * Minimal Shopify Admin API client for CQS
 * Used by admin to "push approved design" → creates a draft product with mockup images
 * Server-only
 */

const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10'

interface ShopifyProductInput {
  title: string
  body_html?: string
  vendor?: string
  product_type?: string
  tags?: string
  images?: Array<{ src: string; alt?: string }>
  variants?: Array<{
    price?: string
    option1?: string // e.g. color
    option2?: string // size if known
  }>
}

export class ShopifyError extends Error {
  constructor(message: string, public status?: number) {
    super(message)
    this.name = 'ShopifyError'
  }
}

async function shopifyFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!SHOPIFY_DOMAIN || !SHOPIFY_TOKEN) {
    throw new ShopifyError('Shopify credentials not configured (SHOPIFY_STORE_DOMAIN / SHOPIFY_ADMIN_ACCESS_TOKEN)')
  }

  const url = `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_TOKEN,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new ShopifyError(`Shopify API error ${res.status}: ${text}`, res.status)
  }
  return res.json()
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
        src: img.src,
        alt: img.alt || `Mockup ${i + 1}`,
      })),
      variants: input.variants?.length
        ? input.variants
        : [{ price: '35.00' }], // sensible default for merch
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
}

// Returns all custom collections (up to 250). For stores with 250+ collections,
// add cursor-based pagination using the Link response header.
export async function listCollections(): Promise<ShopifyCollection[]> {
  const data = await shopifyFetch<{ custom_collections: any[] }>(
    '/custom_collections.json?limit=250'
  )
  return (data.custom_collections || []).map((c: any) => ({
    id: c.id,
    title: c.title,
    handle: c.handle,
  }))
}

export async function createCollection(title: string): Promise<ShopifyCollection> {
  const data = await shopifyFetch<{ custom_collection: any }>('/custom_collections.json', {
    method: 'POST',
    body: JSON.stringify({ custom_collection: { title } }),
  })
  const c = data.custom_collection
  return { id: c.id, title: c.title, handle: c.handle }
}

export async function addProductToCollection(collectionId: number, productId: number): Promise<void> {
  await shopifyFetch<unknown>('/collects.json', {
    method: 'POST',
    body: JSON.stringify({ collect: { collection_id: collectionId, product_id: productId } }),
  })
}