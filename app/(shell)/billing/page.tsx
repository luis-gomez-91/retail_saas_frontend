'use client'

import { useCallback, useEffect, useState } from 'react'
import { EntityTable } from '@/components/entity-table'
import { StaffCreateDialog } from '@/components/staff-create-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useMe } from '@/components/me-provider'
import { apiFetch, parseListPayload, withSearchQuery, ApiError } from '@/lib/api/client'
import { canWriteStaffScopedApi } from '@/lib/auth/abilities'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { inputClassName } from '@/lib/ui/form-styles'
import type { BillingAccount } from '@/lib/types/api'

export default function FacturacionPage() {
  const { me, loading: meLoading } = useMe()
  const canWrite = !meLoading && canWriteStaffScopedApi(me)

  const [rows, setRows] = useState<BillingAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput)

  const reload = useCallback(async () => {
    const data = await apiFetch<unknown>(withSearchQuery('/api/billing-accounts/', search))
    setRows(parseListPayload<BillingAccount>(data))
  }, [search])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        await reload()
        if (!cancelled) setError(null)
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
  }, [reload])

  async function onCreate(
    e: React.FormEvent<HTMLFormElement>,
    close: () => void
  ) {
    e.preventDefault()
    setCreateError(null)
    const fd = new FormData(e.currentTarget)
    const name = String(fd.get('name') ?? '').trim()
    if (!name) return
    setCreating(true)
    try {
      await apiFetch('/api/billing-accounts/', {
        method: 'POST',
        body: JSON.stringify({ name }),
      })
      await reload()
      e.currentTarget.reset()
      close()
    } catch (err) {
      setCreateError(
        err instanceof ApiError ? err.message : 'Error al crear la cuenta.'
      )
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <EntityTable
        belowTitleContent={
          <div className="max-w-md">
            <Label htmlFor="ba-search">Buscar</Label>
            <input
              id="ba-search"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Nombre de la cuenta…"
              autoComplete="off"
              className={inputClassName}
            />
          </div>
        }
        loading={loading}
        error={error}
        headerActions={
          canWrite ? (
            <StaffCreateDialog
              title="Nueva cuenta de facturación"
              description="Nombre visible para agrupar empresas y suscripciones."
              triggerLabel="Nueva cuenta"
              triggerWrapperClassName="shrink-0"
            >
              {({ close }) => (
                <form
                  onSubmit={(e) => onCreate(e, close)}
                  className="grid max-w-md gap-4"
                >
                  <div className="grid gap-2">
                    <Label htmlFor="ba-name">Nombre</Label>
                    <input
                      id="ba-name"
                      name="name"
                      required
                      autoComplete="off"
                      className={inputClassName}
                    />
                  </div>
                  {createError ? (
                    <p className="text-sm text-destructive" role="alert">
                      {createError}
                    </p>
                  ) : null}
                  <Button type="submit" disabled={creating}>
                    {creating ? 'Creando…' : 'Crear'}
                  </Button>
                </form>
              )}
            </StaffCreateDialog>
          ) : undefined
        }
        columns={[
          { key: 'name', label: 'Nombre' },
          { key: 'created_at', label: 'Creada' },
        ]}
        rows={
          rows as unknown as Record<
            string,
            string | number | boolean | null | undefined
          >[]
        }
      />
    </>
  )
}
