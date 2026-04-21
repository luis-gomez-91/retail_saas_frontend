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
import {
  apiFetch,
  parseListPayload,
  ApiError,
  withSearchQuery,
} from '@/lib/api/client'
import { canWriteStaffScopedApi } from '@/lib/auth/abilities'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { inputClassName } from '@/lib/ui/form-styles'
import type { AuthProvider, BillingAccount } from '@/lib/types/api'

const LIST_PATH = '/api/auth-providers/?page_size=250'

function sanitizeSortOrder(value: FormDataEntryValue | null): number {
  const raw = String(value ?? '').trim()
  if (!raw) return 0
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return Math.floor(parsed)
}

export default function AuthProvidersCatalogPage() {
  const [rows, setRows] = useState<AuthProvider[]>([])
  const [billingAccounts, setBillingAccounts] = useState<BillingAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<AuthProvider | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AuthProvider | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { me, loading: meLoading } = useMe()
  const canWrite = !meLoading && canWriteStaffScopedApi(me)

  const [searchInput, setSearchInput] = useState('')
  const [selectedBillingAccount, setSelectedBillingAccount] = useState('')
  const search = useDebouncedValue(searchInput)

  const reload = useCallback(async () => {
    const basePath = withSearchQuery(LIST_PATH, search)
    const path = selectedBillingAccount
      ? `${basePath}${basePath.includes('?') ? '&' : '?'}billing_account=${encodeURIComponent(selectedBillingAccount)}`
      : basePath
    const [providersResult, accountsResult] = await Promise.allSettled([
      apiFetch<unknown>(path),
      apiFetch<unknown>('/api/billing-accounts/?page_size=250'),
    ])
    if (providersResult.status === 'rejected') {
      throw providersResult.reason
    }
    setRows(parseListPayload<AuthProvider>(providersResult.value))
    if (accountsResult.status === 'fulfilled') {
      setBillingAccounts(parseListPayload<BillingAccount>(accountsResult.value))
    }
  }, [search, selectedBillingAccount])

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
              : 'Error al cargar proveedores de autenticación.'
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
    const isActive = fd.get('is_active') === 'on'
    const sortOrder = sanitizeSortOrder(fd.get('sort_order'))
    if (!code || !name) {
      setCreateError('Código y nombre son obligatorios.')
      return
    }
    setCreating(true)
    try {
      await apiFetch('/api/auth-providers/', {
        method: 'POST',
        body: JSON.stringify({
          code,
          name,
          is_active: isActive,
          sort_order: sortOrder,
        }),
      })
    } catch (err) {
      setCreateError(
        err instanceof ApiError ? err.message : 'Error al crear el proveedor.'
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
    const isActive = fd.get('is_active') === 'on'
    const sortOrder = sanitizeSortOrder(fd.get('sort_order'))
    if (!code || !name) {
      setEditError('Código y nombre son obligatorios.')
      return
    }
    setUpdating(true)
    try {
      const updated = await apiFetch<AuthProvider>(`/api/auth-providers/${editing.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          code,
          name,
          is_active: isActive,
          sort_order: sortOrder,
        }),
      })
      setRows((prev) =>
        prev.map((row) =>
          row.id === updated.id
            ? {
                ...row,
                code: updated.code,
                name: updated.name,
                is_active: updated.is_active,
                sort_order: updated.sort_order,
              }
            : row
        )
      )
      await reload()
      setEditing(null)
      setEditError(null)
    } catch (err) {
      setEditError(
        err instanceof ApiError ? err.message : 'Error al actualizar el proveedor.'
      )
    } finally {
      setUpdating(false)
    }
  }

  async function onDeleteConfirm() {
    if (!deleteTarget) return
    setDeletingId(deleteTarget.id)
    try {
      await apiFetch(`/api/auth-providers/${deleteTarget.id}/`, {
        method: 'DELETE',
      })
      await reload()
      setError(null)
      setDeleteTarget(null)
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Error al eliminar el proveedor.'
      )
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <EntityTable
        belowTitleContent={
          <div className="max-w-3xl">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="auth-prov-catalog-search">Buscar</Label>
                <input
                  id="auth-prov-catalog-search"
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Código o nombre…"
                  autoComplete="off"
                  className={inputClassName}
                />
              </div>
              <div>
                <Label htmlFor="auth-prov-catalog-billing-account">Cuenta facturación</Label>
                <select
                  id="auth-prov-catalog-billing-account"
                  value={selectedBillingAccount}
                  onChange={(e) => setSelectedBillingAccount(e.target.value)}
                  className={inputClassName}
                >
                  <option value="">Todas</option>
                  {billingAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        }
        loading={loading || meLoading}
        error={error}
        headerActions={
          canWrite ? (
            <StaffCreateDialog
              title="Nuevo auth provider"
              description="Definí el código técnico, nombre visible, estado y orden."
              triggerLabel="Nuevo proveedor"
              triggerWrapperClassName="shrink-0"
            >
              {({ close }) => (
                <form
                  onSubmit={(e) => onCreate(e, close)}
                  className="grid max-w-md gap-4"
                >
                  <div className="grid gap-2">
                    <Label htmlFor="ap-code">Código</Label>
                    <input
                      id="ap-code"
                      name="code"
                      required
                      autoComplete="off"
                      placeholder="google"
                      className={inputClassName}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="ap-name">Nombre</Label>
                    <input
                      id="ap-name"
                      name="name"
                      required
                      placeholder="Google"
                      className={inputClassName}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="ap-sort-order">Orden</Label>
                    <input
                      id="ap-sort-order"
                      name="sort_order"
                      type="number"
                      min={0}
                      step={1}
                      defaultValue={0}
                      className={inputClassName}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      id="ap-is-active"
                      name="is_active"
                      type="checkbox"
                      defaultChecked
                      className="size-4 rounded border-input accent-primary"
                    />
                    Activo
                  </label>
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
          { key: 'is_active', label: 'Activo' },
          { key: 'sort_order', label: 'Orden' },
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
                <DropdownMenuContent align="end" className="w-44">
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
            <DialogTitle>Eliminar auth provider</DialogTitle>
            <DialogDescription>
              Se eliminará{' '}
              <strong>
                {deleteTarget?.name} ({deleteTarget?.code})
              </strong>
              . Si hay asignaciones por persona, también se removerán.
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
            <DialogTitle>Editar auth provider</DialogTitle>
            <DialogDescription>
              Actualizá datos del proveedor OAuth/SSO.
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <form key={editing.id} onSubmit={onEdit} className="grid max-w-md gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-ap-code">Código</Label>
                <input
                  id="edit-ap-code"
                  name="code"
                  required
                  defaultValue={editing.code}
                  className={inputClassName}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-ap-name">Nombre</Label>
                <input
                  id="edit-ap-name"
                  name="name"
                  required
                  defaultValue={editing.name}
                  className={inputClassName}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-ap-sort-order">Orden</Label>
                <input
                  id="edit-ap-sort-order"
                  name="sort_order"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={editing.sort_order}
                  className={inputClassName}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  id="edit-ap-is-active"
                  name="is_active"
                  type="checkbox"
                  defaultChecked={editing.is_active}
                  className="size-4 rounded border-input accent-primary"
                />
                Activo
              </label>
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
