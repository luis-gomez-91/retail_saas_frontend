'use client'

import { useMemo, useState } from 'react'
import { Label } from '@/components/ui/label'
import { inputClassName } from '@/lib/ui/form-styles'
import type { Module } from '@/lib/types/api'

export function labelsForModuleIds(
  ids: string[] | undefined,
  catalog: Module[]
): string {
  if (!ids?.length) return '—'
  const byId = new Map(catalog.map((m) => [m.id, m]))
  return ids.map((id) => byId.get(id)?.name ?? id).join(', ')
}

/** Módulos que un rol de empresa puede incluir (no reservados a admin/plataforma). */
export function modulesAssignableToRoles(catalog: Module[]): Module[] {
  return catalog.filter((m) => !m.use_admin && !m.use_superuser)
}

type Props = {
  modules: Module[]
  value: string[]
  onChange: (ids: string[]) => void
  searchId?: string
  disabled?: boolean
}

export function RoleModuleCheckboxes({
  modules,
  value,
  onChange,
  searchId,
  disabled,
}: Props) {
  const assignableModules = useMemo(
    () => modulesAssignableToRoles(modules),
    [modules]
  )
  const assignableIds = useMemo(
    () => new Set(assignableModules.map((m) => m.id)),
    [assignableModules]
  )

  /** Ya asignados en el rol pero no elegibles aquí (solo lectura). */
  const reservedAssigned = useMemo(() => {
    const byId = new Map(modules.map((m) => [m.id, m]))
    return value
      .filter((id) => !assignableIds.has(id))
      .map((id) => byId.get(id))
      .filter((m): m is Module => Boolean(m))
  }, [value, assignableIds, modules])

  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    const base = assignableModules
    if (!s) return base
    return base.filter(
      (m) =>
        m.name.toLowerCase().includes(s) ||
        m.code.toLowerCase().includes(s) ||
        (m.description && m.description.toLowerCase().includes(s))
    )
  }, [assignableModules, q])

  const selected = useMemo(() => new Set(value), [value])

  function toggle(id: string) {
    if (!assignableIds.has(id)) return
    const locked = value.filter((vid) => !assignableIds.has(vid))
    const flexible = value.filter((vid) => assignableIds.has(vid))
    const next = new Set(flexible)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange([...locked, ...next])
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={searchId}>Módulos permitidos</Label>
      <input
        id={searchId}
        type="search"
        placeholder="Buscar por nombre o código…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className={inputClassName}
        disabled={disabled}
        autoComplete="off"
      />
      {reservedAssigned.length > 0 ? (
        <div className="rounded-md border border-nav-accent bg-nav-accent-soft p-2 text-xs text-muted-foreground">
          <p className="mb-2 font-medium text-foreground">
            Módulos de plataforma ya asignados (no se gestionan aquí)
          </p>
          <ul className="list-inside list-disc space-y-1">
            {reservedAssigned.map((m) => (
              <li key={m.id}>
                <span className="text-foreground">{m.name}</span>{' '}
                <span className="text-muted-foreground">({m.code})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="max-h-52 space-y-2 overflow-y-auto rounded-md border border-border p-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay módulos que coincidan.</p>
        ) : (
          filtered.map((m) => (
            <label
              key={m.id}
              className="flex cursor-pointer items-start gap-2 rounded-sm px-1 py-1 hover:bg-muted/50"
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={selected.has(m.id)}
                onChange={() => toggle(m.id)}
                disabled={disabled}
              />
              <span className="min-w-0">
                <span className="font-medium">{m.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{m.code}</span>
                {m.description ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {m.description}
                  </span>
                ) : null}
              </span>
            </label>
          ))
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        No se listan módulos reservados para administradores de la plataforma. Podés cambiar la
        selección después con Editar.
      </p>
    </div>
  )
}
