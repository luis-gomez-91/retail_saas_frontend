'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Boxes, Edit, Eye, MoreHorizontal, Trash2 } from 'lucide-react'
import { EntityTable } from '@/components/entity-table'
import { StaffCreateDialog } from '@/components/staff-create-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useMe } from '@/components/me-provider'
import { apiFetch, parseListPayload, ApiError, withSearchQuery } from '@/lib/api/client'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { canWriteStaffScopedApi } from '@/lib/auth/abilities'
import { optionalDecimal, optionalIntString } from '@/lib/forms/numbers'
import { inputClassName } from '@/lib/ui/form-styles'
import type { Module, Plan, PlanModule } from '@/lib/types/api'

type PlanPayloadBody = {
  code?: string
  name: string
  description: string
  display_order: number
  max_companies: number | null
  max_organizations: number | null
  max_branches: number | null
  max_points_of_sale: number | null
  max_employees: number | null
  monthly_price: number | null
  yearly_price: number | null
  currency: string
  support_email: boolean
  support_chat: boolean
  support_dedicated: boolean
  sap_integration: boolean
  is_popular: boolean
}

function planPayloadFromForm(
  fd: FormData,
  opts: { includeCodigo: boolean }
): PlanPayloadBody {
  const base: PlanPayloadBody = {
    name: String(fd.get('name') ?? '').trim(),
    description: String(fd.get('description') ?? '').trim(),
    display_order: Math.trunc(Number(fd.get('display_order'))),
    max_companies: optionalIntString(String(fd.get('max_companies') ?? '')),
    max_organizations: optionalIntString(String(fd.get('max_organizations') ?? '')),
    max_branches: optionalIntString(String(fd.get('max_branches') ?? '')),
    max_points_of_sale: optionalIntString(String(fd.get('max_points_of_sale') ?? '')),
    max_employees: optionalIntString(String(fd.get('max_employees') ?? '')),
    monthly_price: optionalDecimal(String(fd.get('monthly_price') ?? '')),
    yearly_price: optionalDecimal(String(fd.get('yearly_price') ?? '')),
    currency: String(fd.get('currency') ?? 'USD')
      .trim()
      .slice(0, 3)
      .toUpperCase(),
    support_email: fd.get('support_email') === 'on',
    support_chat: fd.get('support_chat') === 'on',
    support_dedicated: fd.get('support_dedicated') === 'on',
    sap_integration: fd.get('sap_integration') === 'on',
    is_popular: fd.get('is_popular') === 'on',
  }
  if (opts.includeCodigo) {
    base.code = String(fd.get('code') ?? '').trim()
  }
  return base
}

function formatPlanMoney(
  amount: string | number | null | undefined,
  currency: string
): string {
  if (amount === null || amount === undefined || amount === '') return '—'
  const n = typeof amount === 'string' ? Number.parseFloat(amount) : Number(amount)
  if (!Number.isFinite(n)) return String(amount)
  const cur = currency?.length === 3 ? currency : 'USD'
  try {
    return new Intl.NumberFormat('es', {
      style: 'currency',
      currency: cur,
    }).format(n)
  } catch {
    return `${n} ${currency}`
  }
}

function planLimitLabel(n: number | null | undefined): string {
  if (n === null || n === undefined) return 'Sin límite'
  return String(n)
}

function yesNo(v: boolean): string {
  return v ? 'Sí' : 'No'
}

