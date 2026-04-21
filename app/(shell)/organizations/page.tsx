'use client'

import { useCallback, useEffect, useState } from 'react'
import { EntityTable } from '@/components/entity-table'
import { StaffCreateDialog } from '@/components/staff-create-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useMe } from '@/components/me-provider'
import { apiFetch, parseListPayload, getApiErrorMessage, withSearchQuery } from '@/lib/api/client'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { canWriteStaffScopedApi } from '@/lib/auth/abilities'
import { inputClassName } from '@/lib/ui/form-styles'
import type { Company, Organization } from '@/lib/types/api'

export default function OrganizacionesPage() {
  const { me, loading: meLoading } = useMe()
  const [rows, setRows] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const canCreate = !meLoading && canWriteStaffScopedApi(me)

  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput)

  const reload = useCallback(async () => {
    const data = await apiFetch<unknown>(withSearchQuery('/api/organizations/', search))
    setRows(parseListPayload<Organization>(data))
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
          setError(getApiErrorMessage(e, 'Error al cargar organizaciones.'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reload])

  useEffect(() => {
    if (!canCreate) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await apiFetch<unknown>('/api/companies/')
        if (!cancelled) setCompanies(parseListPayload<Company>(data))
      } catch {
        if (!cancelled) setCompanies([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canCreate])

  async function onCreate(
    e: React.FormEvent<HTMLFormElement>,
    close: () => void
  ) {
    e.preventDefault()
    const form = e.currentTarget
    setCreateError(null)
    const fd = new FormData(form)
    const name = String(fd.get('name') ?? '').trim()
    const companyRaw = fd.get('company')
    const company = Number(companyRaw)
    if (
      !name ||
      companyRaw === '' ||
      !Number.isFinite(company) ||
      company <= 0
    ) {
      setCreateError('Completa empresa y nombre.')
      return
    }
    setCreating(true)
    try {
      await apiFetch('/api/organizations/', {
        method: 'POST',
        body: JSON.stringify({ name, company }),
      })
    } catch (err) {
      setCreateError(getApiErrorMessage(err, 'Error al crear la organización.'))
      return
    } finally {
      setCreating(false)
    }

    form.reset()
    close()
    try {
      await reload()
      setCreateError(null)
    } catch (err) {
      setCreateError(
        getApiErrorMessage(
          err,
          'Organización creada, pero no se pudo recargar la tabla. Recarga la página.'
        )
      )
    }
  }

  return (
    <>
      <EntityTable
        belowTitleContent={
          <div className="max-w-md">
            <Label htmlFor="org-search">Buscar</Label>
            <input
              id="org-search"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Nombre o empresa…"
              autoComplete="off"
              className={inputClassName}
            />
          </div>
        }
        loading={loading}
        error={error}
        headerActions={
          canCreate ? (
            <StaffCreateDialog
              title="Nueva organización"
              description="Asociá la organización a una empresa."
              triggerLabel="Nueva organización"
              triggerWrapperClassName="shrink-0"
            >
              {({ close }) => (
                <form
                  onSubmit={(e) => onCreate(e, close)}
                  className="grid max-w-md gap-4"
                >
                  <div className="grid gap-2">
                    <Label htmlFor="org-empresa">Empresa</Label>
                    <select
                      id="org-empresa"
                      name="company"
                      required
                      className={inputClassName}
                    >
                      <option value="">— Elegir —</option>
                      {companies.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="org-name">Nombre</Label>
                    <input id="org-name" name="name" required className={inputClassName} />
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
          { key: 'company', label: 'Empresa' },
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
