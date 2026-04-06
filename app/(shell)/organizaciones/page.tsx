'use client'

import { useEffect, useState } from 'react'
import { EntityTable } from '@/components/entity-table'
import { apiFetch, parseListPayload, ApiError } from '@/lib/api/client'
import type { Organizacion } from '@/lib/types/api'

export default function OrganizacionesPage() {
  const [rows, setRows] = useState<Organizacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await apiFetch<unknown>('/api/organizaciones/')
        if (!cancelled) {
          setRows(parseListPayload<Organizacion>(data))
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setRows([])
          setError(
            e instanceof ApiError ? e.message : 'Error al cargar organizaciones.'
          )
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
      title="Organizaciones"
      description="GET /api/organizaciones/"
      loading={loading}
      error={error}
      columns={[
        { key: 'id', label: 'ID' },
        { key: 'empresa', label: 'Empresa' },
        { key: 'name', label: 'Nombre' },
        { key: 'created_at', label: 'Creada' },
      ]}
      rows={rows as unknown as Record<string, string | number | boolean | null | undefined>[]}
    />
  )
}
