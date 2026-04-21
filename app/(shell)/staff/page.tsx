'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Edit, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { EntityTable } from '@/components/entity-table'
import { useMe } from '@/components/me-provider'
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
import {
  apiFetch,
  parseListPayload,
  getApiErrorMessage,
  ApiError,
  withSearchQuery,
} from '@/lib/api/client'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { canProvisionPersonas, canWriteStaffScopedApi } from '@/lib/auth/abilities'
import { inputClassName, labelClassName } from '@/lib/ui/form-styles'
import type {
  Company,
  CompanyRole,
  IdentificationType,
  MeUser,
  Person,
} from '@/lib/types/api'

function nombreCompleto(p: Person): string {
  const s = [p.name, p.last_name, p.second_last_name].filter(Boolean).join(' ')
  return s || '—'
}

function canEditPersonRow(me: MeUser | null, row: Person): boolean {
  if (!me) return false
  if (canProvisionPersonas(me)) return true
  return String(row.user) === String(me.id)
}

/**
 * Quien puede escribir en APIs de gestión (staff plataforma, super, admin tenant)
 * puede borrar ficha ajena; no la propia. IDs vienen como UUID (string) desde la API.
 */
function canDeletePersonRow(me: MeUser | null, row: Person): boolean {
  if (!me || !canWriteStaffScopedApi(me)) return false
  return String(row.user) !== String(me.id)
}

/** Alta en todas las empresas de cuentas donde el operador es titular o co-admin (API). */
const EMPRESA_TODAS = '__all__'

