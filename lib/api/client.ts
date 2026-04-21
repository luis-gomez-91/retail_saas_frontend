import { getApiBaseUrl } from '@/lib/env'
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from '@/lib/auth/storage'
import type { TokenPair } from '@/lib/types/api'

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Mensaje legible cuando `instanceof ApiError` falla (p. ej. duplicado de bundle). */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}

function formatDrfErrorBody(json: unknown): string {
  if (typeof json !== 'object' || json === null) return ''
  const o = json as Record<string, unknown>
  if (typeof o.detail === 'string') return o.detail
  if (Array.isArray(o.detail) && o.detail.length > 0) {
    const first = o.detail[0]
    if (typeof first === 'string') return first
  }
  const parts: string[] = []
  for (const [k, v] of Object.entries(o)) {
    if (k === 'detail') continue
    if (Array.isArray(v) && v.every((x) => typeof x === 'string')) {
      parts.push(`${k}: ${v.join(', ')}`)
    }
  }
  return parts.join(' · ') || ''
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken()
  if (!refresh) return null
  const res = await fetch(`${getApiBaseUrl()}/api/auth/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  })
  if (!res.ok) {
    clearTokens()
    return null
  }
  const data = (await res.json()) as Partial<TokenPair>
  if (!data.access) {
    clearTokens()
    return null
  }
  setTokens(data.access, data.refresh ?? refresh)
  return data.access
}

export type ApiFetchOptions = RequestInit & {
  /** Por defecto true: añade Authorization si hay access token */
  auth?: boolean
  /** Si es true, no reintenta refresh en 401 */
  skipRefresh?: boolean
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { auth = true, skipRefresh = false, headers: initHeaders, ...rest } =
    options
  const headers = new Headers(initHeaders)
  if (!headers.has('Content-Type') && rest.body != null) {
    headers.set('Content-Type', 'application/json')
  }
  if (auth) {
    const access = getAccessToken()
    if (access) headers.set('Authorization', `Bearer ${access}`)
  }

  const url = path.startsWith('http') ? path : `${getApiBaseUrl()}${path}`
  let res = await fetch(url, { ...rest, headers })

  if (res.status === 401 && auth && !skipRefresh) {
    const newAccess = await refreshAccessToken()
    if (newAccess) {
      const retryHeaders = new Headers(headers)
      retryHeaders.set('Authorization', `Bearer ${newAccess}`)
      res = await fetch(url, { ...rest, headers: retryHeaders })
    }
  }

  const text = await res.text()
  let json: unknown = undefined
  if (text) {
    try {
      json = JSON.parse(text) as unknown
    } catch {
      json = text
    }
  }

  if (!res.ok) {
    const fromBody =
      typeof json === 'object' && json !== null
        ? formatDrfErrorBody(json)
        : typeof json === 'string' && json
          ? json
          : ''
    const message =
      fromBody || res.statusText || 'Error de API'
    throw new ApiError(message, res.status, json)
  }

  return json as T
}

export async function loginRequest(
  username: string,
  password: string,
  tenantDomain?: string
): Promise<TokenPair> {
  return apiFetch<TokenPair>('/api/auth/token/', {
    method: 'POST',
    body: JSON.stringify({
      username,
      password,
      tenant_domain: tenantDomain?.trim() || undefined,
    }),
    auth: false,
    skipRefresh: true,
  })
}

export async function loginWithGoogleCredential(
  credential: string,
  tenantDomain?: string
): Promise<TokenPair> {
  return apiFetch<TokenPair>('/api/auth/google/', {
    method: 'POST',
    body: JSON.stringify({
      credential,
      tenant_domain: tenantDomain?.trim() || undefined,
    }),
    auth: false,
    skipRefresh: true,
  })
}

export type EmailOtpRequestResponse = {
  detail: string
  code_sent: boolean
  expires_in_seconds?: number
  resend_cooldown_seconds?: number
}

export async function requestEmailOtp(
  email: string,
  tenantDomain?: string
): Promise<EmailOtpRequestResponse> {
  return apiFetch<EmailOtpRequestResponse>('/api/auth/otp/request/', {
    method: 'POST',
    body: JSON.stringify({
      email,
      tenant_domain: tenantDomain?.trim() || undefined,
    }),
    auth: false,
    skipRefresh: true,
  })
}

export async function verifyEmailOtp(
  email: string,
  code: string,
  tenantDomain?: string
): Promise<TokenPair> {
  return apiFetch<TokenPair>('/api/auth/otp/verify/', {
    method: 'POST',
    body: JSON.stringify({
      email,
      code,
      tenant_domain: tenantDomain?.trim() || undefined,
    }),
    auth: false,
    skipRefresh: true,
  })
}

export type PublicAuthProviderOption = {
  id: string
  code: string
  name: string
  sort_order: number
}

export type PublicAuthProvidersPayload = {
  tenant_domain: string
  billing_account_id: string | null
  providers: PublicAuthProviderOption[]
}

export async function fetchPublicAuthProviders(
  domain?: string
): Promise<PublicAuthProvidersPayload> {
  const q = domain?.trim() ? `?domain=${encodeURIComponent(domain.trim())}` : ''
  return apiFetch<PublicAuthProvidersPayload>(`/api/auth/providers/public/${q}`, {
    auth: false,
    skipRefresh: true,
  })
}

/** Añade `?search=` o `&search=` para listados DRF con `SearchFilter`. */
export function withSearchQuery(path: string, search: string): string {
  const t = search.trim()
  if (!t) return path
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}search=${encodeURIComponent(t)}`
}

export function parseListPayload<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data
  if (
    data &&
    typeof data === 'object' &&
    'results' in data &&
    Array.isArray((data as { results: unknown }).results)
  ) {
    return (data as { results: T[] }).results
  }
  return []
}

/** Respuesta estándar DRF `PageNumberPagination`. */
export type PaginatedResponse<T> = {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

/**
 * GET paginado (`?page=` y `page_size=`). `path` puede incluir ya query (p. ej. `?country=`).
 * `search`: parámetro DRF `search` (icontains en `SearchFilter`).
 */
export async function apiFetchPaginated<T>(
  path: string,
  page: number,
  pageSize: number,
  options: ApiFetchOptions & { search?: string } = {}
): Promise<PaginatedResponse<T>> {
  const { search, ...fetchOpts } = options
  const sep = path.includes('?') ? '&' : '?'
  let url = `${path}${sep}page=${page}&page_size=${pageSize}`
  const term = typeof search === 'string' ? search.trim() : ''
  if (term) {
    url += `&search=${encodeURIComponent(term)}`
  }
  return apiFetch<PaginatedResponse<T>>(url, fetchOpts)
}

/**
 * Concatena todas las páginas (útil para selects / catálogos completos).
 * Respeta `max_page_size` del backend.
 */
export async function fetchAllPages<T>(
  path: string,
  options: ApiFetchOptions & { pageSize?: number } = {}
): Promise<T[]> {
  const { pageSize = 250, ...fetchOpts } = options
  const out: T[] = []
  let page = 1
  for (;;) {
    const data = await apiFetchPaginated<T>(path, page, pageSize, fetchOpts)
    out.push(...data.results)
    if (!data.next || data.results.length === 0) break
    page += 1
    if (page > 2000) break
  }
  return out
}