function PlanDetailContent({ plan }: { plan: Plan }) {
  const moduleIds = (plan.ids_modules ?? plan.module_ids)?.join(', ') ?? '—'
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border">
        <div className="divide-y divide-border/80">
          <div className="grid gap-1 px-3 py-2.5 sm:grid-cols-[minmax(0,140px)_1fr] sm:items-start sm:gap-4">
            <p className="text-sm font-medium text-muted-foreground">Descripción</p>
            <p className="text-sm whitespace-pre-wrap break-words">
              {plan.description?.trim() ? plan.description : '—'}
            </p>
          </div>
          <div className="grid gap-1 px-3 py-2.5 sm:grid-cols-[minmax(0,140px)_1fr] sm:items-start sm:gap-4">
            <p className="text-sm font-medium text-muted-foreground">Orden de presentación</p>
            <p className="text-sm">{plan.display_order}</p>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Precios
        </p>
        <div className="rounded-lg border border-border">
          <div className="divide-y divide-border/80">
            <div className="grid gap-1 px-3 py-2.5 sm:grid-cols-[minmax(0,140px)_1fr] sm:items-start sm:gap-4">
              <p className="text-sm font-medium text-muted-foreground">Precio mensual</p>
              <p className="text-sm">{formatPlanMoney(plan.monthly_price, plan.currency)}</p>
            </div>
            <div className="grid gap-1 px-3 py-2.5 sm:grid-cols-[minmax(0,140px)_1fr] sm:items-start sm:gap-4">
              <p className="text-sm font-medium text-muted-foreground">Precio anual</p>
              <p className="text-sm">{formatPlanMoney(plan.yearly_price, plan.currency)}</p>
            </div>
            <div className="grid gap-1 px-3 py-2.5 sm:grid-cols-[minmax(0,140px)_1fr] sm:items-start sm:gap-4">
              <p className="text-sm font-medium text-muted-foreground">Moneda (ISO)</p>
              <p className="text-sm font-mono">{plan.currency}</p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Límites
        </p>
        <div className="rounded-lg border border-border">
          <div className="divide-y divide-border/80">
            <div className="grid gap-1 px-3 py-2.5 sm:grid-cols-[minmax(0,140px)_1fr] sm:items-start sm:gap-4">
              <p className="text-sm font-medium text-muted-foreground">Máx. empresas</p>
              <p className="text-sm">{planLimitLabel(plan.max_companies)}</p>
            </div>
            <div className="grid gap-1 px-3 py-2.5 sm:grid-cols-[minmax(0,140px)_1fr] sm:items-start sm:gap-4">
              <p className="text-sm font-medium text-muted-foreground">Máx. organizaciones</p>
              <p className="text-sm">{planLimitLabel(plan.max_organizations)}</p>
            </div>
            <div className="grid gap-1 px-3 py-2.5 sm:grid-cols-[minmax(0,140px)_1fr] sm:items-start sm:gap-4">
              <p className="text-sm font-medium text-muted-foreground">Máx. sucursales</p>
              <p className="text-sm">{planLimitLabel(plan.max_branches)}</p>
            </div>
            <div className="grid gap-1 px-3 py-2.5 sm:grid-cols-[minmax(0,140px)_1fr] sm:items-start sm:gap-4">
              <p className="text-sm font-medium text-muted-foreground">Máx. puntos de venta</p>
              <p className="text-sm">{planLimitLabel(plan.max_points_of_sale)}</p>
            </div>
            <div className="grid gap-1 px-3 py-2.5 sm:grid-cols-[minmax(0,140px)_1fr] sm:items-start sm:gap-4">
              <p className="text-sm font-medium text-muted-foreground">Máx. empleados</p>
              <p className="text-sm">{planLimitLabel(plan.max_employees)}</p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Características
        </p>
        <div className="rounded-lg border border-border">
          <div className="divide-y divide-border/80">
            <div className="grid gap-1 px-3 py-2.5 sm:grid-cols-[minmax(0,140px)_1fr] sm:items-start sm:gap-4">
              <p className="text-sm font-medium text-muted-foreground">Soporte email</p>
              <p className="text-sm">{yesNo(plan.support_email)}</p>
            </div>
            <div className="grid gap-1 px-3 py-2.5 sm:grid-cols-[minmax(0,140px)_1fr] sm:items-start sm:gap-4">
              <p className="text-sm font-medium text-muted-foreground">Soporte chat</p>
              <p className="text-sm">{yesNo(plan.support_chat)}</p>
            </div>
            <div className="grid gap-1 px-3 py-2.5 sm:grid-cols-[minmax(0,140px)_1fr] sm:items-start sm:gap-4">
              <p className="text-sm font-medium text-muted-foreground">Soporte dedicado</p>
              <p className="text-sm">{yesNo(plan.support_dedicated)}</p>
            </div>
            <div className="grid gap-1 px-3 py-2.5 sm:grid-cols-[minmax(0,140px)_1fr] sm:items-start sm:gap-4">
              <p className="text-sm font-medium text-muted-foreground">Integración SAP</p>
              <p className="text-sm">{yesNo(plan.sap_integration)}</p>
            </div>
            <div className="grid gap-1 px-3 py-2.5 sm:grid-cols-[minmax(0,140px)_1fr] sm:items-start sm:gap-4">
              <p className="text-sm font-medium text-muted-foreground">Plan destacado</p>
              <p className="text-sm">{yesNo(plan.is_popular)}</p>
            </div>
            <div className="grid gap-1 px-3 py-2.5 sm:grid-cols-[minmax(0,140px)_1fr] sm:items-start sm:gap-4">
              <p className="text-sm font-medium text-muted-foreground">IDs módulos</p>
              <p className="text-sm font-mono break-all">{moduleIds}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PlanFormFields({
  idPrefix,
  plan,
  showCodigo,
}: {
  idPrefix: string
  plan?: Plan | null
  showCodigo: boolean
}) {
  const p = plan
  const chk = (name: string, v: boolean) => (
    <input
      id={`${idPrefix}-${name}`}
      name={name}
      type="checkbox"
      defaultChecked={!!v}
      className="size-4 rounded border-input"
    />
  )
  return (
    <div className="grid max-h-[min(70vh,520px)] gap-4 overflow-y-auto pr-1">
      {showCodigo ? (
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-codigo`}>Código (slug)</Label>
          <input
            id={`${idPrefix}-codigo`}
            name="code"
            required
            defaultValue={p?.code ?? ''}
            className={inputClassName}
            disabled={!!p}
          />
        </div>
      ) : null}
      <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-nombre`}>Nombre</Label>
        <input
          id={`${idPrefix}-nombre`}
          name="name"
          required
          defaultValue={p?.name ?? ''}
          className={inputClassName}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-descripcion`}>Descripción</Label>
        <textarea
          id={`${idPrefix}-descripcion`}
          name="description"
          rows={3}
          defaultValue={p?.description ?? ''}
          className={inputClassName}
          placeholder="Opcional"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-orden`}>Orden de presentación</Label>
        <input
          id={`${idPrefix}-orden`}
          name="display_order"
          type="number"
          required
          defaultValue={p?.display_order ?? 0}
          className={inputClassName}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 gap-x-4">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-max-e`}>Máx. empresas</Label>
          <input
            id={`${idPrefix}-max-e`}
            name="max_companies"
            type="number"
            min={0}
            defaultValue={p?.max_companies ?? ''}
            className={inputClassName}
            placeholder="vacío = sin límite"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-max-o`}>Máx. organizaciones</Label>
          <input
            id={`${idPrefix}-max-o`}
            name="max_organizations"
            type="number"
            min={0}
            defaultValue={p?.max_organizations ?? ''}
            className={inputClassName}
            placeholder="vacío = sin límite"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-max-s`}>Máx. sucursales</Label>
          <input
            id={`${idPrefix}-max-s`}
            name="max_branches"
            type="number"
            min={0}
            defaultValue={p?.max_branches ?? ''}
            className={inputClassName}
            placeholder="vacío = sin límite"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-max-pdv`}>Máx. puntos de venta</Label>
          <input
            id={`${idPrefix}-max-pdv`}
            name="max_points_of_sale"
            type="number"
            min={0}
            defaultValue={p?.max_points_of_sale ?? ''}
            className={inputClassName}
            placeholder="vacío = sin límite"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-max-emp`}>Máx. empleados</Label>
          <input
            id={`${idPrefix}-max-emp`}
            name="max_employees"
            type="number"
            min={0}
            defaultValue={p?.max_employees ?? ''}
            className={inputClassName}
            placeholder="vacío = sin límite"
          />
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3 gap-x-4">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-pm`}>Precio mensual</Label>
          <input
            id={`${idPrefix}-pm`}
            name="monthly_price"
            type="number"
            step="0.01"
            min={0}
            defaultValue={p?.monthly_price ?? ''}
            className={inputClassName}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-pa`}>Precio anual</Label>
          <input
            id={`${idPrefix}-pa`}
            name="yearly_price"
            type="number"
            step="0.01"
            min={0}
            defaultValue={p?.yearly_price ?? ''}
            className={inputClassName}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-moneda`}>Moneda (ISO)</Label>
          <input
            id={`${idPrefix}-moneda`}
            name="currency"
            maxLength={3}
            defaultValue={p?.currency ?? 'USD'}
            className={inputClassName}
          />
        </div>
      </div>
      <div className="grid gap-3 rounded-lg border border-border p-3">
        <p className="text-xs font-medium text-muted-foreground">Incluye</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <label className="flex items-center gap-2 font-normal">
            {chk('support_email', p?.support_email ?? true)}
            <span>Soporte email</span>
          </label>
          <label className="flex items-center gap-2 font-normal">
            {chk('support_chat', p?.support_chat ?? false)}
            <span>Soporte chat</span>
          </label>
          <label className="flex items-center gap-2 font-normal">
            {chk('support_dedicated', p?.support_dedicated ?? false)}
            <span>Soporte dedicado</span>
          </label>
          <label className="flex items-center gap-2 font-normal">
            {chk('sap_integration', p?.sap_integration ?? false)}
            <span>Integración SAP</span>
          </label>
          <label className="flex items-center gap-2 font-normal">
            {chk('is_popular', p?.is_popular ?? false)}
            <span>Plan destacado</span>
          </label>
        </div>
      </div>
    </div>
  )
}

