/**
 * Printful API Client for CQS Mockup Studio
 * Server-only. Uses PRINTFUL_API_KEY from .env
 * Reuses patterns from legacy Python cqs_mockup/client.py
 */

import { descriptionTextToHtml, sizeTablesToHtml } from './description-html'

const BASE_URL = 'https://api.printful.com'

export class PrintfulError extends Error {
  statusCode?: number
  constructor(message: string, statusCode?: number) {
    super(message)
    this.name = 'PrintfulError'
    this.statusCode = statusCode
  }
}

interface PrintfulResponse<T> {
  code: number
  result: T
  error?: { message?: string }
}

export interface PrintfulProduct {
  id: number
  title: string
  image?: string
  variants?: PrintfulVariant[]
}

export interface PrintfulVariant {
  id: number
  product_id: number
  name: string
  size?: string
  color?: string
  color_code?: string
  image?: string
  price?: string
  in_stock?: boolean
}

export interface PrintfulPrintfiles {
  available_placements: Record<string, string>
  printfiles: Array<{
    printfile_id: number
    width: number
    height: number
    dpi?: number
  }>
  variant_printfiles: Array<{
    variant_id: number
    placements: Record<string, number | null>
  }>
}

export interface PrintfulTemplate {
  template_id: number
  image_url: string
  background_url: string | null
  background_color: string | null
  template_width: number
  template_height: number
  print_area_width: number   // px — divide by template_width/height for CSS fractions
  print_area_height: number
  print_area_top: number
  print_area_left: number
  printfile_id: number
  orientation?: string
}

export interface PrintfulTemplatesResponse {
  templates: PrintfulTemplate[]
  variant_mapping: Array<{
    variant_id: number
    templates: Array<{ placement: string; template_id: number }>
  }>
}

export interface PrintfulPosition {
  area_width: number
  area_height: number
  width: number
  height: number
  top: number
  left: number
  rotation?: number   // degrees, supported by Printful mockup generator
}

export interface PrintfulDraftOrder {
  id: number
  external_id: string | null
  status: string
  created: number
  dashboard_url: string
  recipient: {
    name: string | null
    address1: string | null
    city: string
    state_code: string
    country_code: string
  }
  items: Array<{
    id: number
    name: string
    quantity: number
    product: {
      name: string
      image: string
    }
    files: Array<{
      type: string
      thumbnail_url: string | null
      preview_url: string | null
    }>
  }>
  retail_costs: {
    total: string
    currency: string
  }
  pricing_breakdown: Array<{
    profit: string
    currency_symbol: string
  }>
}

export interface MockupTaskResult {
  task_key: string
  status: 'pending' | 'completed' | 'failed'
  mockups?: Array<{
    mockup_url: string
    placement: string
    variant_ids: number[]
    extra?: Array<{ title: string; url: string }>
  }>
  error?: string
}

// Strips Printful boilerplate that's irrelevant to customers:
// sourcing/fulfillment location lines and the disclaimer paragraph.
export function cleanDescription(raw: string): string {
  const lines = raw.split('\n')
  const cleaned: string[] = []
  let inDisclaimer = false
  for (const line of lines) {
    const l = line.trim().toLowerCase()
    if (l.startsWith('disclaimer')) { inDisclaimer = true; continue }
    if (inDisclaimer && l === '') { inDisclaimer = false; continue }
    if (inDisclaimer) continue
    if (l.includes('sourced from')) continue
    if (l.includes('fulfillment location')) continue
    if (l.includes('blank product')) continue
    cleaned.push(line)
  }
  return cleaned.join('\n').trim()
}

class PrintfulClient {
  private apiKey: string
  private timeout: number

