'use client'

import { useEffect, useState } from 'react'
import { EntityTable } from '@/components/entity-table'
import { apiFetch, parseListPayload } from '@/lib/api/client'
import { ApiError } from '@/lib/api/client'
import type { Empresa } from '@/lib/types/api'

export default function EmpresasPage() {
  const [rows, setRows] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await apiFetch<unknown>('/api/empresas/')
        if (!cancelled) {
          setRows(parseListPayload<Empresa>(data))
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setRows([])
          setError(e instanceof ApiError ? e.message : 'Error al cargar empresas.')
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
      title="Empresas"
      description="GET /api/empresas/ — filtradas por membresías si no eres staff."
      loading={loading}
      error={error}
      columns={[
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Nombre' },
        { key: 'slug', label: 'Slug' },
        { key: 'billing_account', label: 'Cuenta facturación' },
        { key: 'created_at', label: 'Creada' },
      ]}
      rows={rows as unknown as Record<string, string | number | boolean | null | undefined>[]}
    />
  )
}
