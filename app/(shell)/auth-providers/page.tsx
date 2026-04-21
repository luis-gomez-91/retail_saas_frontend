'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { EntityTable } from '@/components/entity-table'
import { Label } from '@/components/ui/label'
import { useMe } from '@/components/me-provider'
import {
  apiFetch,
  parseListPayload,
  ApiError,
  withSearchQuery,
} from '@/lib/api/client'
import { canWriteStaffScopedApi } from '@/lib/auth/abilities'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { inputClassName } from '@/lib/ui/form-styles'
import type { AuthProvider, Person } from '@/lib/types/api'
import { cn } from '@/lib/utils'

export default function AuthProvidersAdminPage() {
  const { me } = useMe()
  const canEdit = canWriteStaffScopedApi(me)

  const [persons, setPersons] = useState<Person[]>([])
  const [providers, setProviders] = useState<AuthProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput)
  const [busyPersonId, setBusyPersonId] = useState<number | null>(null)

  const activeProviders = useMemo(
    () =>
      [...providers]
        .filter((p) => p.is_active)
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [providers]
  )

  const reloadPersons = useCallback(async () => {
    const data = await apiFetch<unknown>(withSearchQuery('/api/persons/', search))
    setPersons(parseListPayload<Person>(data))
  }, [search])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await apiFetch<unknown>('/api/auth-providers/')
        if (!cancelled) {
          setProviders(parseListPayload<AuthProvider>(data))
        }
      } catch {
        if (!cancelled) setProviders([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        await reloadPersons()
        if (!cancelled) setError(null)
      } catch (e) {
        if (!cancelled) {
          setPersons([])
          setError(e instanceof ApiError ? e.message : 'Error al cargar personas.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reloadPersons])

  const patchProviders = useCallback(
    async (personId: number, providerIds: string[]) => {
      if (!canEdit) return
      setBusyPersonId(personId)
      try {
        const res = await apiFetch<{ provider_ids: string[] }>(
          `/api/persons/${personId}/auth-providers/`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider_ids: providerIds }),
          }
        )
        setPersons((prev) =>
          prev.map((p) =>
            p.id === personId
              ? { ...p, auth_provider_ids: res.provider_ids }
              : p
          )
        )
      } catch (e) {
        setError(
          e instanceof ApiError ? e.message : 'No se pudo actualizar los proveedores.'
        )
        await reloadPersons()
      } finally {
        setBusyPersonId(null)
      }
    },
    [canEdit, reloadPersons]
  )

  const onToggle = useCallback(
    (person: Person, providerId: string, checked: boolean) => {
      const cur = person.auth_provider_ids ?? []
      const next = checked
        ? [...new Set([...cur, providerId])]
        : cur.filter((id) => id !== providerId)
      void patchProviders(person.id, next)
    },
    [patchProviders]
  )

  const columns = useMemo(() => {
    const base = [
      { key: 'user', label: 'Usuario' },
      { key: 'nombre', label: 'Nombre' },
      { key: 'empresas', label: 'Empresas' },
    ]
    const provCols = activeProviders.map((p) => ({
      key: `pv_${p.id}`,
      label: p.name,
    }))
    return [...base, ...provCols]
  }, [activeProviders])

  const rows = useMemo(() => {
    return persons.map((p) => {
      const ids = new Set(p.auth_provider_ids ?? [])
      const row: Record<string, string | number | boolean | null | undefined> = {
        __personId: p.id,
        user: String(p.user_username ?? p.user ?? ''),
        nombre:
          [p.name, p.last_name, p.second_last_name].filter(Boolean).join(' ') ||
          '—',
        empresas: p.companies_label || p.companies_etiqueta || '—',
      }
      for (const pr of activeProviders) {
        row[`pv_${pr.id}`] = ids.has(pr.id)
      }
      return row
    })
  }, [persons, activeProviders])

  return (
    <>
      <EntityTable
        belowTitleContent={
          <div className="max-w-md">
            <Label htmlFor="auth-prov-search">Buscar</Label>
            <input
              id="auth-prov-search"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Usuario, nombre, correo…"
              autoComplete="off"
              className={inputClassName}
            />
          </div>
        }
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        renderCell={(row, key, rowIndex) => {
          if (!key.startsWith('pv_')) return undefined
          const person = persons[rowIndex]
          if (!person) return undefined
          const providerId = key.replace(/^pv_/, '')
          const checked = Boolean(row[key])
          const disabled = !canEdit || busyPersonId === person.id
          return (
            <input
              type="checkbox"
              className={cn(
                'size-4 rounded border-input accent-primary',
                disabled && 'cursor-not-allowed opacity-60'
              )}
              checked={checked}
              disabled={disabled}
              onChange={(e) => onToggle(person, providerId, e.target.checked)}
              aria-label={`${person.user_username ?? person.user} — ${activeProviders.find((p) => p.id === providerId)?.name ?? providerId}`}
            />
          )
        }}
      />
    </>
  )
}