  constructor(apiKey?: string, timeout = 30000) {
    this.apiKey = apiKey || process.env.PRINTFUL_API_KEY!
    if (!this.apiKey) {
      throw new Error('PRINTFUL_API_KEY is required')
    }
    this.timeout = timeout
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: AbortSignal.timeout(this.timeout),
    })

    const data: PrintfulResponse<T> = await res.json()

    if (!res.ok || data.code >= 400) {
      const msg = data.error?.message || data.result || res.statusText
      throw new PrintfulError(String(msg), res.status)
    }

    return data.result
  }

  // --- Catalog ---
  async getProducts(): Promise<PrintfulProduct[]> {
    return this.request('/products')
  }

  async getProduct(productId: number): Promise<PrintfulProduct> {
    return this.request(`/products/${productId}`)
  }

  async getProductV2Info(productId: number): Promise<{
    description: string
    sizes: string[]
    sizeTables: Array<{ type: string; unit: string; measurements: Array<{ type_label: string; values: Array<{ size: string; value?: string; min_value?: string; max_value?: string }> }> }>
    colors: Array<{ name: string; value: string }>
  }> {
    const [productRes, sizesRes] = await Promise.allSettled([
      fetch(`${BASE_URL}/v2/catalog-products/${productId}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(8000),
      }),
      fetch(`${BASE_URL}/v2/catalog-products/${productId}/sizes`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(8000),
      }),
    ])

    let description = ''
    let sizes: string[] = []
    let sizeTables: any[] = []
    let colors: Array<{ name: string; value: string }> = []

    if (productRes.status === 'fulfilled' && productRes.value.ok) {
      const d = await productRes.value.json()
      description = cleanDescription(d.data?.description || '')
      colors = d.data?.colors || []
      sizes = d.data?.available_sizes || []
    }

    if (sizesRes.status === 'fulfilled' && sizesRes.value.ok) {
      const d = await sizesRes.value.json()
      sizeTables = d.data?.size_tables || []
      // sizes endpoint also carries available_sizes — use it when product endpoint failed
      if (!sizes.length) sizes = d.data?.available_sizes || []
    }

    // v2 product endpoint 404s for some region-restricted products (e.g. EU-only Adidas).
    // Fall back to v1 for description in that case.
    if (!description) {
      try {
        const v1Res = await fetch(`${BASE_URL}/products/${productId}`, {
          headers: { Authorization: `Bearer ${this.apiKey}` },
          signal: AbortSignal.timeout(8000),
        })
        if (v1Res.ok) {
          const v1 = await v1Res.json()
          description = cleanDescription(v1.result?.product?.description || '')
        }
      } catch {}
    }

    return { description, sizes, sizeTables, colors }
  }

  async getProductDescription(productId: number): Promise<string> {
    const [productRes, sizesRes] = await Promise.allSettled([
      fetch(`${BASE_URL}/v2/catalog-products/${productId}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(8000),
      }),
      fetch(`${BASE_URL}/v2/catalog-products/${productId}/sizes`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(8000),
      }),
    ])

    let description = ''
    let sizingHtml = ''

    if (productRes.status === 'fulfilled' && productRes.value.ok) {
      const d = await productRes.value.json()
      description = descriptionTextToHtml(cleanDescription(d.data?.description || ''))
    }

    if (sizesRes.status === 'fulfilled' && sizesRes.value.ok) {
      const d = await sizesRes.value.json()
      sizingHtml = sizeTablesToHtml(d.data?.size_tables || [])
    }

    return [description, sizingHtml].filter(Boolean).join('\n')
  }

  // --- Mockup Generator ---
  async getPrintfiles(productId: number): Promise<PrintfulPrintfiles> {
    return this.request(`/mockup-generator/printfiles/${productId}`)
  }

  async getTemplates(productId: number): Promise<PrintfulTemplatesResponse> {
    return this.request<PrintfulTemplatesResponse>(`/mockup-generator/templates/${productId}`)
  }

  /**
   * Upload a file (logo) to Printful.
   * Accepts Buffer or base64 string.
   */
  async uploadFile(file: Buffer | string, filename: string): Promise<{ id: number; url: string; preview_url?: string }> {
    const isUrl = typeof file === 'string' && (file.startsWith('http://') || file.startsWith('https://'))
    const body = isUrl
      ? { url: file, filename }
      : { data: typeof file === 'string' ? file : file.toString('base64'), filename }

    const result = await this.request<any>('/files', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    let fileUrl = result.url || result.preview_url || result.thumbnail_url

    // Printful sometimes returns url: null while processing large files — poll by ID
    if (!fileUrl && result.id) {
      for (let i = 0; i < 8; i++) {
        await new Promise(r => setTimeout(r, 2000))
        const fetched = await this.request<any>(`/files/${result.id}`)
        fileUrl = fetched.url || fetched.preview_url
        if (fileUrl) { result.url = fileUrl; break }
      }
    }

    if (!fileUrl) throw new PrintfulError('Printful file upload returned no URL after polling')
    result.url = fileUrl
    return result
  }

  async listFiles(limit = 100, offset = 0): Promise<Array<{
    id: number; url: string; preview_url: string; thumbnail_url: string
    filename: string; type: string; status: string; created: number; visible: boolean
  }>> {
    // v1 has no list endpoint — v2 requires X-PF-Store-Id
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    }
    if (process.env.PRINTFUL_STORE_ID) headers['X-PF-Store-Id'] = process.env.PRINTFUL_STORE_ID
    const res = await fetch(`${BASE_URL}/v2/files?limit=${limit}&offset=${offset}`, {
      headers,
      signal: AbortSignal.timeout(this.timeout),
    })
    const json = await res.json()
    if (!res.ok) throw new PrintfulError(json?.error?.message || res.statusText, res.status)
    return json?.data ?? []
  }

  /**
   * Create a mockup generation task.
   * This is the key method for turning (logo + placement + position) into beautiful photos.
   * Pass a single placement or a pre-built files array for multi-placement tasks (e.g. entire shirt).
   */
  async createMockupTask(params: {
    product_id: number
    variant_ids: number[]
    placement?: string
    image_url?: string
    position?: PrintfulPosition
    files?: Array<{ placement: string; url: string; position: PrintfulPosition }>
    format?: 'jpg' | 'png'
  }): Promise<string> {
    const { product_id, variant_ids, format = 'jpg' } = params

    const files = params.files ?? [
      { placement: params.placement!, url: params.image_url!, position: params.position! }
    ]

    const result = await this.request<{ task_key: string }>(
      `/mockup-generator/create-task/${product_id}`,
      { method: 'POST', body: JSON.stringify({ variant_ids, format, files }) }
    )
    return result.task_key
  }

  async getTask(taskKey: string): Promise<MockupTaskResult> {
    return this.request(`/mockup-generator/task?task_key=${taskKey}`)
  }

  /**
   * Poll until completed or failed (up to ~60s default).
   */
  /**
   * Creates a sync product in your Printful store (Order Management API).
   * This is separate from the Mockup Generator — it creates a real fulfillable product.
   * The optional PRINTFUL_STORE_ID env var scopes the request to a specific store
   * (needed only if your API key has access to multiple stores).
   */
  async createSyncProduct(params: {
    name: string
    externalProductId?: string               // existing Shopify product ID to link
    variantIds: number[]
    variantExternalIds?: Record<number, string>  // Printful variant ID → Shopify variant ID
    placement: string
    imageUrl: string
    position: PrintfulPosition
    retailPrice?: string
    variantPrices?: Record<number, string>
  }): Promise<{ id: number; name: string; external_id?: string; sync_variants?: any[] }> {
    const { name, externalProductId, variantIds, variantExternalIds, placement, imageUrl, position, retailPrice = '35.00', variantPrices } = params

    const body = {
      sync_product: {
        name,
        ...(externalProductId ? { external_id: externalProductId } : {}),
      },
      sync_variants: variantIds.map(variantId => ({
        variant_id: variantId,
        retail_price: variantPrices?.[variantId] ?? retailPrice,
        ...(variantExternalIds?.[variantId] ? { external_id: variantExternalIds[variantId] } : {}),
        files: [{ placement, url: imageUrl, position }],
      })),
    }

    const extraHeaders: Record<string, string> = {}
    if (process.env.PRINTFUL_STORE_ID) {
      extraHeaders['X-PF-Store-Id'] = process.env.PRINTFUL_STORE_ID
    }

    const result = await this.request<{
      sync_product: { id: number; name: string; external_id?: string }
      sync_variants?: any[]
    }>(
      '/store/products',
      { method: 'POST', body: JSON.stringify(body), headers: extraHeaders }
    )
    return {
      id: result.sync_product.id,
      name: result.sync_product.name,
      external_id: result.sync_product.external_id,
      sync_variants: result.sync_variants,
    }
  }

  async createDraftOrder(params: {
    externalId?: string
    recipient: {
      name: string
      address1: string
      address2?: string
      city: string
      state_code: string
      country_code: string
      zip: string
      email?: string
      phone?: string
    }
    items: Array<{
      variantId: number
      quantity: number
      retailPrice?: string
      files: Array<{ placement: string; url: string; position: PrintfulPosition }>
    }>
  }): Promise<{ id: number; status: string; external_id?: string }> {
    const body = {
      ...(params.externalId ? { external_id: params.externalId } : {}),
      recipient: params.recipient,
      items: params.items.map(item => ({
        variant_id: item.variantId,
        quantity: item.quantity,
        ...(item.retailPrice ? { retail_price: item.retailPrice } : {}),
        files: item.files.map(f => ({ placement: f.placement, url: f.url, position: f.position })),
      })),
    }

    const extraHeaders: Record<string, string> = {}
    if (process.env.PRINTFUL_STORE_ID) {
      extraHeaders['X-PF-Store-Id'] = process.env.PRINTFUL_STORE_ID
    }

    return this.request<{ id: number; status: string; external_id?: string }>(
      '/orders',
      { method: 'POST', body: JSON.stringify(body), headers: extraHeaders }
    )
  }

  async getDraftOrders(): Promise<PrintfulDraftOrder[]> {
    const extraHeaders: Record<string, string> = {}
    if (process.env.PRINTFUL_STORE_ID) {
      extraHeaders['X-PF-Store-Id'] = process.env.PRINTFUL_STORE_ID
    }
    return this.request<PrintfulDraftOrder[]>(
      '/orders?status=draft&limit=100',
      { headers: extraHeaders }
    )
  }

  async confirmOrder(orderId: number): Promise<{ id: number; status: string }> {
    const extraHeaders: Record<string, string> = {}
    if (process.env.PRINTFUL_STORE_ID) {
      extraHeaders['X-PF-Store-Id'] = process.env.PRINTFUL_STORE_ID
    }
    return this.request<{ id: number; status: string }>(
      `/orders/${orderId}/confirm`,
      { method: 'POST', headers: extraHeaders }
    )
  }

  async pollTask(
    taskKey: string,
    intervalMs = 3000,
    maxPolls = 20
  ): Promise<MockupTaskResult> {
    for (let i = 0; i < maxPolls; i++) {
      const result = await this.getTask(taskKey)
      if (result.status === 'completed') return result
      if (result.status === 'failed') {
        throw new PrintfulError(`Mockup task failed: ${result.error || 'unknown error'}`)
      }
      await new Promise((r) => setTimeout(r, intervalMs))
    }
    throw new Error(`Mockup task timed out after ${maxPolls * intervalMs}ms`)
  }
}

