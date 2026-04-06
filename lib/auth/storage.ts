const ACCESS = 'retail_saas_access'
const REFRESH = 'retail_saas_refresh'

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACCESS)
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(REFRESH)
}

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem(ACCESS, access)
  localStorage.setItem(REFRESH, refresh)
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS)
  localStorage.removeItem(REFRESH)
}