export default function PersonalPage() {
  const { me, loading: meLoading } = useMe()
  const canCreate = !meLoading && canProvisionPersonas(me)

  const [rows, setRows] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [empresas, setEmpresas] = useState<Company[]>([])
  const [roles, setRoles] = useState<CompanyRole[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [idTypes, setIdTypes] = useState<IdentificationType[]>([])
  const [empresaId, setEmpresaId] = useState('')
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([])
  const [roleSearch, setRoleSearch] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const [editing, setEditing] = useState<Person | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Person | null>(null)
  const [deletingId, setDeletingId] = useState<string | number | null>(null)

  const rolesFiltrados = useMemo(() => {
    if (!empresaId.trim()) return []
    if (empresaId === EMPRESA_TODAS) {
      return roles.filter((r) => r.company == null)
    }
    return roles.filter(
      (r) => r.company == null || r.company === empresaId
    )
  }, [roles, empresaId])

  const rolesFiltradosBusqueda = useMemo(() => {
    const q = roleSearch.trim().toLowerCase()
    if (!q) return rolesFiltrados
    return rolesFiltrados.filter((r) => {
      const name = (r.name ?? '').toLowerCase()
      const code = (r.code ?? '').toLowerCase()
      return name.includes(q) || code.includes(q)
    })
  }, [rolesFiltrados, roleSearch])

  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput)

  const reloadPersonas = useCallback(async () => {
    const data = await apiFetch<unknown>(withSearchQuery('/api/persons/', search))
    setRows(parseListPayload<Person>(data))
  }, [search])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        await reloadPersonas()
        if (!cancelled) setError(null)
      } catch (e) {
        if (!cancelled) {
          setRows([])
          setError(e instanceof ApiError ? e.message : 'Error al cargar personal.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reloadPersonas])

  useEffect(() => {
    if (!createOpen && !editing) return
    if (createOpen && !canCreate) return
    let cancelled = false
    setCatalogLoading(true)
    ;(async () => {
      try {
        const [e, r, it] = await Promise.all([
          apiFetch<unknown>('/api/companies/'),
          apiFetch<unknown>('/api/roles_company/'),
          apiFetch<unknown>('/api/identification-types/?page_size=250'),
        ])
        if (cancelled) return
        setEmpresas(parseListPayload<Company>(e))
        setRoles(parseListPayload<CompanyRole>(r))
        setIdTypes(parseListPayload<IdentificationType>(it))
      } catch {
        if (!cancelled) {
          setEmpresas([])
          setRoles([])
          setIdTypes([])
        }
      } finally {
        if (!cancelled) setCatalogLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [createOpen, editing, canCreate])

  useEffect(() => {
    setSelectedRoleIds([])
    setRoleSearch('')
  }, [empresaId])

  useEffect(() => {
    if (!createOpen) {
      setEmpresaId('')
      setSelectedRoleIds([])
      setRoleSearch('')
      setCreateError(null)
    }
  }, [createOpen])

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setCreateError(null)
    const allCompanies = empresaId === EMPRESA_TODAS
    if (!empresaId) {
      setCreateError('Elegí empresa y al menos un rol.')
      return
    }
    if (selectedRoleIds.length === 0) {
      setCreateError(
        allCompanies
          ? 'Elegí al menos un rol global.'
          : 'Elegí al menos un rol para esta empresa.'
      )
      return
    }
    const form = e.currentTarget
    const fd = new FormData(form)
    const idType = String(fd.get('identification_type') ?? '').trim()
    const idNum = String(fd.get('identification_number') ?? '').trim()
    const body: Record<string, unknown> = {
      name: String(fd.get('name') ?? '').trim(),
      last_name: String(fd.get('last_name') ?? '').trim(),
      second_last_name: String(fd.get('second_last_name') ?? '').trim(),
      personal_email: String(fd.get('personal_email') ?? '').trim(),
      work_email: String(fd.get('work_email') ?? '').trim(),
      phone: String(fd.get('phone') ?? '').trim(),
      identification_type: idType || undefined,
      identification_number: idNum,
      roles: selectedRoleIds,
      provision_all_companies: allCompanies,
    }
    if (!allCompanies) {
      body.company = empresaId
    }
    setCreating(true)
    try {
      await apiFetch('/api/persons/provision/', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      form.reset()
      setCreateOpen(false)
      await reloadPersonas()
    } catch (err) {
      setCreateError(getApiErrorMessage(err, 'No se pudo crear la persona.'))
    } finally {
      setCreating(false)
    }
  }

  async function onEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editing) return
    setEditError(null)
    const fd = new FormData(e.currentTarget)
    const idTypeEd = String(fd.get('identification_type') ?? '').trim()
    const idNumEd = String(fd.get('identification_number') ?? '').trim()
    if (idNumEd && !idTypeEd) {
      setEditError('Si hay número de documento, elegí también el tipo.')
      return
    }
    setUpdating(true)
    try {
      await apiFetch(`/api/persons/${editing.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: String(fd.get('name') ?? '').trim(),
          last_name: String(fd.get('last_name') ?? '').trim(),
          second_last_name: String(fd.get('second_last_name') ?? '').trim(),
          personal_email: String(fd.get('personal_email') ?? '').trim(),
          work_email: String(fd.get('work_email') ?? '').trim(),
          phone: String(fd.get('phone') ?? '').trim(),
          identification_type: idTypeEd || null,
          identification_number: idNumEd,
        }),
      })
      setEditing(null)
      await reloadPersonas()
    } catch (err) {
      setEditError(getApiErrorMessage(err, 'Error al guardar los cambios.'))
    } finally {
      setUpdating(false)
    }
  }

  async function onDeleteConfirm() {
    if (!deleteTarget) return
    setDeletingId(deleteTarget.id)
    try {
      await apiFetch(`/api/persons/${deleteTarget.id}/`, { method: 'DELETE' })
      setDeleteTarget(null)
      await reloadPersonas()
      setError(null)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Error al eliminar la persona.'))
    } finally {
      setDeletingId(null)
    }
  }

  const tableRows = rows.map((p) => ({
    usuario: p.user_username ?? '—',
    nombre: nombreCompleto(p),
    correo: p.work_email || p.personal_email || '—',
    empresas: p.companies_label || p.companies_etiqueta || '—',
    roles: p.roles_label || p.roles_etiqueta || '—',
  }))

  const showActions =
    !meLoading &&
    rows.some(
      (p) => canEditPersonRow(me, p) || canDeletePersonRow(me, p)
    )

  return (
    <>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent
          showCloseButton
          className="max-h-[min(92vh,800px)] overflow-y-auto sm:max-w-2xl"
        >
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="text-xl">Nuevo personal</DialogTitle>
            <DialogDescription className="text-pretty leading-relaxed">
              Alta con usuario de acceso y membresía en la empresa. La contraseña inicial es el número
              de documento. Requiere administrador de cuenta; «Todas las empresas» replica la membresía
              en cada empresa de las cuentas donde sos titular o co-admin (solo roles globales).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreate} className="grid gap-6">
            <section className="space-y-3" aria-labelledby="np-section-ambito">
              <h3
                id="np-section-ambito"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Ámbito
              </h3>
              <div className="grid gap-2">
                <label className={labelClassName} htmlFor="np-empresa">
                  Empresa o alcance
                </label>
                <select
                  id="np-empresa"
                  required
                  className={inputClassName}
                  value={empresaId}
                  onChange={(ev) => setEmpresaId(ev.target.value)}
                  disabled={catalogLoading}
                >
                  <option value="">— Elegir —</option>
                  <option value={EMPRESA_TODAS}>
                    Todas las empresas (titular o co-admin de facturación)
                  </option>
                  {empresas.map((em) => (
                    <option key={em.id} value={em.id}>
                      {em.name}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section className="space-y-3" aria-labelledby="np-section-roles">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3
                  id="np-section-roles"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Roles en la empresa
                </h3>
                {selectedRoleIds.length > 0 ? (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {selectedRoleIds.length} seleccionado
                    {selectedRoleIds.length === 1 ? '' : 's'}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Marcá todos los que correspondan; se aplican a cada membresía creada (una por empresa
                en modo «todas»).
              </p>
              <div className="grid gap-2">
                <Label htmlFor="np-role-search">Buscar rol</Label>
                <input
                  id="np-role-search"
                  type="search"
                  value={roleSearch}
                  onChange={(e) => setRoleSearch(e.target.value)}
                  placeholder="Nombre o código…"
                  autoComplete="off"
                  disabled={catalogLoading || !empresaId || rolesFiltrados.length === 0}
                  className={inputClassName}
                />
              </div>
              <div
                className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border bg-muted/20 p-2"
                role="group"
                aria-label="Roles disponibles"
              >
                {!empresaId ? (
                  <p className="px-1 py-2 text-sm text-muted-foreground">
                    Primero elegí una empresa o el alcance «todas».
                  </p>
                ) : rolesFiltrados.length === 0 ? (
                  <p className="px-1 py-2 text-sm text-muted-foreground">
                    {empresaId === EMPRESA_TODAS
                      ? 'No hay roles globales. En modo «todas las empresas» cada rol debe ser global (sin empresa en el catálogo).'
                      : 'No hay roles para esta empresa. Configurá roles en el catálogo.'}
                  </p>
                ) : rolesFiltradosBusqueda.length === 0 ? (
                  <p className="px-1 py-2 text-sm text-muted-foreground">
                    Ningún rol coincide con la búsqueda.
                  </p>
                ) : (
                  rolesFiltradosBusqueda.map((r) => {
                    const checked = selectedRoleIds.includes(String(r.id))
                    return (
                      <label
                        key={r.id}
                        className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/60"
                      >
                        <input
                          type="checkbox"
                          className="mt-1 size-4 shrink-0 rounded border-input"
                          checked={checked}
                          onChange={() => {
                            const id = String(r.id)
                            setSelectedRoleIds((prev) =>
                              prev.includes(id)
                                ? prev.filter((x) => x !== id)
                                : [...prev, id]
                            )
                          }}
                        />
                        <span className="min-w-0">
                          <span className="font-medium text-foreground">{r.name}</span>
                          {r.code ? (
                            <span className="ml-2 text-xs text-muted-foreground">({r.code})</span>
                          ) : null}
                          {r.company == null ? (
                            <span className="ml-2 text-xs text-muted-foreground">· global</span>
                          ) : null}
                        </span>
                      </label>
                    )
                  })
                )}
              </div>
            </section>

            <hr className="border-border" />

            <section className="space-y-3" aria-labelledby="np-section-doc">
              <h3
                id="np-section-doc"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Documento y acceso
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="np-id-type">Tipo de documento</Label>
                  <select
                    id="np-id-type"
                    name="identification_type"
                    required
                    className={inputClassName}
                    disabled={catalogLoading}
                    defaultValue=""
                  >
                    <option value="">— Elegir —</option>
                    {idTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="np-id-num">N° documento</Label>
                  <input
                    id="np-id-num"
                    name="identification_number"
                    required
                    autoComplete="off"
                    className={inputClassName}
                    placeholder="Contraseña inicial de acceso"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3" aria-labelledby="np-section-name">
              <h3
                id="np-section-name"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Nombre
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="grid gap-2 sm:col-span-1">
                  <Label htmlFor="np-nombre">Nombre</Label>
                  <input
                    id="np-nombre"
                    name="name"
                    autoComplete="given-name"
                    className={inputClassName}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="np-ap1">Apellido paterno</Label>
                  <input
                    id="np-ap1"
                    name="last_name"
                    autoComplete="family-name"
                    className={inputClassName}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="np-ap2">Apellido materno</Label>
                  <input
                    id="np-ap2"
                    name="second_last_name"
                    autoComplete="off"
                    className={inputClassName}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3" aria-labelledby="np-section-contact">
              <h3
                id="np-section-contact"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Contacto
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="np-mail">Correo personal</Label>
                  <input
                    id="np-mail"
                    name="personal_email"
                    type="email"
                    autoComplete="email"
                    className={inputClassName}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="np-work-mail">Correo laboral</Label>
                  <input
                    id="np-work-mail"
                    name="work_email"
                    type="email"
                    autoComplete="email"
                    className={inputClassName}
                    placeholder="Opcional"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="np-tel">Teléfono</Label>
                  <input
                    id="np-tel"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    className={inputClassName}
                  />
                </div>
              </div>
            </section>

            {createError ? (
              <p className="text-sm text-destructive" role="alert">
                {createError}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={creating || catalogLoading}>
                {creating ? 'Creando…' : 'Crear personal'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <EntityTable
        belowTitleContent={
          <div className="max-w-md">
            <Label htmlFor="staff-search">Buscar</Label>
            <input
              id="staff-search"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Usuario, nombre, correos, documento, empresas…"
              autoComplete="off"
              className={inputClassName}
            />
          </div>
        }
        loading={loading || meLoading}
        error={error}
        headerActions={
          canCreate ? (
            <div className="shrink-0">
              <Button type="button" onClick={() => setCreateOpen(true)}>
                <Plus data-icon="inline-start" />
                Nuevo personal
              </Button>
            </div>
          ) : undefined
        }
        columns={[
          { key: 'usuario', label: 'Usuario' },
          { key: 'nombre', label: 'Nombre' },
          { key: 'correo', label: 'Correo' },
          { key: 'empresas', label: 'Empresas' },
          { key: 'roles', label: 'Roles' },
          ...(showActions ? [{ key: 'actions', label: 'Acciones' }] : []),
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
          if (!source) return '—'
          const canEdit = canEditPersonRow(me, source)
          const canDelete = canDeletePersonRow(me, source)
          if (!canEdit && !canDelete) return '—'
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex">
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Acciones">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {canEdit ? (
                    <DropdownMenuItem onClick={() => setEditing(source)}>
                      <Edit />
                      Editar
                    </DropdownMenuItem>
                  ) : null}
                  {canDelete ? (
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={deletingId === source.id}
                      onClick={() => setDeleteTarget(source)}
                    >
                      <Trash2 />
                      Eliminar
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        }}
      />

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar personal</DialogTitle>
            <DialogDescription>
              Se borrará la ficha de{' '}
              <strong>{deleteTarget ? nombreCompleto(deleteTarget) : ''}</strong>
              {deleteTarget?.user_username ? (
                <>
                  {' '}
                  (<span className="tabular-nums">{deleteTarget.user_username}</span>)
                </>
              ) : null}
              . Quita membresías y asignaciones de rol; el usuario de acceso puede
              quedar sin persona asociada.
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
          className="max-h-[min(90vh,640px)] overflow-y-auto sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle>Editar ficha</DialogTitle>
            <DialogDescription>
              Datos de contacto, documento y correos; el usuario de acceso no se modifica aquí.
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <form key={String(editing.id)} onSubmit={onEdit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="ed-nombre">Nombre</Label>
                <input
                  id="ed-nombre"
                  name="name"
                  defaultValue={editing.name}
                  className={inputClassName}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ed-ap1">Apellido paterno</Label>
                <input
                  id="ed-ap1"
                  name="last_name"
                  defaultValue={editing.last_name}
                  className={inputClassName}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ed-ap2">Apellido materno</Label>
                <input
                  id="ed-ap2"
                  name="second_last_name"
                  defaultValue={editing.second_last_name}
                  className={inputClassName}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="ed-id-type">Tipo de documento</Label>
                  <select
                    id="ed-id-type"
                    name="identification_type"
                    className={inputClassName}
                    defaultValue={editing.identification_type ?? ''}
                    disabled={catalogLoading}
                  >
                    <option value="">— Sin especificar —</option>
                    {idTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ed-id-num">N° documento</Label>
                  <input
                    id="ed-id-num"
                    name="identification_number"
                    defaultValue={editing.identification_number ?? ''}
                    className={inputClassName}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ed-mail">Correo personal</Label>
                <input
                  id="ed-mail"
                  name="personal_email"
                  type="email"
                  defaultValue={editing.personal_email}
                  className={inputClassName}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ed-work-mail">Correo laboral</Label>
                <input
                  id="ed-work-mail"
                  name="work_email"
                  type="email"
                  defaultValue={editing.work_email ?? ''}
                  className={inputClassName}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ed-tel">Teléfono</Label>
                <input
                  id="ed-tel"
                  name="phone"
                  defaultValue={editing.phone}
                  className={inputClassName}
                />
              </div>
              {editError ? (
                <p className="text-sm text-destructive" role="alert">
                  {editError}
                </p>
              ) : null}
              <Button type="submit" disabled={updating}>
                {updating ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
