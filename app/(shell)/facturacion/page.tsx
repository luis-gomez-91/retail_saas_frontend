'use client'

import { useEffect, useState } from 'react'
import { EntityTable } from '@/components/entity-table'
import { apiFetch, parseListPayload, ApiError } from '@/lib/api/client'
import type { BillingAccount } from '@/lib/types/api'

export default function FacturacionPage() {
  const [rows, setRows] = useState<BillingAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await apiFetch<unknown>('/api/billing-accounts/')
        if (!cancelled) {
          setRows(parseListPayload<BillingAccount>(data))
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setRows([])
          setError(
            e instanceof ApiError ? e.message : 'Error al cargar cuentas de facturación.'
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
      title="Cuentas de facturación"
      description="GET /api/billing-accounts/"
      loading={loading}
      error={error}
      columns={[
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Nombre' },
        { key: 'created_at', label: 'Creada' },
      ]}
      rows={rows as unknown as Record<string, string | number | boolean | null | undefined>[]}
    />
  )
}
