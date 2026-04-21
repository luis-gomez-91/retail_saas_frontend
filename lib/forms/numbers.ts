/** Decimal o null si el campo va vacío o no es numérico (precios, importes). */
export function optionalDecimal(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number(t)
  if (!Number.isFinite(n)) return null
  return n
}

/** Entero o null si el campo va vacío o no es numérico. */
export function optionalIntString(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number(t)
  if (!Number.isFinite(n)) return null
  return Math.trunc(n)
}

/** Lista de ids separados por coma, espacio o punto y coma. */
export function parseIdList(raw: string): number[] {
  return raw
    .split(/[,;\s]+/)
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
}
