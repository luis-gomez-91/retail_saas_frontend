'use client'

import { useEffect, useState } from 'react'
import { EntityTable } from '@/components/entity-table'
import { apiFetch, parseListPayload, ApiError } from '@/lib/api/client'
import type { Subscription } from '@/lib/types/api'

export default function SuscripcionesPage() {
  const [rows, setRows] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await apiFetch<unknown>('/api/subscriptions/')
        if (!cancelled) {
          setRows(parseListPayload<Subscription>(data))
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setRows([])
          setError(
            e instanceof ApiError ? e.message : 'Error al cargar suscripciones.'
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
      title="Suscripciones"
      description="GET /api/subscriptions/"
      loading={loading}
      error={error}
      columns={[
        { key: 'id', label: 'ID' },
        { key: 'billing_account', label: 'Cuenta' },
        { key: 'plan', label: 'Plan' },
        { key: 'status', label: 'Estado' },
        { key: 'current_period_end', label: 'Fin período' },
        { key: 'external_subscription_id', label: 'ID externo' },
      ]}
      rows={rows as unknown as Record<string, string | number | boolean | null | undefined>[]}
    />
  )
}