// Singleton-style accessor (safe for server)
let _client: PrintfulClient | null = null

export function getPrintfulClient(): PrintfulClient {
  if (!_client) {
    _client = new PrintfulClient()
  }
  return _client
}

export { PrintfulClient }

// Helper: compute centered position (legacy behavior, used as fallback)
export function getDefaultPrintPosition(
  printfiles: PrintfulPrintfiles,
  placement: string,
  variantIds: number[],
  scale = 0.75
): PrintfulPosition {
  const pfMap = new Map(printfiles.printfiles.map((p) => [p.printfile_id, p]))
  
  for (const vp of printfiles.variant_printfiles) {
    if (variantIds.includes(vp.variant_id)) {
      const pfId = vp.placements[placement]
      if (pfId && pfMap.has(pfId)) {
        const pf = pfMap.get(pfId)!
        const aw = pf.width
        const ah = pf.height
        const w = Math.round(aw * scale)
        const h = Math.round(ah * scale)
        return {
          area_width: aw,
          area_height: ah,
          width: w,
          height: h,
          top: Math.round((ah - h) / 2),
          left: Math.round((aw - w) / 2),
        }
      }
    }
  }

  // Fallback square area
  const aw = 1800
  const ah = 1800
  const w = Math.round(aw * scale)
  const h = Math.round(ah * scale)
  return {
    area_width: aw,
    area_height: ah,
    width: w,
    height: h,
    top: Math.round((ah - h) / 2),
    left: Math.round((aw - w) / 2),
  }
}

