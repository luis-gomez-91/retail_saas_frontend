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
    const message =
      typeof json === 'object' &&
      json !== null &&
      'detail' in json &&
      typeof (json as { detail: unknown }).detail === 'string'
        ? (json as { detail: string }).detail
        : res.statusText || 'Error de API'
    throw new ApiError(message, res.status, json)
  }

  return json as T
}

export async function loginRequest(
  username: string,
  password: string
): Promise<TokenPair> {
  return apiFetch<TokenPair>('/api/auth/token/', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
    auth: false,
    skipRefresh: true,
  })
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
