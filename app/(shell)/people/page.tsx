'use client'

import { useCallback, useEffect, useState } from 'react'
import { EntityTable } from '@/components/entity-table'
import { Label } from '@/components/ui/label'
import { apiFetch, parseListPayload, ApiError, withSearchQuery } from '@/lib/api/client'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { inputClassName } from '@/lib/ui/form-styles'
import type { Person } from '@/lib/types/api'

export default function PersonasPage() {
  const [rows, setRows] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput)

  const reload = useCallback(async () => {
    const data = await apiFetch<unknown>(withSearchQuery('/api/persons/', search))
    setRows(parseListPayload<Person>(data))
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
          setError(e instanceof ApiError ? e.message : 'Error al cargar personas.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reload])

  const tableRows = rows.map((p) => ({
    user: p.user_username ?? p.user,
    nombre: [p.name, p.last_name, p.second_last_name].filter(Boolean).join(' ') || '—',
    email: p.personal_email || '—',
    tel: p.phone || '—',
    empresas: p.companies_label || p.companies_etiqueta || '—',
    roles: p.roles_label || p.roles_etiqueta || '—',
  }))

  return (
    <>
      <EntityTable
        belowTitleContent={
          <div className="max-w-md">
            <Label htmlFor="people-search">Buscar</Label>
            <input
              id="people-search"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Usuario, nombre, correo, empresas…"
              autoComplete="off"
              className={inputClassName}
            />
          </div>
        }
        columns={[
        { key: 'user', label: 'Usuario' },
        { key: 'nombre', label: 'Nombre' },
        { key: 'email', label: 'Email' },
        { key: 'tel', label: 'Tel.' },
        { key: 'empresas', label: 'Empresas' },
        { key: 'roles', label: 'Roles' },
      ]}
      rows={tableRows}
      loading={loading}
      error={error}
    />
    </>
  )
}
