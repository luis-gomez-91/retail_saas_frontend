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
import { apiFetch, ApiError, parseListPayload } from '@/lib/api/client'
import { canWriteStaffScopedApi } from '@/lib/auth/abilities'
import { inputClassName } from '@/lib/ui/form-styles'
import type {
  AuthProvider,
  BillingAccount,
  BillingAccountAuthProvider,
} from '@/lib/types/api'

const LIST_PATH = '/api/billing-account-auth-providers/?page_size=250'

export default function BillingAuthProvidersPage() {
  const [rows, setRows] = useState<BillingAccountAuthProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<BillingAccountAuthProvider | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BillingAccountAuthProvider | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<BillingAccount[]>([])
  const [providers, setProviders] = useState<AuthProvider[]>([])
  const [selectedBillingAccount, setSelectedBillingAccount] = useState('')
  const { me, loading: meLoading } = useMe()
  const canWrite = !meLoading && canWriteStaffScopedApi(me)
  const isSuperAdmin = Boolean(me?.is_superuser)
  const isTenantAdminOnly = Boolean(
    me?.is_admin && !me?.is_staff && !me?.is_superuser
  )
  const [ownBillingAccountId, setOwnBillingAccountId] = useState('')

  const reload = useCallback(async () => {
    const listPath =
      isSuperAdmin && selectedBillingAccount
        ? `${LIST_PATH}&billing_account=${encodeURIComponent(selectedBillingAccount)}`
        : LIST_PATH
    const [linksData, accountsData, providersData] = await Promise.all([
      apiFetch<unknown>(listPath),
      apiFetch<unknown>('/api/billing-accounts/?page_size=250'),
      apiFetch<unknown>('/api/auth-providers/?page_size=250'),
    ])
    setRows(parseListPayload<BillingAccountAuthProvider>(linksData))
    const parsedAccounts = parseListPayload<BillingAccount>(accountsData)
    setAccounts(parsedAccounts)
    setProviders(parseListPayload<AuthProvider>(providersData))
    if (isTenantAdminOnly) {
      setOwnBillingAccountId(parsedAccounts[0]?.id ?? '')
    }
  }, [isSuperAdmin, selectedBillingAccount, isTenantAdminOnly])

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
              : 'Error al cargar proveedores de auth por cuenta.'
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

  async function onCreate(e: React.FormEvent<HTMLFormElement>, close: () => void) {
    e.preventDefault()
    setCreateError(null)
    const form = e.currentTarget
    const fd = new FormData(form)
    const billingAccount = isTenantAdminOnly
      ? ownBillingAccountId
      : String(fd.get('billing_account') ?? '').trim()
    const provider = String(fd.get('provider') ?? '').trim()
    const isEnabled = fd.get('is_enabled') === 'on'
    if (!billingAccount || !provider) {
      setCreateError('Cuenta y proveedor son obligatorios.')
      return
    }
    setCreating(true)
    try {
      await apiFetch('/api/billing-account-auth-providers/', {
        method: 'POST',
        body: JSON.stringify({
          billing_account: billingAccount || undefined,
          provider,
          is_enabled: isEnabled,
        }),
      })
      await reload()
      form.reset()
      close()
    } catch (err) {
      setCreateError(
        err instanceof ApiError ? err.message : 'Error al crear la configuración.'
      )
    } finally {
      setCreating(false)
    }
  }

  async function onEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editing) return
    setEditError(null)
    const fd = new FormData(e.currentTarget)
    const billingAccount = isTenantAdminOnly
      ? ownBillingAccountId || editing.billing_account
      : String(fd.get('billing_account') ?? '').trim()
    const provider = String(fd.get('provider') ?? '').trim()
    const isEnabled = fd.get('is_enabled') === 'on'
    if (!billingAccount || !provider) {
      setEditError('Cuenta y proveedor son obligatorios.')
      return
    }
    setUpdating(true)
    try {
      await apiFetch(`/api/billing-account-auth-providers/${editing.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          billing_account: billingAccount || undefined,
          provider,
          is_enabled: isEnabled,
        }),
      })
      await reload()
      setEditing(null)
      setEditError(null)
    } catch (err) {
      setEditError(
        err instanceof ApiError ? err.message : 'Error al actualizar la configuración.'
      )
    } finally {
      setUpdating(false)
    }
  }

  async function onDeleteConfirm() {
    if (!deleteTarget) return
    setDeletingId(deleteTarget.id)
    try {
      await apiFetch(`/api/billing-account-auth-providers/${deleteTarget.id}/`, {
        method: 'DELETE',
      })
      await reload()
      setError(null)
      setDeleteTarget(null)
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Error al eliminar la configuración.'
      )
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      {isSuperAdmin ? (
        <div className="mb-4 max-w-md">
          <Label htmlFor="ba-auth-filter-account">Cuenta de facturación</Label>
          <select
            id="ba-auth-filter-account"
            value={selectedBillingAccount}
            onChange={(e) => setSelectedBillingAccount(e.target.value)}
            className={inputClassName}
          >
            <option value="">Todas</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <EntityTable
        loading={loading || meLoading}
        error={error}
        headerActions={
          canWrite ? (
            <StaffCreateDialog
              title="Nueva configuración"
              description="Vincula una cuenta de facturación con un proveedor de autenticación."
              triggerLabel="Nueva configuración"
              triggerWrapperClassName="shrink-0"
            >
              {({ close }) => (
                <form onSubmit={(e) => onCreate(e, close)} className="grid max-w-md gap-4">
                  {!isTenantAdminOnly ? (
                    <div className="grid gap-2">
                      <Label htmlFor="ba-auth-billing-account">Cuenta de facturación</Label>
                      <select
                        id="ba-auth-billing-account"
                        name="billing_account"
                        required
                        defaultValue=""
                        className={inputClassName}
                      >
                        <option value="" disabled>
                          Selecciona una cuenta...
                        </option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  <div className="grid gap-2">
                    <Label htmlFor="ba-auth-provider">Proveedor</Label>
                    <select
                      id="ba-auth-provider"
                      name="provider"
                      required
                      defaultValue=""
                      className={inputClassName}
                    >
                      <option value="" disabled>
                        Selecciona un proveedor...
                      </option>
                      {providers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      id="ba-auth-is-enabled"
                      name="is_enabled"
                      type="checkbox"
                      defaultChecked
                      className="size-4 rounded border-input accent-primary"
                    />
                    Habilitado
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
          { key: 'billing_account_name', label: 'Cuenta' },
          { key: 'provider_name', label: 'Proveedor' },
          { key: 'provider_code', label: 'Código proveedor' },
          { key: 'is_enabled', label: 'Habilitado' },
          { key: 'created_at', label: 'Creado' },
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
            <DialogTitle>Eliminar configuración</DialogTitle>
            <DialogDescription>
              Se eliminará la configuración de{' '}
              <strong>
                {deleteTarget?.provider_name} ({deleteTarget?.provider_code})
              </strong>{' '}
              para la cuenta <strong>{deleteTarget?.billing_account_name}</strong>.
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
            <DialogTitle>Editar configuración</DialogTitle>
            <DialogDescription>
              Actualiza cuenta, proveedor y estado de la configuración.
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <form key={editing.id} onSubmit={onEdit} className="grid max-w-md gap-4">
              {!isTenantAdminOnly ? (
                <div className="grid gap-2">
                  <Label htmlFor="edit-ba-auth-billing-account">Cuenta de facturación</Label>
                  <select
                    id="edit-ba-auth-billing-account"
                    name="billing_account"
                    required
                    defaultValue={editing.billing_account}
                    className={inputClassName}
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label>Cuenta de facturación</Label>
                  <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
                    {editing.billing_account_name || 'Cuenta actual'}
                  </p>
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="edit-ba-auth-provider">Proveedor</Label>
                <select
                  id="edit-ba-auth-provider"
                  name="provider"
                  required
                  defaultValue={editing.provider}
                  className={inputClassName}
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  id="edit-ba-auth-is-enabled"
                  name="is_enabled"
                  type="checkbox"
                  defaultChecked={editing.is_enabled}
                  className="size-4 rounded border-input accent-primary"
                />
                Habilitado
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
