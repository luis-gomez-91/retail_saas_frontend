'use client'

import { useCallback, useEffect, useState } from 'react'
import { Edit, MoreHorizontal, Trash2 } from 'lucide-react'
import { EntityTable } from '@/components/entity-table'
import { useMe } from '@/components/me-provider'
import { StaffCreateDialog } from '@/components/staff-create-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { canWriteStaffScopedApi } from '@/lib/auth/abilities'
import { apiFetch, parseListPayload, ApiError } from '@/lib/api/client'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { inputClassName } from '@/lib/ui/form-styles'
import { labelsForModuleIds } from '@/components/role-module-checkboxes'
import type { Company, CompanyRole, Module, Role } from '@/lib/types/api'

type RolPlantilla = { id: string; code: string; name: string; icon: string }

function rolesCompanyListPath(search: string, companyFilter: string): string {
  const params = new URLSearchParams()
  const t = search.trim()
  if (t) params.set('search', t)
  const c = companyFilter.trim()
  if (c) params.set('company', c)
  const q = params.toString()
  return q ? `/api/roles_company/?${q}` : '/api/roles_company/'
}

export default function RolesCompanyPage() {
  const { me, loading: meLoading } = useMe()
  const canWrite = !meLoading && canWriteStaffScopedApi(me)

  const [rows, setRows] = useState<CompanyRole[]>([])
  const [empresas, setEmpresas] = useState<Company[]>([])
  /** Alta: una empresa o replicar en todas las empresas (cuenta inferida en el servidor). */
  const [createScope, setCreateScope] = useState<'company' | 'billing'>(
    'company'
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<CompanyRole | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CompanyRole | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  /** Plantillas del catálogo de roles. */
  const [plantillas, setPlantillas] = useState<RolPlantilla[]>([])
  const [catalogModules, setCatalogModules] = useState<Module[]>([])

  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput)
  /** '' = todas; `global` = solo sin empresa; UUID = esa empresa. */
  const [companyFilter, setCompanyFilter] = useState('')

  /** Tras mutaciones pasá `searchTerm` desde `searchInput` (evita debounce desfasado). */
  const reload = useCallback(async (searchTerm: string, company: string) => {
    const data = await apiFetch<unknown>(
      rolesCompanyListPath(searchTerm, company),
      { cache: 'no-store' }
    )
    setRows(parseListPayload<CompanyRole>(data))
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        await reload(search, companyFilter)
        if (!cancelled) setError(null)
      } catch (e) {
        if (!cancelled) {
          setRows([])
          setError(e instanceof ApiError ? e.message : 'Error al cargar roles por empresa.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reload, search, companyFilter])

  useEffect(() => {
    if (meLoading) return
    let cancelled = false
    ;(async () => {
      try {
        const co = await apiFetch<unknown>('/api/companies/')
        if (!cancelled) setEmpresas(parseListPayload<Company>(co))
      } catch {
        if (!cancelled) setEmpresas([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [meLoading])

  useEffect(() => {
    if (!canWrite) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await apiFetch<unknown>('/api/roles/')
        const all = parseListPayload<Role>(data)
        if (!cancelled) {
          setPlantillas(
            all
              .map((r) => ({ id: r.id, code: r.code, name: r.name, icon: r.icon || '' }))
              .sort((a, b) => a.code.localeCompare(b.code, 'es'))
          )
        }
      } catch {
        if (!cancelled) setPlantillas([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canWrite])

  useEffect(() => {
    if (!canWrite) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await apiFetch<unknown>('/api/modules/')
        if (!cancelled) setCatalogModules(parseListPayload<Module>(data))
      } catch {
        if (!cancelled) setCatalogModules([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canWrite])

  async function onCreate(e: React.FormEvent<HTMLFormElement>, close: () => void) {
    e.preventDefault()
    const form = e.currentTarget
    setCreateError(null)
    const fd = new FormData(form)
    const roleRaw = String(fd.get('role_id') ?? '').trim()
    if (!roleRaw) {
      setCreateError('Elegí un rol de plantilla.')
      return
    }
    let body: Record<string, unknown>
    if (createScope === 'company') {
      const companyRaw = String(fd.get('company_id') ?? '').trim()
      if (!companyRaw) {
        setCreateError('Elegí una empresa.')
        return
      }
      body = { company: companyRaw, role: roleRaw }
    } else {
      body = { company: null, role: roleRaw }
    }
    setCreating(true)
    try {
      await apiFetch('/api/roles_company/', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    } catch (err) {
      setCreateError(
        err instanceof ApiError ? err.message : 'Error al crear la asignación.'
      )
      return
    } finally {
      setCreating(false)
    }
    try {
      await reload(searchInput.trim(), companyFilter)
      setCreateError(null)
    } catch (err) {
      setCreateError(
        err instanceof ApiError
          ? `Creado, pero no se pudo recargar: ${err.message}`
          : 'Creado, pero no se pudo recargar la tabla.'
      )
      return
    }
    try {
      form.reset()
    } catch {
      /* ignore */
    }
    close()
  }

  async function onEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editing) return
    setEditError(null)
    const fd = new FormData(e.currentTarget)
    const companyRaw = String(fd.get('company_id') ?? '').trim()
    const roleRaw = String(fd.get('role_id') ?? '').trim()
    if (!roleRaw) {
      setEditError('Elegí un rol de plantilla.')
      return
    }
    setUpdating(true)
    try {
      const body: { company: string | null; role: string } = {
        company: companyRaw === '' ? null : companyRaw,
        role: roleRaw,
      }
      await apiFetch(`/api/roles_company/${editing.id}/`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      await reload(searchInput.trim(), companyFilter)
      setEditing(null)
      setEditError(null)
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : 'Error al guardar.')
    } finally {
      setUpdating(false)
    }
  }

  async function onDeleteConfirm() {
    if (!deleteTarget) return
    setDeletingId(deleteTarget.id)
    try {
      await apiFetch(`/api/roles_company/${deleteTarget.id}/`, { method: 'DELETE' })
      await reload(searchInput.trim(), companyFilter)
      setError(null)
      setDeleteTarget(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al eliminar.')
    } finally {
      setDeletingId(null)
    }
  }

  const tableRows = rows.map((r) => ({
    company:
      r.company_label ||
      r.company_etiqueta ||
      (r.company == null ? 'Global' : `#${r.company}`),
    code: r.code,
    name: r.name,
    icon: r.icon || '—',
    modules: labelsForModuleIds(r.modules, catalogModules),
  }))

  return (
    <>
      <EntityTable
        belowTitleContent={
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="grid max-w-md gap-2">
              <Label htmlFor="cr-search">Buscar</Label>
              <input
                id="cr-search"
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Empresa, código o nombre…"
                autoComplete="off"
                className={inputClassName}
              />
            </div>
            <div className="grid max-w-md gap-2 sm:min-w-[14rem]">
              <Label htmlFor="cr-company">Empresa</Label>
              <select
                id="cr-company"
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className={inputClassName}
                aria-label="Filtrar por empresa"
              >
                <option value="">Todas</option>
                <option value="global">Solo global (sin empresa)</option>
                {empresas.map((em) => (
                  <option key={em.id} value={em.id}>
                    {em.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        }
        loading={loading}
        error={error}
        headerActions={
          canWrite ? (
            <StaffCreateDialog
              title="Nueva asignación rol — empresa"
              description="Una empresa concreta, o todas las empresas de tu cuenta (el servidor usa la cuenta donde sos titular o miembro; un vínculo por empresa, sin duplicar)."
              triggerLabel="Nueva asignación"
              triggerWrapperClassName="shrink-0"
              contentClassName="sm:max-w-lg"
            >
              {({ close }) => (
                <form
                  onSubmit={(e) => onCreate(e, close)}
                  className="grid max-w-lg gap-4"
                >
                  <div className="grid gap-2">
                    <Label htmlFor="re-alcance">Alcance</Label>
                    <select
                      id="re-alcance"
                      value={createScope}
                      onChange={(e) =>
                        setCreateScope(
                          e.target.value === 'billing' ? 'billing' : 'company'
                        )
                      }
                      className={inputClassName}
                    >
                      <option value="company">Una empresa</option>
                      <option value="billing">
                        Todas las empresas de tu cuenta (automático)
                      </option>
                    </select>
                  </div>
                  {createScope === 'company' ? (
                    <div className="grid gap-2">
                      <Label htmlFor="re-empresa">Empresa</Label>
                      <select
                        id="re-empresa"
                        name="company_id"
                        required
                        className={inputClassName}
                        defaultValue=""
                      >
                        <option value="" disabled>
                          — Elegir —
                        </option>
                        {empresas.map((em) => (
                          <option key={em.id} value={em.id}>
                            {em.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      La cuenta de facturación se elige en el servidor según tu
                      usuario: titular de la cuenta o membresía. Se crea la misma
                      asignación en cada empresa de esa cuenta (las que ya
                      existían se omiten).
                    </p>
                  )}
                  <div className="grid gap-2">
                    <Label htmlFor="re-rol">Rol de plantilla</Label>
                    <select
                      id="re-rol"
                      name="role_id"
                      required
                      className={inputClassName}
                      disabled={plantillas.length === 0}
                    >
                      <option value="">— Elegir —</option>
                      {plantillas.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.code})
                          {p.icon ? ` · ${p.icon}` : ''}
                        </option>
                      ))}
                    </select>
                    {plantillas.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No hay plantillas en el catálogo. Creá un rol en el módulo Roles o ejecutá el seed.
                      </p>
                    ) : null}
                  </div>
                  {createError ? (
                    <p className="text-sm text-destructive" role="alert">
                      {createError}
                    </p>
                  ) : null}
                  <Button type="submit" disabled={creating || plantillas.length === 0}>
                    {creating ? 'Creando…' : 'Crear'}
                  </Button>
                </form>
              )}
            </StaffCreateDialog>
          ) : undefined
        }
        columns={[
          { key: 'company', label: 'Empresa' },
          { key: 'code', label: 'Código rol' },
          { key: 'name', label: 'Nombre rol' },
          { key: 'icon', label: 'Icon key' },
          { key: 'modules', label: 'Módulos' },
          ...(canWrite ? [{ key: 'actions', label: 'Acciones' }] : []),
        ]}
        rows={
          tableRows as unknown as Record<
            string,
            string | number | boolean | null | undefined
          >[]
        }
        renderCell={(row, key, rowIndex) => {
          if (key !== 'actions') return undefined
          const source = rows[rowIndex]
          if (!source || !canWrite) return '—'
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex">
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Acciones">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => setEditing(source)}>
                    <Edit />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={deletingId === source.id}
                    onClick={() => setDeleteTarget(source)}
                  >
                    <Trash2 />
                    {deletingId === source.id ? 'Eliminando…' : 'Eliminar'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        }}
      />

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar asignación</DialogTitle>
            <DialogDescription>
              Se quita la vinculación{' '}
              <strong>
                {deleteTarget?.name} ({deleteTarget?.code})
              </strong>{' '}
              {deleteTarget?.company == null
                ? 'global'
                : `en ${deleteTarget?.company_label || deleteTarget?.company_etiqueta || 'empresa'}`}
              . Las personas con ese rol pueden perder acceso según el caso.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deletingId === deleteTarget?.id}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onDeleteConfirm}
              disabled={deletingId === deleteTarget?.id}
            >
              {deletingId === deleteTarget?.id ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent
          showCloseButton
          className="max-h-[min(90vh,640px)] overflow-y-auto sm:max-w-lg"
        >
          <DialogHeader>
            <DialogTitle>Editar asignación</DialogTitle>
            <DialogDescription>
              Cambiá empresa o plantilla. Los módulos del menú se configuran en el módulo Roles.
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <form
              key={editing.id}
              onSubmit={onEdit}
              className="grid max-w-lg gap-4"
            >
              <div className="grid gap-2">
                <Label htmlFor="ed-re-empresa">Empresa (vacío = global)</Label>
                <select
                  id="ed-re-empresa"
                  name="company_id"
                  className={inputClassName}
                  defaultValue={editing.company ?? ''}
                >
                  <option value="">Global</option>
                  {empresas.map((em) => (
                    <option key={em.id} value={em.id}>
                      {em.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ed-re-rol">Rol de plantilla</Label>
                <select
                  id="ed-re-rol"
                  name="role_id"
                  required
                  className={inputClassName}
                  defaultValue={editing.role}
                >
                  {plantillas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                      {p.icon ? ` · ${p.icon}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {editError ? (
                <p className="text-sm text-destructive" role="alert">
                  {editError}
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={updating}>
                  {updating ? 'Guardando…' : 'Guardar'}
                </Button>
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
