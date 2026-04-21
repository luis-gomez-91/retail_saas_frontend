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
import { apiFetch, parseListPayload, withSearchQuery, ApiError } from '@/lib/api/client'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { inputClassName } from '@/lib/ui/form-styles'
import type { Module } from '@/lib/types/api'

export default function ModulosPage() {
  const [rows, setRows] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Module | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Module | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { me, loading: meLoading } = useMe()
  const canWrite = !meLoading && canWriteStaffScopedApi(me)

  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput)

  const reload = useCallback(async () => {
    const data = await apiFetch<unknown>(withSearchQuery('/api/modules/', search))
    setRows(parseListPayload<Module>(data))
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
          setError(e instanceof ApiError ? e.message : 'Error al cargar módulos.')
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
    const form = e.currentTarget
    setCreateError(null)
    const fd = new FormData(form)
    const code = String(fd.get('code') ?? '').trim()
    const name = String(fd.get('name') ?? '').trim()
    const description = String(fd.get('description') ?? '').trim()
    const icon = String(fd.get('icon') ?? '').trim()
    const useSuperuser = fd.get('use_superuser') === 'on'
    const useAdmin = fd.get('use_admin') === 'on'
    if (!code || !name) {
      setCreateError('Código y nombre son obligatorios.')
      return
    }
    setCreating(true)
    try {
      await apiFetch('/api/modules/', {
        method: 'POST',
        body: JSON.stringify({
          code,
          name,
          description,
          icon,
          use_superuser: useSuperuser,
          use_admin: useAdmin,
        }),
      })
    } catch (err) {
      setCreateError(
        err instanceof ApiError ? err.message : 'Error al crear el módulo.'
      )
      return
    } finally {
      setCreating(false)
    }

    // Si el POST fue exitoso, cerramos aunque falle el refresh de tabla.
    form.reset()
    close()
    try {
      await reload()
      setCreateError(null)
    } catch (err) {
      setCreateError(
        err instanceof ApiError
          ? `Módulo creado, pero no se pudo recargar la tabla: ${err.message}`
          : 'Módulo creado, pero no se pudo recargar la tabla.'
      )
    }
  }

  async function onEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editing) return
    const form = e.currentTarget
    setEditError(null)
    const fd = new FormData(form)
    const code = String(fd.get('code') ?? '').trim()
    const name = String(fd.get('name') ?? '').trim()
    const description = String(fd.get('description') ?? '').trim()
    const icon = String(fd.get('icon') ?? '').trim()
    const useSuperuser = fd.get('use_superuser') === 'on'
    const useAdmin = fd.get('use_admin') === 'on'
    if (!code || !name) {
      setEditError('Código y nombre son obligatorios.')
      return
    }
    setUpdating(true)
    try {
      await apiFetch(`/api/modules/${editing.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          code,
          name,
          description,
          icon,
          use_superuser: useSuperuser,
          use_admin: useAdmin,
        }),
      })
      await reload()
      setEditing(null)
      setEditError(null)
    } catch (err) {
      setEditError(
        err instanceof ApiError ? err.message : 'Error al actualizar el módulo.'
      )
    } finally {
      setUpdating(false)
    }
  }

  async function onDeleteConfirm() {
    if (!deleteTarget) return
    setDeletingId(deleteTarget.id)
    try {
      await apiFetch(`/api/modules/${deleteTarget.id}/`, { method: 'DELETE' })
      await reload()
      setError(null)
      setDeleteTarget(null)
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Error al eliminar el módulo.'
      )
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <EntityTable
        belowTitleContent={
          <div className="max-w-md">
            <Label htmlFor="mod-search">Buscar</Label>
            <input
              id="mod-search"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Nombre, código o descripción…"
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
              title="Nuevo módulo"
              description="Definí código, nombre y permisos de menú (superuser / admin)."
              triggerLabel="Nuevo módulo"
              triggerWrapperClassName="shrink-0"
            >
              {({ close }) => (
                <form
                  onSubmit={(e) => onCreate(e, close)}
                  className="grid max-w-md gap-4"
                >
                  <div className="grid gap-2">
                    <Label htmlFor="mod-code">Código</Label>
                    <input id="mod-code" name="code" required className={inputClassName} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="mod-name">Nombre</Label>
                    <input id="mod-name" name="name" required className={inputClassName} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="mod-desc">Descripción</Label>
                    <textarea
                      id="mod-desc"
                      name="description"
                      rows={3}
                      className={inputClassName}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="mod-icon">Clave de icono (opcional)</Label>
                    <input
                      id="mod-icon"
                      name="icon"
                      placeholder="p. ej. LayoutDashboard"
                      className={inputClassName}
                    />
                  </div>
                  <div className="grid gap-3 rounded-lg border border-border p-3">
                    <Label className="font-semibold">Acceso especial</Label>
                    <Label htmlFor="mod-usa-superuser" className="text-sm font-normal">
                      <input id="mod-usa-superuser" name="use_superuser" type="checkbox" />
                      Usar para superusuario
                    </Label>
                    <Label htmlFor="mod-usa-admin" className="text-sm font-normal">
                      <input id="mod-usa-admin" name="use_admin" type="checkbox" />
                      Usar para admin
                    </Label>
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
          { key: 'code', label: 'Código' },
          { key: 'description', label: 'Descripción' },
          { key: 'use_superuser', label: 'Usa superuser' },
          { key: 'use_admin', label: 'Usa admin' },
          ...(canWrite ? [{ key: 'actions', label: 'Acciones' }] : []),
        ]}
        rows={
          rows as unknown as Record<
            string,
            string | number | boolean | null | undefined
          >[]
        }
        renderCell={(row, key, rowIndex) => {
          if (key !== 'actions') return undefined
          const source = rows[rowIndex]
          if (!source) return '—'
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
            <DialogTitle>Eliminar módulo</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Se eliminará{' '}
              <strong>
                {deleteTarget?.name} ({deleteTarget?.code})
              </strong>
              .
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
            <DialogTitle>Editar módulo</DialogTitle>
            <DialogDescription>
              Los cambios dependen de tus permisos en el sistema.
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <form onSubmit={onEdit} className="grid max-w-md gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-mod-code">Código</Label>
                <input
                  id="edit-mod-code"
                  name="code"
                  required
                  defaultValue={editing.code}
                  className={inputClassName}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-mod-name">Nombre</Label>
                <input
                  id="edit-mod-name"
                  name="name"
                  required
                  defaultValue={editing.name}
                  className={inputClassName}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-mod-desc">Descripción</Label>
                <textarea
                  id="edit-mod-desc"
                  name="description"
                  rows={3}
                  defaultValue={editing.description}
                  className={inputClassName}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-mod-icon">Clave de icono (opcional)</Label>
                <input
                  id="edit-mod-icon"
                  name="icon"
                  defaultValue={editing.icon}
                  className={inputClassName}
                />
              </div>
              <div className="grid gap-3 rounded-lg border border-border p-3">
                <Label className="font-semibold">Acceso especial</Label>
                <Label htmlFor="edit-mod-usa-superuser" className="text-sm font-normal">
                  <input
                    id="edit-mod-usa-superuser"
                    name="use_superuser"
                    type="checkbox"
                    defaultChecked={editing.use_superuser}
                  />
                  Usar para superusuario
                </Label>
                <Label htmlFor="edit-mod-usa-admin" className="text-sm font-normal">
                  <input
                    id="edit-mod-usa-admin"
                    name="use_admin"
                    type="checkbox"
                    defaultChecked={editing.use_admin}
                  />
                  Usar para admin
                </Label>
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
