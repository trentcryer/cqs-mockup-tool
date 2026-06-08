/**
 * Printful API Client for CQS Mockup Studio
 * Server-only. Uses PRINTFUL_API_KEY from .env
 * Reuses patterns from legacy Python cqs_mockup/client.py
 */

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

    const result = await this.request<{ id: number; url?: string; preview_url?: string }>('/files', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    if (!result.url && result.preview_url) {
      result.url = result.preview_url
    }
    return result as any
  }

  /**
   * Create a mockup generation task.
   * This is the key method for turning (logo + placement + position) into beautiful photos.
   */
  async createMockupTask(params: {
    product_id: number
    variant_ids: number[]
    placement: string
    image_url?: string
    image_data?: string  // base64-encoded image (preferred — avoids URL accessibility issues)
    position: PrintfulPosition
    format?: 'jpg' | 'png'
  }): Promise<string> {
    const { product_id, variant_ids, placement, image_url, image_data, position, format = 'jpg' } = params

    const fileEntry: Record<string, any> = { placement, position }
    if (image_data) {
      fileEntry.data = image_data
    } else {
      fileEntry.url = image_url
    }

    const body = {
      variant_ids,
      format,
      files: [fileEntry],
    }

    const result = await this.request<{ task_key: string }>(
      `/mockup-generator/create-task/${product_id}`,
      { method: 'POST', body: JSON.stringify(body) }
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
    variantIds: number[]
    placement: string
    imageUrl: string
    position: PrintfulPosition
    retailPrice?: string                          // flat price for all variants
    variantPrices?: Record<number, string>        // per-variant prices (overrides retailPrice)
  }): Promise<{ id: number; name: string }> {
    const { name, variantIds, placement, imageUrl, position, retailPrice = '35.00', variantPrices } = params

    const body = {
      sync_product: { name },
      sync_variants: variantIds.map(variantId => ({
        variant_id: variantId,
        retail_price: variantPrices?.[variantId] ?? retailPrice,
        files: [{ placement, url: imageUrl, position }],
      })),
    }

    const extraHeaders: Record<string, string> = {}
    if (process.env.PRINTFUL_STORE_ID) {
      extraHeaders['X-PF-Store-Id'] = process.env.PRINTFUL_STORE_ID
    }

    // Printful v1: result = { sync_product: {...}, sync_variants: [...] }
    const result = await this.request<{ sync_product: { id: number; name: string } }>(
      '/store/products',
      { method: 'POST', body: JSON.stringify(body), headers: extraHeaders }
    )
    return result.sync_product
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
  let w = Math.round((transform.normWidth ?? 0.5) * aw)
  let h = Math.round((transform.normHeight ?? 0.5) * ah)
  let left = Math.round((transform.normLeft ?? 0.25) * aw)
  let top = Math.round((transform.normTop ?? 0.25) * ah)
  const rotation = Math.round(transform.angle ?? 0)
  w = Math.max(10, Math.min(aw, w))
  h = Math.max(10, Math.min(ah, h))
  left = Math.max(0, Math.min(aw - w, left))
  top = Math.max(0, Math.min(ah - h, top))
  return { area_width: aw, area_height: ah, width: w, height: h, left, top, rotation }
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