export function getApiBaseUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ??
    'http://127.0.0.1:8000'
  return base
}

export function getGoogleClientId(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? ''
}

/** Debe coincidir con `OTP_EMAIL_TTL_SECONDS` del backend si el API no envía `expires_in_seconds`. */
export function getOtpEmailTtlSeconds(): number {
  const raw = process.env.NEXT_PUBLIC_OTP_EMAIL_TTL_SECONDS
  const n = raw != null && raw !== '' ? Number.parseInt(raw, 10) : Number.NaN
  if (Number.isFinite(n) && n >= 60) return n
  return 300
}