export default function PlanesAdminPage() {
  const { me, loading: meLoading } = useMe()
  const canWrite = !meLoading && canWriteStaffScopedApi(me)

  const [rows, setRows] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const createLockRef = useRef(false)

  const [editing, setEditing] = useState<Plan | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [modulosPlan, setModulosPlan] = useState<Plan | null>(null)
  const [allModules, setAllModules] = useState<Module[]>([])
  const [selectedModuleIds, setSelectedModuleIds] = useState<Set<string>>(new Set())
  const [modulosError, setModulosError] = useState<string | null>(null)
  const [savingModulos, setSavingModulos] = useState(false)

  const [deleting, setDeleting] = useState<Plan | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)

  const [detailPlan, setDetailPlan] = useState<Plan | null>(null)

  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput)

  const reload = useCallback(async () => {
    const data = await apiFetch<unknown>(withSearchQuery('/api/plans/', search))
    setRows(parseListPayload<Plan>(data))
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
          setError(e instanceof ApiError ? e.message : 'Error al cargar planes.')
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
    if (createLockRef.current) return
    setCreateError(null)
    const fd = new FormData(e.currentTarget)
    const payload = planPayloadFromForm(fd, { includeCodigo: true })
    if (!payload.code || !payload.name || !Number.isFinite(payload.display_order)) {
      setCreateError('Código, nombre y orden son obligatorios.')
      return
    }
    setCreating(true)
    createLockRef.current = true
    try {
      await apiFetch('/api/plans/', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      e.currentTarget.reset()
      const ord = e.currentTarget.querySelector<HTMLInputElement>(
        'input[name="display_order"]'
      )
      if (ord) ord.value = '0'
      close()
      try {
        await reload()
      } catch (refreshErr) {
        setError(
          refreshErr instanceof ApiError
            ? `Plan creado, pero no se pudo refrescar la lista: ${refreshErr.message}`
            : 'Plan creado, pero no se pudo refrescar la lista.'
        )
      }
    } catch (err) {
      setCreateError(
        err instanceof ApiError ? err.message : 'Error al crear el plan.'
      )
    } finally {
      setCreating(false)
      createLockRef.current = false
    }
  }

  async function onSaveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editing) return
    setEditError(null)
    const fd = new FormData(e.currentTarget)
    const payload = planPayloadFromForm(fd, { includeCodigo: false })
    if (!payload.name || !Number.isFinite(payload.display_order)) {
      setEditError('Nombre y orden son obligatorios.')
      return
    }
    setSaving(true)
    try {
      await apiFetch(`/api/plans/${editing.id}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      await reload()
      setEditing(null)
    } catch (err) {
      setEditError(
        err instanceof ApiError ? err.message : 'Error al guardar el plan.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function onConfirmDelete() {
    if (!deleting) return
    setDeleteError(null)
    setDeletingBusy(true)
    try {
      await apiFetch(`/api/plans/${deleting.id}/`, { method: 'DELETE' })
      await reload()
      setDeleting(null)
    } catch (err) {
      setDeleteError(
        err instanceof ApiError ? err.message : 'Error al eliminar el plan.'
      )
    } finally {
      setDeletingBusy(false)
    }
  }

  async function openModulosDialog(plan: Plan) {
    setModulosError(null)
    setModulosPlan(plan)
    try {
      const [modulesData, linksData] = await Promise.all([
        apiFetch<unknown>('/api/modules/'),
        apiFetch<unknown>('/api/plan-modules/'),
      ])
      const modules = parseListPayload<Module>(modulesData).filter(
        (m) => !m.use_admin && !m.use_superuser
      )
      const links = parseListPayload<PlanModule>(linksData)
      const current = new Set(
        links.filter((l) => l.plan === plan.id).map((l) => l.module)
      )
      setAllModules(modules)
      setSelectedModuleIds(current)
    } catch (err) {
      setModulosError(
        err instanceof ApiError
          ? err.message
          : 'Error al cargar módulos del plan.'
      )
    }
  }

  function toggleModulo(moduloId: string) {
    setSelectedModuleIds((prev) => {
      const next = new Set(prev)
      if (next.has(moduloId)) next.delete(moduloId)
      else next.add(moduloId)
      return next
    })
  }

  async function onSaveModulosPlan() {
    if (!modulosPlan) return
    setSavingModulos(true)
    setModulosError(null)
    try {
      const linksData = await apiFetch<unknown>('/api/plan-modules/')
      const links = parseListPayload<PlanModule>(linksData).filter(
        (l) => l.plan === modulosPlan.id
      )
      const currentIds = new Set(links.map((l) => l.module))
      const selectedIds = selectedModuleIds

      const toCreate = [...selectedIds].filter((id) => !currentIds.has(id))
      const toDelete = links.filter((l) => !selectedIds.has(l.module))

      await Promise.all([
        ...toCreate.map((moduloId) =>
          apiFetch('/api/plan-modules/', {
            method: 'POST',
            body: JSON.stringify({ plan: modulosPlan.id, module: moduloId }),
          })
        ),
        ...toDelete.map((link) =>
          apiFetch(`/api/plan-modules/${link.id}/`, { method: 'DELETE' })
        ),
      ])

      setModulosPlan(null)
      await reload()
    } catch (err) {
      setModulosError(
        err instanceof ApiError ? err.message : 'Error al guardar módulos del plan.'
      )
    } finally {
      setSavingModulos(false)
    }
  }

  return (
    <>
      <EntityTable
        belowTitleContent={
          <div className="max-w-md">
            <Label htmlFor="plans-search">Buscar</Label>
            <input
              id="plans-search"
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
              title="Nuevo plan"
              description="Definí límites y precios; enlazá módulos desde el menú de cada fila."
              triggerLabel="Nuevo plan"
              triggerWrapperClassName="shrink-0"
              contentClassName="sm:max-w-2xl"
            >
              {({ close }) => (
                <form
                  onSubmit={(e) => onCreate(e, close)}
                  className="grid gap-4"
                >
                  <PlanFormFields idPrefix="create" showCodigo plan={null} />
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
          { key: 'description', label: 'Descripción' },
          { key: 'monthly_price', label: 'Precio / mes' },
          { key: 'yearly_price', label: 'Precio / año' },
          { key: 'currency', label: 'Moneda' },
          { key: '_acciones', label: 'Acciones' },
        ]}
        rows={
          rows.map((r) => ({
            name: r.name,
            description: r.description,
            monthly_price: r.monthly_price,
            yearly_price: r.yearly_price,
            currency: r.currency,
            _acciones: '',
          })) as unknown as Record<
            string,
            string | number | boolean | null | undefined
          >[]
        }
        renderCell={(row, key, rowIndex) => {
          const plan = rows[rowIndex]
          if (key === 'description') {
            const text = String(row.description ?? '').trim()
            if (!text) return '—'
            return (
              <span className="line-clamp-2 max-w-md text-muted-foreground">
                {text}
              </span>
            )
          }
          if (key === 'monthly_price' || key === 'yearly_price') {
            if (!plan) return undefined
            return formatPlanMoney(
              row[key] as string | null,
              plan.currency
            )
          }
          if (key === '_acciones') {
            if (!plan) return null
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
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem
                      onClick={() => setDetailPlan(plan)}
                    >
                      <Eye />
                      Ver detalle
                    </DropdownMenuItem>
                    {canWrite ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => void openModulosDialog(plan)}
                        >
                          <Boxes />
                          Gestionar módulos
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setEditError(null)
                            setEditing(plan)
                          }}
                        >
                          <Edit />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={deletingBusy}
                          onClick={() => {
                            setDeleteError(null)
                            setDeleting(plan)
                          }}
                        >
                          <Trash2 />
                          {deletingBusy && deleting?.id === plan.id
                            ? 'Eliminando…'
                            : 'Eliminar'}
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )
          }
          return undefined
        }}
      />

      <Dialog open={detailPlan !== null} onOpenChange={(o) => !o && setDetailPlan(null)}>
        <DialogContent
          showCloseButton
          className="max-h-[min(90vh,720px)] gap-0 overflow-y-auto p-0 sm:max-w-lg"
        >
          {detailPlan ? (
            <>
              <DialogHeader className="space-y-1 border-b border-border px-6 py-4 text-left">
                <DialogTitle className="pr-8">{detailPlan.name}</DialogTitle>
                <DialogDescription className="font-mono text-xs">
                  {detailPlan.code}
                </DialogDescription>
              </DialogHeader>
              <div className="px-6 py-4">
                <PlanDetailContent plan={detailPlan} />
              </div>
              <DialogFooter className="border-t border-border px-6 py-4 sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setDetailPlan(null)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent
          showCloseButton
          className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-2xl"
        >
          {editing ? (
            <form key={editing.id} onSubmit={onSaveEdit}>
              <DialogHeader>
                <DialogTitle>Editar plan</DialogTitle>
                <DialogDescription>
                  El código del plan no se puede cambiar una vez creado.
                </DialogDescription>
              </DialogHeader>
              <PlanFormFields idPrefix="edit" showCodigo plan={editing} />
              {editError ? (
                <p className="mt-3 text-sm text-destructive" role="alert">
                  {editError}
                </p>
              ) : null}
              <DialogFooter className="mt-4 border-0 bg-transparent p-0 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditing(null)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar'}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent
          showCloseButton
          className="sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle>Eliminar plan</DialogTitle>
            <DialogDescription>
              ¿Seguro que quieres eliminar el plan «{deleting?.name}» (
              {deleting?.code})? No podrás si hay suscripciones que lo referencien.
            </DialogDescription>
          </DialogHeader>
          {deleteError ? (
            <p className="text-sm text-destructive" role="alert">
              {deleteError}
            </p>
          ) : null}
          <DialogFooter className="border-0 bg-transparent p-0 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleting(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletingBusy}
              onClick={() => void onConfirmDelete()}
            >
              {deletingBusy ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!modulosPlan} onOpenChange={(o) => !o && setModulosPlan(null)}>
        <DialogContent showCloseButton className="max-h-[min(90vh,720px)] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Módulos del plan</DialogTitle>
            <DialogDescription>
              Elegí los módulos incluidos en «{modulosPlan?.name}». No se listan los módulos solo
              para administración de la plataforma.
            </DialogDescription>
          </DialogHeader>

          {modulosError ? (
            <p className="text-sm text-destructive" role="alert">
              {modulosError}
            </p>
          ) : null}

          <div className="grid max-h-[48vh] gap-2 overflow-y-auto rounded-lg border border-border p-3">
            {allModules.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin módulos disponibles.</p>
            ) : (
              allModules.map((m) => (
                <label key={m.id} className="flex items-start gap-3 rounded-md p-2 hover:bg-muted/40">
                  <input
                    type="checkbox"
                    checked={selectedModuleIds.has(m.id)}
                    onChange={() => toggleModulo(m.id)}
                    className="mt-0.5 size-4 rounded border-input"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      {m.name} <span className="text-muted-foreground">({m.code})</span>
                    </span>
                    {m.description ? (
                      <span className="block text-xs text-muted-foreground">{m.description}</span>
                    ) : null}
                  </span>
                </label>
              ))
            )}
          </div>

          <DialogFooter className="border-0 bg-transparent p-0 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModulosPlan(null)}
              disabled={savingModulos}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={() => void onSaveModulosPlan()} disabled={savingModulos}>
              {savingModulos ? 'Guardando…' : 'Guardar módulos'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
