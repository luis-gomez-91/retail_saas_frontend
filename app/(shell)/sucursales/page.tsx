'use client'

import { useEffect, useState } from 'react'
import { EntityTable } from '@/components/entity-table'
import { apiFetch, parseListPayload, ApiError } from '@/lib/api/client'
import type { Sucursal } from '@/lib/types/api'

export default function SucursalesPage() {
  const [rows, setRows] = useState<Sucursal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await apiFetch<unknown>('/api/sucursales/')
        if (!cancelled) {
          setRows(parseListPayload<Sucursal>(data))
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setRows([])
          setError(e instanceof ApiError ? e.message : 'Error al cargar sucursales.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <EntityTable
      title="Sucursales"
      description="GET /api/sucursales/"
      loading={loading}
      error={error}
      columns={[
        { key: 'id', label: 'ID' },
        { key: 'organizacion', label: 'Organización' },
        { key: 'name', label: 'Nombre' },
        { key: 'created_at', label: 'Creada' },
      ]}
      rows={rows as unknown as Record<string, string | number | boolean | null | undefined>[]}
    />
  )
}
