'use client'

import { useCallback, useEffect, useState } from 'react'
import { Edit, MoreHorizontal, Trash2 } from 'lucide-react'
import { EntityTable } from '@/components/entity-table'
import {
  RoleModuleCheckboxes,
  labelsForModuleIds,
} from '@/components/role-module-checkboxes'
import { StaffCreateDialog } from '@/components/staff-create-dialog'
import { useMe } from '@/components/me-provider'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { canWriteStaffScopedApi } from '@/lib/auth/abilities'
import {
  apiFetch,
  parseListPayload,
  ApiError,
  getApiErrorMessage,
  withSearchQuery,
} from '@/lib/api/client'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { inputClassName } from '@/lib/ui/form-styles'
import type { Module, Role } from '@/lib/types/api'

export default function RolesPage() {
  const { me, loading: meLoading } = useMe()
  const canWrite = !meLoading && canWriteStaffScopedApi(me)

  const [rows, setRows] = useState<Role[]>([])
  const [catalogModules, setCatalogModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [selectedModules, setSelectedModules] = useState<string[]>([])

  const [editing, setEditing] = useState<Role | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null)
  const [editMods, setEditMods] = useState<string[]>([])
  const [editError, setEditError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput)

  const reload = useCallback(async () => {
    const data = await apiFetch<unknown>(withSearchQuery('/api/roles/', search))
    setRows(parseListPayload<Role>(data))
  }, [search])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const modData = await apiFetch<unknown>('/api/modules/')
        if (!cancelled) setCatalogModules(parseListPayload<Module>(modData))
      } catch {
        if (!cancelled) setCatalogModules([])
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
        await reload()
        if (!cancelled) setError(null)
      } catch (e) {
        if (!cancelled) {
          setRows([])
          setError(e instanceof ApiError ? e.message : 'Error al cargar roles.')
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
    if (editing) setEditMods(editing.modules ?? [])
  }, [editing])

  async function onCreate(
    e: React.FormEvent<HTMLFormElement>,
    close: () => void
  ) {
    e.preventDefault()
    setCreateError(null)
    const fd = new FormData(e.currentTarget)
    const code = String(fd.get('code') ?? '').trim()
    const name = String(fd.get('name') ?? '').trim()
    const icon = String(fd.get('icon') ?? '').trim()
    if (!code || !name) {
      setCreateError('Código y nombre son obligatorios.')
      return
    }
    setCreating(true)
    try {
      await apiFetch('/api/roles/', {
        method: 'POST',
        body: JSON.stringify({
          code,
          name,
          icon,
          ids_modules: selectedModules,
        }),
      })
    } catch (err) {
      setCreateError(getApiErrorMessage(err, 'Error al crear el rol.'))
      return
    } finally {
      setCreating(false)
    }

    setSelectedModules([])
    try {
      e.currentTarget.reset()
    } catch {
      /* form puede estar desmontada */
    }
    close()

    try {
      await reload()
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          'El rol se creó, pero no se pudo actualizar la tabla. Probá recargar la página.'
        )
      )
    }
  }

  async function onEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editing) return
    setEditError(null)
    const fd = new FormData(e.currentTarget)
    const code = String(fd.get('code') ?? '').trim()
    const name = String(fd.get('name') ?? '').trim()
    const icon = String(fd.get('icon') ?? '').trim()
    if (!code || !name) {
      setEditError('Código y nombre son obligatorios.')
      return
    }
    setUpdating(true)
    try {
      await apiFetch(`/api/roles/${editing.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          code,
          name,
          icon,
          ids_modules: editMods,
        }),
      })
      await reload()
      setEditing(null)
      setEditError(null)
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
      await apiFetch(`/api/roles/${deleteTarget.id}/`, { method: 'DELETE' })
      await reload()
      setError(null)
      setDeleteTarget(null)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Error al eliminar el rol.'))
    } finally {
      setDeletingId(null)
    }
  }

  const tableRows = rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    icon: r.icon || '—',
    modules: labelsForModuleIds(r.modules, catalogModules),
  }))

  const columns = [
    { key: 'code', label: 'Código' },
    { key: 'name', label: 'Nombre' },
    { key: 'icon', label: 'Icon key' },
    { key: 'modules', label: 'Módulos' },
    ...(canWrite ? [{ key: 'actions', label: 'Acciones' }] : []),
  ]

  return (
    <>
      <EntityTable
        belowTitleContent={
          <div className="max-w-md">
            <Label htmlFor="roles-search">Buscar</Label>
            <input
              id="roles-search"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Código o nombre…"
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
              title="Nuevo rol"
              description="Código interno, nombre visible y módulos a los que tendrá acceso."
              triggerLabel="Nuevo rol"
              triggerWrapperClassName="shrink-0"
              contentClassName="sm:max-w-lg"
            >
              {({ close }) => (
                <form
                  onSubmit={(e) => onCreate(e, close)}
                  className="grid max-w-lg gap-4"
                >
                  <div className="grid gap-2">
                    <Label htmlFor="role-code">Código</Label>
                    <input
                      id="role-code"
                      name="code"
                      required
                      placeholder="ej. cajero-noche"
                      className={inputClassName}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="role-name">Nombre</Label>
                    <input
                      id="role-name"
                      name="name"
                      required
                      placeholder="Nombre para mostrar"
                      className={inputClassName}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="role-icon">Icon key (Lucide)</Label>
                    <input
                      id="role-icon"
                      name="icon"
                      placeholder="ej. Shield, HandCoins, BadgeDollarSign"
                      className={inputClassName}
                    />
                  </div>
                  <RoleModuleCheckboxes
                    modules={catalogModules}
                    value={selectedModules}
                    onChange={setSelectedModules}
                    searchId="role-modules-search"
                  />
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
        columns={columns}
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

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent
          showCloseButton
          className="max-h-[min(90vh,640px)] overflow-y-auto sm:max-w-lg"
        >
          <DialogHeader>
            <DialogTitle>Editar rol</DialogTitle>
            <DialogDescription>
              Código, nombre y módulos de la plantilla. Las asignaciones por empresa siguen
              usando este rol.
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <form key={editing.id} onSubmit={onEditSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="roles-edit-code">Código</Label>
                <input
                  id="roles-edit-code"
                  name="code"
                  required
                  defaultValue={editing.code}
                  placeholder="ej. cajero-noche"
                  className={inputClassName}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="roles-edit-name">Nombre</Label>
                <input
                  id="roles-edit-name"
                  name="name"
                  required
                  defaultValue={editing.name}
                  placeholder="Nombre para mostrar"
                  className={inputClassName}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="roles-edit-icon">Icon key (Lucide)</Label>
                <input
                  id="roles-edit-icon"
                  name="icon"
                  defaultValue={editing.icon}
                  placeholder="ej. Shield, HandCoins, BadgeDollarSign"
                  className={inputClassName}
                />
              </div>
              <RoleModuleCheckboxes
                modules={catalogModules}
                value={editMods}
                onChange={setEditMods}
                searchId="roles-edit-modules-search"
              />
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

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar rol del catálogo</DialogTitle>
            <DialogDescription>
              Se elimina la plantilla{' '}
              <strong>
                {deleteTarget?.name} ({deleteTarget?.code})
              </strong>
              . También se quitan las asignaciones por empresa y los accesos al menú que dependían de
              este rol.
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
    </>
  )
}
