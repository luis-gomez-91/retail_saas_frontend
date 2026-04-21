'use client'

import { useEffect, useState } from 'react'

/** Valor estable tras `delayMs` sin cambios (p. ej. búsqueda server-side). */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debounced
}
