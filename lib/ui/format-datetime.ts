const ISO_DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
/** Inicio de fecha-hora ISO (p. ej. Django REST). */
const ISO_DATETIME_START = /^\d{4}-\d{2}-\d{2}T/
/** Fecha y hora con espacio (algunos backends). */
const SPACE_DATETIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

/**
 * Muestra instantes en zona local: `dd-mm-yyyy hh:mm`.
 * Acepta ISO completo, o solo `yyyy-mm-dd` (interpretado como medianoche local).
 */
export function formatDisplayDateTime(
  value: string | number | null | undefined
): string {
  if (value === null || value === undefined) return '—'
  const raw = String(value).trim()
  if (!raw) return '—'

  const dateOnly = raw.match(ISO_DATE_ONLY)
  let d: Date
  if (dateOnly) {
    const y = Number(dateOnly[1])
    const m = Number(dateOnly[2])
    const day = Number(dateOnly[3])
    d = new Date(y, m - 1, day)
  } else {
    d = new Date(raw)
  }

  if (Number.isNaN(d.getTime())) return raw

  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export function looksLikeApiDateTimeString(value: string): boolean {
  return (
    ISO_DATE_ONLY.test(value) ||
    ISO_DATETIME_START.test(value) ||
    SPACE_DATETIME.test(value)
  )
}