/**
 * Converts a normalised editor transform into a Printful position object.
 * Shared by the mockup generator route and the admin approval action.
 */
export function transformToPosition(
  transform: { normLeft: number; normTop: number; normWidth: number; normHeight: number; angle?: number },
  area: { width: number; height: number }
): PrintfulPosition {
  const aw = area.width
  const ah = area.height

  // normWidth and normHeight are both fractions of print-area WIDTH (not height).
  // buildTransform() sets normHeight = normWidth * logoAspect, preserving pixel ratio
  // relative to the width axis. Multiplying h by ah instead of aw would stretch the
  // logo vertically on any non-square print area (e.g. shirts are 1800×2400).
  let w = Math.round((transform.normWidth ?? 0.35) * aw)
  let h = Math.round((transform.normHeight ?? 0.35) * aw)  // aw, not ah
  w = Math.max(10, Math.min(aw, w))
  h = Math.max(10, Math.min(ah, h))

  // normLeft is a fraction of WIDTH → multiply by aw.
  // normTop  is a fraction of HEIGHT → multiply by ah.
  // Do NOT recover-center via normHeight (a width-fraction) then subtract — that mixes
  // units and shifts the logo down on tall non-square print areas (e.g. +150px on a
  // 1800×2400 t-shirt front at 50% logo size).
  let left = Math.round((transform.normLeft ?? 0) * aw)
  let top  = Math.round((transform.normTop  ?? 0) * ah)
  left = Math.max(0, Math.min(aw - w, left))
  top  = Math.max(0, Math.min(ah - h, top))

  const rotation = Math.round(transform.angle ?? 0)
  return { area_width: aw, area_height: ah, width: w, height: h, left, top, rotation }
}

