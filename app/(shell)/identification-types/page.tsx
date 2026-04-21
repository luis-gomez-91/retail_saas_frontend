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
import type { IdentificationType } from '@/lib/types/api'

const LIST_PATH = '/api/identification-types/?page_size=250'

export default function IdentificationTypesPage() {
  const [rows, setRows] = useState<IdentificationType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<IdentificationType | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<IdentificationType | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { me, loading: meLoading } = useMe()
  const canWrite = !meLoading && canWriteStaffScopedApi(me)

  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput)

  const reload = useCallback(async () => {
    const data = await apiFetch<unknown>(withSearchQuery(LIST_PATH, search))
    setRows(parseListPayload<IdentificationType>(data))
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
            e instanceof ApiError
              ? e.message
              : 'Error al cargar tipos de identificación.'
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
    const form = e.currentTarget
    setCreateError(null)
    const fd = new FormData(form)
    const code = String(fd.get('code') ?? '').trim()
    const name = String(fd.get('name') ?? '').trim()
    if (!code || !name) {
      setCreateError('Código y nombre son obligatorios.')
      return
    }
    setCreating(true)
    try {
      await apiFetch('/api/identification-types/', {
        method: 'POST',
        body: JSON.stringify({ code, name }),
      })
    } catch (err) {
      setCreateError(
        err instanceof ApiError ? err.message : 'Error al crear el tipo.'
      )
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
        err instanceof ApiError
          ? `Creado, pero no se pudo recargar la tabla: ${err.message}`
          : 'Creado, pero no se pudo recargar la tabla.'
      )
    }
  }

  async function onEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editing) return
    setEditError(null)
    const fd = new FormData(e.currentTarget)
    const code = String(fd.get('code') ?? '').trim()
    const name = String(fd.get('name') ?? '').trim()
    if (!code || !name) {
      setEditError('Código y nombre son obligatorios.')
      return
    }
    setUpdating(true)
    try {
      await apiFetch(`/api/identification-types/${editing.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ code, name }),
      })
      await reload()
      setEditing(null)
      setEditError(null)
    } catch (err) {
      setEditError(
        err instanceof ApiError ? err.message : 'Error al actualizar el tipo.'
      )
    } finally {
      setUpdating(false)
    }
  }

  async function onDeleteConfirm() {
    if (!deleteTarget) return
    setDeletingId(deleteTarget.id)
    try {
      await apiFetch(`/api/identification-types/${deleteTarget.id}/`, {
        method: 'DELETE',
      })
      await reload()
      setError(null)
      setDeleteTarget(null)
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Error al eliminar el tipo.'
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
            <Label htmlFor="idt-search">Buscar</Label>
            <input
              id="idt-search"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Código o nombre…"
              autoComplete="off"
              className={inputClassName}
            />
          </div>
        }
        loading={loading || meLoading}
        error={error}
        headerActions={
          canWrite ? (
            <StaffCreateDialog
              title="Nuevo tipo de identificación"
              description="Código estable (p. ej. DNI, PASSPORT) y nombre visible."
              triggerLabel="Nuevo tipo"
              triggerWrapperClassName="shrink-0"
            >
              {({ close }) => (
                <form
                  onSubmit={(e) => onCreate(e, close)}
                  className="grid max-w-md gap-4"
                >
                  <div className="grid gap-2">
                    <Label htmlFor="idt-code">Código</Label>
                    <input
                      id="idt-code"
                      name="code"
                      required
                      autoComplete="off"
                      placeholder="DNI"
                      className={inputClassName}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="idt-name">Nombre</Label>
                    <input
                      id="idt-name"
                      name="name"
                      required
                      placeholder="Documento Nacional de Identidad"
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
          { key: 'code', label: 'Código' },
          { key: 'name', label: 'Nombre' },
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
            <DialogTitle>Eliminar tipo de identificación</DialogTitle>
            <DialogDescription>
              Las personas que usen este tipo quedarán sin tipo asignado. Se eliminará{' '}
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
            <DialogTitle>Editar tipo</DialogTitle>
            <DialogDescription>
              Los cambios dependen de tus permisos (igual que en geografía).
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <form key={editing.id} onSubmit={onEdit} className="grid max-w-md gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-idt-code">Código</Label>
                <input
                  id="edit-idt-code"
                  name="code"
                  required
                  defaultValue={editing.code}
                  className={inputClassName}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-idt-name">Nombre</Label>
                <input
                  id="edit-idt-name"
                  name="name"
                  required
                  defaultValue={editing.name}
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
