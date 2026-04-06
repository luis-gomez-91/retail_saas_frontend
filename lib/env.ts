export function getApiBaseUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ??
    'http://127.0.0.1:8000'
  return base
}
