'use client'

import { useCallback, useEffect, useState } from 'react'
import { EntityTable } from '@/components/entity-table'
import { StaffCreateDialog } from '@/components/staff-create-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useMe } from '@/components/me-provider'
import { apiFetch, parseListPayload, withSearchQuery, ApiError } from '@/lib/api/client'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { canWriteStaffScopedApi } from '@/lib/auth/abilities'
import { inputClassName } from '@/lib/ui/form-styles'
import type {
  BillingAccount,
  Plan,
  Subscription,
  SubscriptionStatus,
} from '@/lib/types/api'

export default function SuscripcionesPage() {
  const { me, loading: meLoading } = useMe()
  const [rows, setRows] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<BillingAccount[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [statuses, setStatuses] = useState<SubscriptionStatus[]>([])
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const canCreate = !meLoading && canWriteStaffScopedApi(me)

  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput)

  const reload = useCallback(async () => {
    const data = await apiFetch<unknown>(withSearchQuery('/api/subscriptions/', search))
    setRows(parseListPayload<Subscription>(data))
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
            e instanceof ApiError ? e.message : 'Error al cargar suscripciones.'
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

  useEffect(() => {
    if (!canCreate) return
    let cancelled = false
    ;(async () => {
      try {
        const [ba, pl, st] = await Promise.all([
          apiFetch<unknown>('/api/billing-accounts/'),
          apiFetch<unknown>('/api/plans/'),
          apiFetch<unknown>('/api/subscription-statuses/'),
        ])
        if (cancelled) return
        setAccounts(parseListPayload<BillingAccount>(ba))
        setPlans(parseListPayload<Plan>(pl))
        setStatuses(parseListPayload<SubscriptionStatus>(st))
      } catch {
        if (!cancelled) {
          setAccounts([])
          setPlans([])
          setStatuses([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canCreate])

  async function onCreate(
    e: React.FormEvent<HTMLFormElement>,
    close: () => void
  ) {
    e.preventDefault()
    setCreateError(null)
    const fd = new FormData(e.currentTarget)
    const billing_account = String(fd.get('billing_account') ?? '').trim()
    const plan = String(fd.get('plan') ?? '').trim()
    const status = String(fd.get('status') ?? '').trim()
    const current_period_end =
      String(fd.get('current_period_end') ?? '').trim() || null
    const external_subscription_id =
      String(fd.get('external_subscription_id') ?? '').trim() || null

    if (!billing_account || !plan || !status) {
      setCreateError('Elige cuenta, plan y estado.')
      return
    }

    setCreating(true)
    try {
      await apiFetch('/api/subscriptions/', {
        method: 'POST',
        body: JSON.stringify({
          billing_account,
          plan,
          status,
          current_period_end,
          external_subscription_id,
        }),
      })
      await reload()
      e.currentTarget.reset()
      close()
    } catch (err) {
      setCreateError(
        err instanceof ApiError ? err.message : 'Error al crear la suscripción.'
      )
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <EntityTable
        belowTitleContent={
          <div className="max-w-md">
            <Label htmlFor="sub-search">Buscar</Label>
            <input
              id="sub-search"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Plan, cuenta, estado, ID externo…"
              autoComplete="off"
              className={inputClassName}
            />
          </div>
        }
        loading={loading}
        error={error}
        headerActions={
          canCreate ? (
            <StaffCreateDialog
              title="Nueva suscripción"
              description="Vinculá cuenta de facturación, plan comercial y estado."
              triggerLabel="Nueva suscripción"
              contentClassName="sm:max-w-lg"
              triggerWrapperClassName="shrink-0"
            >
              {({ close }) => (
                <form
                  onSubmit={(e) => onCreate(e, close)}
                  className="grid max-w-md gap-4"
                >
                  <div className="grid gap-2">
                    <Label htmlFor="sub-ba">Cuenta de facturación</Label>
                    <select
                      id="sub-ba"
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
                    <Label htmlFor="sub-plan">Plan</Label>
                    <select id="sub-plan" name="plan" required className={inputClassName}>
                      <option value="">— Elegir —</option>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} ({p.name})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="sub-status">Estado</Label>
                    <select id="sub-status" name="status" required className={inputClassName}>
                      <option value="">— Elegir —</option>
                      {statuses.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code} ({s.name})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="sub-end">Fin de período (opcional)</Label>
                    <input
                      id="sub-end"
                      name="current_period_end"
                      type="datetime-local"
                      className={inputClassName}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="sub-ext">ID suscripción externa (opcional)</Label>
                    <input id="sub-ext" name="external_subscription_id" className={inputClassName} />
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
          { key: 'billing_account', label: 'Cuenta' },
          { key: 'plan', label: 'Plan' },
          { key: 'status', label: 'Estado' },
          { key: 'current_period_end', label: 'Fin período' },
          { key: 'external_subscription_id', label: 'ID externo' },
        ]}
        rows={
          rows as unknown as Record<
            string,
            string | number | boolean | null | undefined
          >[]
        }
      />
    </>
  )
}