/**
 * Returns the printfile object for a given placement + variant combo.
 * Includes fill_mode: 'cover' for AOP/DTF-fabric products.
 */
export function getPrintfileForPlacement(
  printfiles: PrintfulPrintfiles,
  placement: string,
  variantIds: number[]
): { printfile_id: number; width: number; height: number; fill_mode?: string } | null {
  const pfMap = new Map(printfiles.printfiles.map((p) => [p.printfile_id, p as any]))
  for (const vp of printfiles.variant_printfiles || []) {
    if (variantIds.includes(vp.variant_id)) {
      const pfId = vp.placements?.[placement]
      if (pfId && pfMap.has(pfId)) return pfMap.get(pfId)!
    }
  }
  return null
}

/**
 * Returns the real Printful print area dimensions (in their coordinate space)
 * for a given placement + variant. Used for accurate transform mapping.
 */
export function getPrintAreaForPlacement(
  printfiles: PrintfulPrintfiles,
  placement: string,
  variantIds: number[]
): { width: number; height: number } | null {
  const pfMap = new Map(printfiles.printfiles.map((p) => [p.printfile_id, p]))

  for (const vp of printfiles.variant_printfiles || []) {
    if (variantIds.includes(vp.variant_id)) {
      const pfId = vp.placements?.[placement]
      if (pfId && pfMap.has(pfId)) {
        const pf = pfMap.get(pfId)!
        if (pf.width && pf.height) {
          return { width: pf.width, height: pf.height }
        }
      }
    }
  }
  return null
}