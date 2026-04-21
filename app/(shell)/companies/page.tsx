'use client'

import { useCallback, useEffect, useState } from 'react'
import { Edit, MoreHorizontal, Trash2 } from 'lucide-react'
import { EntityTable } from '@/components/entity-table'
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
import { useMe } from '@/components/me-provider'
import {
  apiFetch,
  parseListPayload,
  getApiErrorMessage,
  withSearchQuery,
} from '@/lib/api/client'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { canWriteStaffScopedApi } from '@/lib/auth/abilities'
import { inputClassName } from '@/lib/ui/form-styles'
import type { BillingAccount, Company } from '@/lib/types/api'

export default function EmpresasPage() {
  const { me, loading: meLoading } = useMe()
  const [rows, setRows] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<BillingAccount[]>([])
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Company | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const canWrite = !meLoading && canWriteStaffScopedApi(me)

  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput)

  const reloadEmpresas = useCallback(async () => {
    const data = await apiFetch<unknown>(withSearchQuery('/api/companies/', search))
    setRows(parseListPayload<Company>(data))
  }, [search])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        await reloadEmpresas()
        if (!cancelled) setError(null)
      } catch (e) {
        if (!cancelled) {
          setRows([])
          setError(getApiErrorMessage(e, 'Error al cargar empresas.'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reloadEmpresas])

  useEffect(() => {
    if (!canWrite) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await apiFetch<unknown>('/api/billing-accounts/')
        if (!cancelled) setAccounts(parseListPayload<BillingAccount>(data))
      } catch {
        if (!cancelled) setAccounts([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canWrite])

  async function onCreate(
    e: React.FormEvent<HTMLFormElement>,
    close: () => void
  ) {
    e.preventDefault()
    const form = e.currentTarget
    setCreateError(null)
    const fd = new FormData(form)
    const name = String(fd.get('name') ?? '').trim()
    const billing_account = String(fd.get('billing_account') ?? '').trim()
    if (!name || !billing_account) {
      setCreateError('Completa nombre y cuenta de facturación.')
      return
    }
    setCreating(true)
    try {
      await apiFetch('/api/companies/', {
        method: 'POST',
        body: JSON.stringify({ name, billing_account }),
      })
    } catch (err) {
      setCreateError(getApiErrorMessage(err, 'Error al crear la empresa.'))
      return
    } finally {
      setCreating(false)
    }

    form.reset()
    close()
    try {
      await reloadEmpresas()
      setCreateError(null)
    } catch (err) {
      setCreateError(
        getApiErrorMessage(
          err,
          'Empresa creada, pero no se pudo recargar la tabla. Recarga la página.'
        )
      )
    }
  }

  async function onEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editing) return
    const form = e.currentTarget
    setEditError(null)
    const fd = new FormData(form)
    const name = String(fd.get('name') ?? '').trim()
    const billing_account = String(fd.get('billing_account') ?? '').trim()
    if (!name || !billing_account) {
      setEditError('Completa nombre y cuenta de facturación.')
      return
    }
    setUpdating(true)
    try {
      await apiFetch(`/api/companies/${editing.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ name, billing_account }),
      })
      await reloadEmpresas()
      setEditing(null)
      setEditError(null)
    } catch (err) {
      setEditError(getApiErrorMessage(err, 'Error al actualizar la empresa.'))
    } finally {
      setUpdating(false)
    }
  }

  async function onDeleteConfirm() {
    if (!deleteTarget) return
    setDeletingId(deleteTarget.id)
    try {
      await apiFetch(`/api/companies/${deleteTarget.id}/`, { method: 'DELETE' })
      await reloadEmpresas()
      setError(null)
      setDeleteTarget(null)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Error al eliminar la empresa.'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <EntityTable
        belowTitleContent={
          <div className="max-w-md">
            <Label htmlFor="emp-search">Buscar</Label>
            <input
              id="emp-search"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Nombre o slug…"
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
              title="Nueva empresa"
              description="Asociá la empresa a una cuenta de facturación."
              triggerLabel="Nueva empresa"
              triggerWrapperClassName="shrink-0"
            >
              {({ close }) => (
                <form
                  onSubmit={(e) => onCreate(e, close)}
                  className="grid max-w-md gap-4"
                >
                  <div className="grid gap-2">
                    <Label htmlFor="emp-ba">Cuenta de facturación</Label>
                    <select
                      id="emp-ba"
                      name="billing_account"
                      required
                      className={inputClassName}
                    >
                      <option value="">— Elegir —</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="emp-name">Nombre</Label>
                    <input id="emp-name" name="name" required className={inputClassName} />
                    <p className="text-xs text-muted-foreground">
                      El slug se genera en el servidor a partir del nombre (p. ej. &quot;coorporacion el
                      rosado&quot; → coorporacion-el-rosado).
                    </p>
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
          { key: 'slug', label: 'Slug' },
          { key: 'billing_account', label: 'Cuenta facturación' },
          { key: 'created_at', label: 'Creada' },
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Acciones"
                  >
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

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar empresa</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Se eliminará{' '}
              <strong>
                {deleteTarget?.name} ({deleteTarget?.slug})
              </strong>{' '}
              y datos asociados según la base de datos.
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
            <DialogTitle>Editar empresa</DialogTitle>
            <DialogDescription>
              Si cambiás el nombre o la cuenta de facturación, el identificador interno se
              actualiza automáticamente.
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <form onSubmit={onEdit} className="grid max-w-md gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-emp-ba">Cuenta de facturación</Label>
                <select
                  id="edit-emp-ba"
                  name="billing_account"
                  required
                  defaultValue={editing.billing_account}
                  className={inputClassName}
                >
                  <option value="">— Elegir —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-emp-name">Nombre</Label>
                <input
                  id="edit-emp-name"
                  name="name"
                  required
                  defaultValue={editing.name}
                  className={inputClassName}
                />
                <p className="text-xs text-muted-foreground">
                  Slug actual: <span className="font-mono">{editing.slug}</span> (se
                  actualiza al guardar si cambias nombre o cuenta).
                </p>
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
