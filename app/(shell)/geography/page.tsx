'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import {
  apiFetch,
  apiFetchPaginated,
  fetchAllPages,
  ApiError,
} from '@/lib/api/client'
import { inputClassName } from '@/lib/ui/form-styles'
import type { GeoCity, GeoCountry, GeoProvince } from '@/lib/types/api'
import { cn } from '@/lib/utils'

const GEO_PAGE_SIZE = 50

type Tab = 'countries' | 'provinces' | 'cities'

function GeoPaginationBar({
  page,
  total,
  pageSize,
  loading,
  onPageChange,
}: {
  page: number
  total: number
  pageSize: number
  loading: boolean
  onPageChange: (p: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = total === 0 ? 0 : Math.min(page * pageSize, total)
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
      <span>
        {total === 0 ? '0 resultados' : `${from}–${to} de ${total}`}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Anterior
        </Button>
        <span className="tabular-nums">
          Página {page} / {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Siguiente
        </Button>
      </div>
    </div>
  )
}

export default function GeographyPage() {
  const [tab, setTab] = useState<Tab>('countries')
  const { me, loading: meLoading } = useMe()
  const canWrite = !meLoading && canWriteStaffScopedApi(me)

  const [countryOptions, setCountryOptions] = useState<GeoCountry[]>([])
  const [countriesRows, setCountriesRows] = useState<GeoCountry[]>([])
  const [countriesCount, setCountriesCount] = useState(0)
  const [countriesPage, setCountriesPage] = useState(1)

  const [provincesCatalog, setProvincesCatalog] = useState<GeoProvince[]>([])
  const [provincesRows, setProvincesRows] = useState<GeoProvince[]>([])
  const [provincesCount, setProvincesCount] = useState(0)
  const [provincesPage, setProvincesPage] = useState(1)

  const [citiesRows, setCitiesRows] = useState<GeoCity[]>([])
  const [citiesCount, setCitiesCount] = useState(0)
  const [citiesPage, setCitiesPage] = useState(1)

  const [loadingBootstrap, setLoadingBootstrap] = useState(true)
  const [loadingCountries, setLoadingCountries] = useState(false)
  const [loadingProvinces, setLoadingProvinces] = useState(false)
  const [loadingCities, setLoadingCities] = useState(false)

  const [errorCountries, setErrorCountries] = useState<string | null>(null)
  const [errorProvinces, setErrorProvinces] = useState<string | null>(null)
  const [errorCities, setErrorCities] = useState<string | null>(null)

  const [filterProvinceCountry, setFilterProvinceCountry] = useState('')
  const [filterCityCountry, setFilterCityCountry] = useState('')
  const [filterCityProvince, setFilterCityProvince] = useState('')

  const [searchCountryInput, setSearchCountryInput] = useState('')
  const [searchCountry, setSearchCountry] = useState('')
  const [searchProvinceInput, setSearchProvinceInput] = useState('')
  const [searchProvince, setSearchProvince] = useState('')
  const [searchCityInput, setSearchCityInput] = useState('')
  const [searchCity, setSearchCity] = useState('')

  const [createErr, setCreateErr] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editingCountry, setEditingCountry] = useState<GeoCountry | null>(null)
  const [editingProvince, setEditingProvince] = useState<GeoProvince | null>(null)
  const [editingCity, setEditingCity] = useState<GeoCity | null>(null)
  const [editErr, setEditErr] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [deleteCountry, setDeleteCountry] = useState<GeoCountry | null>(null)
  const [deleteProvince, setDeleteProvince] = useState<GeoProvince | null>(null)
  const [deleteCity, setDeleteCity] = useState<GeoCity | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadCountryOptions = useCallback(async () => {
    const all = await fetchAllPages<GeoCountry>('/api/countries/')
    setCountryOptions(all)
  }, [])

  const loadCountriesTable = useCallback(async () => {
    const data = await apiFetchPaginated<GeoCountry>(
      '/api/countries/',
      countriesPage,
      GEO_PAGE_SIZE,
      { search: searchCountry }
    )
    if (data.results.length === 0 && data.count > 0 && countriesPage > 1) {
      setCountriesPage((p) => p - 1)
      return
    }
    setCountriesRows(data.results)
    setCountriesCount(data.count)
  }, [countriesPage, searchCountry])

  const reloadProvincesCatalog = useCallback(async () => {
    const all = await fetchAllPages<GeoProvince>('/api/provinces/')
    setProvincesCatalog(all)
  }, [])

  const reloadProvincesRows = useCallback(async () => {
    const path = filterProvinceCountry
      ? `/api/provinces/?country=${encodeURIComponent(filterProvinceCountry)}`
      : '/api/provinces/'
    const data = await apiFetchPaginated<GeoProvince>(
      path,
      provincesPage,
      GEO_PAGE_SIZE,
      { search: searchProvince }
    )
    if (data.results.length === 0 && data.count > 0 && provincesPage > 1) {
      setProvincesPage((p) => p - 1)
      return
    }
    setProvincesRows(data.results)
    setProvincesCount(data.count)
  }, [filterProvinceCountry, provincesPage, searchProvince])

  const reloadCitiesRows = useCallback(async () => {
    const params = new URLSearchParams()
    if (filterCityProvince) params.set('province', filterCityProvince)
    else if (filterCityCountry) params.set('country', filterCityCountry)
    const q = params.toString() ? `?${params.toString()}` : ''
    const path = `/api/cities/${q}`
    const data = await apiFetchPaginated<GeoCity>(
      path,
      citiesPage,
      GEO_PAGE_SIZE,
      { search: searchCity }
    )
    if (data.results.length === 0 && data.count > 0 && citiesPage > 1) {
      setCitiesPage((p) => p - 1)
      return
    }
    setCitiesRows(data.results)
    setCitiesCount(data.count)
  }, [filterCityCountry, filterCityProvince, citiesPage, searchCity])

  const provincesForCityFilter = useMemo(() => {
    if (!filterCityCountry) return provincesCatalog
    return provincesCatalog.filter((p) => p.country === filterCityCountry)
  }, [filterCityCountry, provincesCatalog])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await Promise.all([loadCountryOptions(), reloadProvincesCatalog()])
        if (!cancelled) setErrorCountries(null)
      } catch (e) {
        if (!cancelled) {
          setCountryOptions([])
          setProvincesCatalog([])
          setErrorCountries(
            e instanceof ApiError ? e.message : 'Error al cargar datos iniciales.'
          )
        }
      } finally {
        if (!cancelled) setLoadingBootstrap(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadCountryOptions, reloadProvincesCatalog])

  useEffect(() => {
    setProvincesPage(1)
  }, [filterProvinceCountry])

  useEffect(() => {
    setCitiesPage(1)
  }, [filterCityCountry, filterCityProvince])

  useEffect(() => {
    const id = setTimeout(() => setSearchCountry(searchCountryInput.trim()), 350)
    return () => clearTimeout(id)
  }, [searchCountryInput])

  useEffect(() => {
    const id = setTimeout(() => setSearchProvince(searchProvinceInput.trim()), 350)
    return () => clearTimeout(id)
  }, [searchProvinceInput])

  useEffect(() => {
    const id = setTimeout(() => setSearchCity(searchCityInput.trim()), 350)
    return () => clearTimeout(id)
  }, [searchCityInput])

  useEffect(() => {
    setCountriesPage(1)
  }, [searchCountry])

  useEffect(() => {
    setProvincesPage(1)
  }, [searchProvince])

  useEffect(() => {
    setCitiesPage(1)
  }, [searchCity])

  useEffect(() => {
    if (tab !== 'countries') return
    let cancelled = false
    ;(async () => {
      setLoadingCountries(true)
      try {
        await loadCountriesTable()
        if (!cancelled) setErrorCountries(null)
      } catch (e) {
        if (!cancelled) {
          setCountriesRows([])
          setCountriesCount(0)
          setErrorCountries(
            e instanceof ApiError ? e.message : 'Error al cargar países.'
          )
        }
      } finally {
        if (!cancelled) setLoadingCountries(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tab, loadCountriesTable])

  useEffect(() => {
    if (tab !== 'provinces') return
    let cancelled = false
    ;(async () => {
      setLoadingProvinces(true)
      try {
        await reloadProvincesRows()
        if (!cancelled) setErrorProvinces(null)
      } catch (e) {
        if (!cancelled) {
          setProvincesRows([])
          setProvincesCount(0)
          setErrorProvinces(
            e instanceof ApiError ? e.message : 'Error al cargar provincias.'
          )
        }
      } finally {
        if (!cancelled) setLoadingProvinces(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tab, reloadProvincesRows])

  useEffect(() => {
    if (tab !== 'cities') return
    let cancelled = false
    ;(async () => {
      setLoadingCities(true)
      try {
        await reloadCitiesRows()
        if (!cancelled) setErrorCities(null)
      } catch (e) {
        if (!cancelled) {
          setCitiesRows([])
          setCitiesCount(0)
          setErrorCities(
            e instanceof ApiError ? e.message : 'Error al cargar ciudades.'
          )
        }
      } finally {
        if (!cancelled) setLoadingCities(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tab, reloadCitiesRows])

  async function onCreateCountry(
    e: React.FormEvent<HTMLFormElement>,
    close: () => void
  ) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const name = String(fd.get('name') ?? '').trim()
    const iso = String(fd.get('iso_code') ?? '').trim()
    if (!name) {
      setCreateErr('El nombre es obligatorio.')
      return
    }
    setCreateErr(null)
    setCreating(true)
    try {
      await apiFetch('/api/countries/', {
        method: 'POST',
        body: JSON.stringify({
          name,
          iso_code: iso || null,
        }),
      })
      e.currentTarget.reset()
      close()
      await loadCountryOptions()
      await loadCountriesTable()
    } catch (err) {
      setCreateErr(
        err instanceof ApiError ? err.message : 'Error al crear el país.'
      )
    } finally {
      setCreating(false)
    }
  }

  async function onCreateProvince(
    e: React.FormEvent<HTMLFormElement>,
    close: () => void
  ) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const country = String(fd.get('country') ?? '')
    const name = String(fd.get('name') ?? '').trim()
    if (!country || !name) {
      setCreateErr('País y nombre son obligatorios.')
      return
    }
    setCreateErr(null)
    setCreating(true)
    try {
      await apiFetch('/api/provinces/', {
        method: 'POST',
        body: JSON.stringify({ country, name }),
      })
      e.currentTarget.reset()
      close()
      await Promise.all([reloadProvincesCatalog(), reloadProvincesRows()])
    } catch (err) {
      setCreateErr(
        err instanceof ApiError ? err.message : 'Error al crear la provincia.'
      )
    } finally {
      setCreating(false)
    }
  }

  async function onCreateCity(
    e: React.FormEvent<HTMLFormElement>,
    close: () => void
  ) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const province = String(fd.get('province') ?? '')
    const name = String(fd.get('name') ?? '').trim()
    if (!province || !name) {
      setCreateErr('Provincia y nombre son obligatorios.')
      return
    }
    setCreateErr(null)
    setCreating(true)
    try {
      await apiFetch('/api/cities/', {
        method: 'POST',
        body: JSON.stringify({ province, name }),
      })
      e.currentTarget.reset()
      close()
      await reloadCitiesRows()
    } catch (err) {
      setCreateErr(
        err instanceof ApiError ? err.message : 'Error al crear la ciudad.'
      )
    } finally {
      setCreating(false)
    }
  }

  async function onEditCountry(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingCountry) return
    const fd = new FormData(e.currentTarget)
    const name = String(fd.get('name') ?? '').trim()
    const iso = String(fd.get('iso_code') ?? '').trim()
    if (!name) {
      setEditErr('El nombre es obligatorio.')
      return
    }
    setEditErr(null)
    setUpdating(true)
    try {
      await apiFetch(`/api/countries/${editingCountry.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ name, iso_code: iso || null }),
      })
      await loadCountryOptions()
      await loadCountriesTable()
      setEditingCountry(null)
    } catch (err) {
      setEditErr(
        err instanceof ApiError ? err.message : 'Error al actualizar el país.'
      )
    } finally {
      setUpdating(false)
    }
  }

  async function onEditProvince(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingProvince) return
    const fd = new FormData(e.currentTarget)
    const country = String(fd.get('country') ?? '')
    const name = String(fd.get('name') ?? '').trim()
    if (!country || !name) {
      setEditErr('País y nombre son obligatorios.')
      return
    }
    setEditErr(null)
    setUpdating(true)
    try {
      await apiFetch(`/api/provinces/${editingProvince.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ country, name }),
      })
      await Promise.all([reloadProvincesCatalog(), reloadProvincesRows()])
      setEditingProvince(null)
    } catch (err) {
      setEditErr(
        err instanceof ApiError ? err.message : 'Error al actualizar la provincia.'
      )
    } finally {
      setUpdating(false)
    }
  }

  async function onEditCity(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingCity) return
    const fd = new FormData(e.currentTarget)
    const province = String(fd.get('province') ?? '')
    const name = String(fd.get('name') ?? '').trim()
    if (!province || !name) {
      setEditErr('Provincia y nombre son obligatorios.')
      return
    }
    setEditErr(null)
    setUpdating(true)
    try {
      await apiFetch(`/api/cities/${editingCity.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ province, name }),
      })
      await reloadCitiesRows()
      setEditingCity(null)
    } catch (err) {
      setEditErr(
        err instanceof ApiError ? err.message : 'Error al actualizar la ciudad.'
      )
    } finally {
      setUpdating(false)
    }
  }

  async function confirmDeleteCountry() {
    if (!deleteCountry) return
    setDeletingId(deleteCountry.id)
    try {
      await apiFetch(`/api/countries/${deleteCountry.id}/`, { method: 'DELETE' })
      await loadCountryOptions()
      await reloadProvincesCatalog()
      await loadCountriesTable()
      if (tab === 'provinces') await reloadProvincesRows()
      setDeleteCountry(null)
      setErrorCountries(null)
    } catch (err) {
      setErrorCountries(
        err instanceof ApiError ? err.message : 'Error al eliminar el país.'
      )
    } finally {
      setDeletingId(null)
    }
  }

  async function confirmDeleteProvince() {
    if (!deleteProvince) return
    setDeletingId(deleteProvince.id)
    try {
      await apiFetch(`/api/provinces/${deleteProvince.id}/`, { method: 'DELETE' })
      await Promise.all([reloadProvincesCatalog(), reloadProvincesRows(), reloadCitiesRows()])
      setDeleteProvince(null)
      setErrorProvinces(null)
    } catch (err) {
      setErrorProvinces(
        err instanceof ApiError ? err.message : 'Error al eliminar la provincia.'
      )
    } finally {
      setDeletingId(null)
    }
  }

  async function confirmDeleteCity() {
    if (!deleteCity) return
    setDeletingId(deleteCity.id)
    try {
      await apiFetch(`/api/cities/${deleteCity.id}/`, { method: 'DELETE' })
      await reloadCitiesRows()
      setDeleteCity(null)
      setErrorCities(null)
    } catch (err) {
      setErrorCities(
        err instanceof ApiError ? err.message : 'Error al eliminar la ciudad.'
      )
    } finally {
      setDeletingId(null)
    }
  }

  const tabBtn = (id: Tab, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      className={cn(
        'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
        tab === id
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:bg-muted/80'
      )}
    >
      {label}
    </button>
  )

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-2">
        {tabBtn('countries', 'Países')}
        {tabBtn('provinces', 'Provincias')}
        {tabBtn('cities', 'Ciudades')}
      </div>

      {tab === 'countries' ? (
        <>
          <div>
            <EntityTable
              belowTitleContent={
                <div className="max-w-md">
                  <Label htmlFor="search-country">Buscar por nombre</Label>
                  <input
                    id="search-country"
                    type="search"
                    value={searchCountryInput}
                    onChange={(e) => setSearchCountryInput(e.target.value)}
                    placeholder="Filtrar países…"
                    autoComplete="off"
                    className={inputClassName}
                  />
                </div>
              }
              loading={loadingCountries || loadingBootstrap}
              error={errorCountries}
              headerActions={
                canWrite ? (
                  <StaffCreateDialog
                    title="Nuevo país"
                    description="Agregar un país al listado."
                    triggerLabel="Nuevo país"
                    triggerWrapperClassName="shrink-0"
                  >
                    {({ close }) => (
                      <form
                        onSubmit={(e) => onCreateCountry(e, close)}
                        className="grid max-w-md gap-4"
                      >
                        <div className="grid gap-2">
                          <Label htmlFor="c-name">Nombre</Label>
                          <input id="c-name" name="name" required className={inputClassName} />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="c-iso">ISO (opcional, 2 letras)</Label>
                          <input
                            id="c-iso"
                            name="iso_code"
                            maxLength={2}
                            placeholder="AR"
                            className={inputClassName}
                          />
                        </div>
                        {createErr ? (
                          <p className="text-sm text-destructive" role="alert">
                            {createErr}
                          </p>
                        ) : null}
                        <Button type="submit" disabled={creating || !canWrite}>
                          {creating ? 'Creando…' : 'Crear'}
                        </Button>
                      </form>
                    )}
                  </StaffCreateDialog>
                ) : undefined
              }
              columns={[
                { key: 'name', label: 'Nombre' },
                { key: 'iso_code', label: 'ISO' },
                ...(canWrite ? [{ key: 'actions', label: 'Acciones' }] : []),
              ]}
              rows={
                countriesRows as unknown as Record<
                  string,
                  string | number | boolean | null | undefined
                >[]
              }
              renderCell={(row, key, rowIndex) => {
                if (key !== 'actions') return undefined
                const source = countriesRows[rowIndex]
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
                        <DropdownMenuItem onClick={() => setEditingCountry(source)}>
                          <Edit />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={deletingId === source.id}
                          onClick={() => setDeleteCountry(source)}
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
            <GeoPaginationBar
              page={countriesPage}
              total={countriesCount}
              pageSize={GEO_PAGE_SIZE}
              loading={loadingCountries || loadingBootstrap}
              onPageChange={setCountriesPage}
            />
          </div>
        </>
      ) : null}

      {tab === 'provinces' ? (
        <>
          <div>
            <EntityTable
              belowTitleContent={
                <div className="flex flex-wrap items-end gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="filtro-prov-pais">Filtrar por país</Label>
                    <select
                      id="filtro-prov-pais"
                      className={inputClassName}
                      value={filterProvinceCountry}
                      onChange={(e) => setFilterProvinceCountry(e.target.value)}
                    >
                      <option value="">Todos</option>
                      {countryOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid min-w-[12rem] max-w-md flex-1 gap-2">
                    <Label htmlFor="search-province">Buscar por nombre</Label>
                    <input
                      id="search-province"
                      type="search"
                      value={searchProvinceInput}
                      onChange={(e) => setSearchProvinceInput(e.target.value)}
                      placeholder="Filtrar provincias…"
                      autoComplete="off"
                      className={inputClassName}
                    />
                  </div>
                </div>
              }
              loading={loadingProvinces || loadingBootstrap}
              error={errorProvinces}
              headerActions={
                canWrite ? (
                  <StaffCreateDialog
                    title="Nueva provincia"
                    description="Agregar una provincia al listado."
                    triggerLabel="Nueva provincia"
                    triggerWrapperClassName="shrink-0"
                  >
                    {({ close }) => (
                      <form
                        onSubmit={(e) => onCreateProvince(e, close)}
                        className="grid max-w-md gap-4"
                      >
                        <div className="grid gap-2">
                          <Label htmlFor="p-country">País</Label>
                          <select
                            id="p-country"
                            name="country"
                            required
                            defaultValue={filterProvinceCountry}
                            className={inputClassName}
                          >
                            <option value="" disabled>
                              Elegir…
                            </option>
                            {countryOptions.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="p-name">Nombre</Label>
                          <input id="p-name" name="name" required className={inputClassName} />
                        </div>
                        {createErr ? (
                          <p className="text-sm text-destructive" role="alert">
                            {createErr}
                          </p>
                        ) : null}
                        <Button type="submit" disabled={creating || !canWrite}>
                          {creating ? 'Creando…' : 'Crear'}
                        </Button>
                      </form>
                    )}
                  </StaffCreateDialog>
                ) : undefined
              }
              columns={[
                { key: 'country_name', label: 'País' },
                { key: 'name', label: 'Nombre' },
                ...(canWrite ? [{ key: 'actions', label: 'Acciones' }] : []),
              ]}
              rows={
                provincesRows as unknown as Record<
                  string,
                  string | number | boolean | null | undefined
                >[]
              }
              renderCell={(row, key, rowIndex) => {
                if (key !== 'actions') return undefined
                const source = provincesRows[rowIndex]
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
                        <DropdownMenuItem onClick={() => setEditingProvince(source)}>
                          <Edit />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={deletingId === source.id}
                          onClick={() => setDeleteProvince(source)}
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
            <GeoPaginationBar
              page={provincesPage}
              total={provincesCount}
              pageSize={GEO_PAGE_SIZE}
              loading={loadingProvinces || loadingBootstrap}
              onPageChange={setProvincesPage}
            />
          </div>
        </>
      ) : null}

      {tab === 'cities' ? (
        <>
          <div>
            <EntityTable
              belowTitleContent={
                <div className="flex flex-wrap items-end gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="filtro-city-pais">Filtrar por país</Label>
                    <select
                      id="filtro-city-pais"
                      className={inputClassName}
                      value={filterCityCountry}
                      onChange={(e) => {
                        setFilterCityCountry(e.target.value)
                        setFilterCityProvince('')
                      }}
                    >
                      <option value="">Todos</option>
                      {countryOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="filtro-city-prov">Filtrar por provincia</Label>
                    <select
                      id="filtro-city-prov"
                      className={inputClassName}
                      value={filterCityProvince}
                      onChange={(e) => setFilterCityProvince(e.target.value)}
                    >
                      <option value="">Todas</option>
                      {provincesForCityFilter.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.country_name ? `${p.name} (${p.country_name})` : p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid min-w-[12rem] max-w-md flex-1 gap-2">
                    <Label htmlFor="search-city">Buscar por nombre</Label>
                    <input
                      id="search-city"
                      type="search"
                      value={searchCityInput}
                      onChange={(e) => setSearchCityInput(e.target.value)}
                      placeholder="Filtrar ciudades…"
                      autoComplete="off"
                      className={inputClassName}
                    />
                  </div>
                </div>
              }
              loading={loadingCities || loadingBootstrap}
              error={errorCities}
              headerActions={
                canWrite ? (
                  <StaffCreateDialog
                    title="Nueva ciudad"
                    description="Agregar una ciudad al listado."
                    triggerLabel="Nueva ciudad"
                    triggerWrapperClassName="shrink-0"
                  >
                    {({ close }) => (
                      <form
                        onSubmit={(e) => onCreateCity(e, close)}
                        className="grid max-w-md gap-4"
                      >
                        <div className="grid gap-2">
                          <Label htmlFor="ci-province">Provincia</Label>
                          <select id="ci-province" name="province" required className={inputClassName}>
                            <option value="" disabled>
                              Elegir…
                            </option>
                            {provincesCatalog.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.country_name ? `${p.name} (${p.country_name})` : p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="ci-name">Nombre</Label>
                          <input id="ci-name" name="name" required className={inputClassName} />
                        </div>
                        {createErr ? (
                          <p className="text-sm text-destructive" role="alert">
                            {createErr}
                          </p>
                        ) : null}
                        <Button type="submit" disabled={creating || !canWrite}>
                          {creating ? 'Creando…' : 'Crear'}
                        </Button>
                      </form>
                    )}
                  </StaffCreateDialog>
                ) : undefined
              }
              columns={[
                { key: 'country_id', label: 'País' },
                { key: 'province_name', label: 'Provincia' },
                { key: 'name', label: 'Nombre' },
                ...(canWrite ? [{ key: 'actions', label: 'Acciones' }] : []),
              ]}
              rows={
                citiesRows as unknown as Record<
                  string,
                  string | number | boolean | null | undefined
                >[]
              }
              renderCell={(row, key, rowIndex) => {
                if (key === 'country_id') {
                  const id = row.country_id as string | undefined
                  const label = countryOptions.find((c) => c.id === id)?.name
                  return label ?? id ?? '—'
                }
                if (key !== 'actions') return undefined
                const source = citiesRows[rowIndex]
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
                        <DropdownMenuItem onClick={() => setEditingCity(source)}>
                          <Edit />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={deletingId === source.id}
                          onClick={() => setDeleteCity(source)}
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
            <GeoPaginationBar
              page={citiesPage}
              total={citiesCount}
              pageSize={GEO_PAGE_SIZE}
              loading={loadingCities || loadingBootstrap}
              onPageChange={setCitiesPage}
            />
          </div>
        </>
      ) : null}

      <Dialog
        open={Boolean(deleteCountry)}
        onOpenChange={(open) => !open && setDeleteCountry(null)}
      >
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar país</DialogTitle>
            <DialogDescription>
              Se borrarán también las provincias y ciudades vinculadas. ¿Eliminar{' '}
              <strong>{deleteCountry?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteCountry(null)}
              disabled={deletingId === deleteCountry?.id}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDeleteCountry}
              disabled={deletingId === deleteCountry?.id}
            >
              {deletingId === deleteCountry?.id ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteProvince)}
        onOpenChange={(open) => !open && setDeleteProvince(null)}
      >
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar provincia</DialogTitle>
            <DialogDescription>
              Se borrarán las ciudades de esta provincia. ¿Eliminar{' '}
              <strong>{deleteProvince?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteProvince(null)}
              disabled={deletingId === deleteProvince?.id}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDeleteProvince}
              disabled={deletingId === deleteProvince?.id}
            >
              {deletingId === deleteProvince?.id ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteCity)} onOpenChange={(open) => !open && setDeleteCity(null)}>
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar ciudad</DialogTitle>
            <DialogDescription>
              ¿Eliminar <strong>{deleteCity?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteCity(null)}
              disabled={deletingId === deleteCity?.id}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDeleteCity}
              disabled={deletingId === deleteCity?.id}
            >
              {deletingId === deleteCity?.id ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingCountry)}
        onOpenChange={(open) => !open && setEditingCountry(null)}
      >
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar país</DialogTitle>
            <DialogDescription>Modificá los datos del país.</DialogDescription>
          </DialogHeader>
          {editingCountry ? (
            <form onSubmit={onEditCountry} className="grid max-w-md gap-4">
              <div className="grid gap-2">
                <Label htmlFor="ec-name">Nombre</Label>
                <input
                  id="ec-name"
                  name="name"
                  required
                  defaultValue={editingCountry.name}
                  className={inputClassName}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ec-iso">ISO (opcional)</Label>
                <input
                  id="ec-iso"
                  name="iso_code"
                  maxLength={2}
                  defaultValue={editingCountry.iso_code ?? ''}
                  className={inputClassName}
                />
              </div>
              {editErr ? (
                <p className="text-sm text-destructive" role="alert">
                  {editErr}
                </p>
              ) : null}
              <Button type="submit" disabled={updating}>
                {updating ? 'Guardando…' : 'Guardar'}
              </Button>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingProvince)}
        onOpenChange={(open) => !open && setEditingProvince(null)}
      >
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar provincia</DialogTitle>
            <DialogDescription>Modificá país o nombre de la provincia.</DialogDescription>
          </DialogHeader>
          {editingProvince ? (
            <form onSubmit={onEditProvince} className="grid max-w-md gap-4">
              <div className="grid gap-2">
                <Label htmlFor="ep-country">País</Label>
                <select
                  id="ep-country"
                  name="country"
                  required
                  defaultValue={editingProvince.country}
                  className={inputClassName}
                >
                  {countryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ep-name">Nombre</Label>
                <input
                  id="ep-name"
                  name="name"
                  required
                  defaultValue={editingProvince.name}
                  className={inputClassName}
                />
              </div>
              {editErr ? (
                <p className="text-sm text-destructive" role="alert">
                  {editErr}
                </p>
              ) : null}
              <Button type="submit" disabled={updating}>
                {updating ? 'Guardando…' : 'Guardar'}
              </Button>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingCity)} onOpenChange={(open) => !open && setEditingCity(null)}>
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar ciudad</DialogTitle>
            <DialogDescription>Modificá provincia o nombre de la ciudad.</DialogDescription>
          </DialogHeader>
          {editingCity ? (
            <form onSubmit={onEditCity} className="grid max-w-md gap-4">
              <div className="grid gap-2">
                <Label htmlFor="eci-province">Provincia</Label>
                <select
                  id="eci-province"
                  name="province"
                  required
                  defaultValue={editingCity.province}
                  className={inputClassName}
                >
                  {provincesCatalog.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.country_name ? `${p.name} (${p.country_name})` : p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="eci-name">Nombre</Label>
                <input
                  id="eci-name"
                  name="name"
                  required
                  defaultValue={editingCity.name}
                  className={inputClassName}
                />
              </div>
              {editErr ? (
                <p className="text-sm text-destructive" role="alert">
                  {editErr}
                </p>
              ) : null}
              <Button type="submit" disabled={updating}>
                {updating ? 'Guardando…' : 'Guardar'}
              </Button>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
