'use client'

import { useEffect, useState } from 'react'
import { EntityTable } from '@/components/entity-table'
import { apiFetch, parseListPayload, ApiError } from '@/lib/api/client'
import type { Plan } from '@/lib/types/api'

export default function PlanesPage() {
  const [rows, setRows] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await apiFetch<unknown>('/api/plans/')
        if (!cancelled) {
          setRows(parseListPayload<Plan>(data))
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setRows([])
          setError(e instanceof ApiError ? e.message : 'Error al cargar planes.')
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
      title="Planes"
      description="GET /api/plans/ — incluye module_ids en lectura."
      loading={loading}
      error={error}
      columns={[
        { key: 'id', label: 'ID' },
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Nombre' },
        { key: 'is_public', label: 'Público' },
        { key: 'max_empresas', label: 'Máx. empresas' },
        { key: 'max_organizaciones', label: 'Máx. orgs' },
        { key: 'max_sucursales', label: 'Máx. sucursales' },
        { key: 'module_ids', label: 'Módulos (ids)' },
      ]}
      rows={
        rows.map((r) => ({
          ...r,
          module_ids: r.module_ids?.join(', ') ?? '',
        })) as unknown as Record<
          string,
          string | number | boolean | null | undefined
        >[]
      }
    />
  )
}
