import { getAccessToken } from './supabase'

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL!

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers, signal: AbortSignal.timeout(15_000) })
  const body = await res.json().catch(() => null)

  if (!res.ok) {
    throw new ApiError(body?.error || res.statusText, res.status)
  }
  return body as T
}

// For endpoints that take multipart FormData and return raw binary (e.g. remove-background).
// Deliberately omits Content-Type so fetch sets the multipart boundary itself.
export async function apiUploadBinary(path: string, formData: FormData): Promise<ArrayBuffer> {
  const token = await getAccessToken()
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body: formData, signal: AbortSignal.timeout(30_000) })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(body?.error || res.statusText, res.status)
  }
  return res.arrayBuffer()
}
