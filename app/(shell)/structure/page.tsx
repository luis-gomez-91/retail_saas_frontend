'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { apiFetch, parseListPayload, ApiError } from '@/lib/api/client'
import type { Branch, Company, Organization } from '@/lib/types/api'
import { cn } from '@/lib/utils'

function sortByNombre<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export default function EstructuraPage() {
  const [empresas, setEmpresas] = useState<Company[]>([])
  const [organizaciones, setOrganizaciones] = useState<Organization[]>([])
  const [sucursales, setSucursales] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [e, o, s] = await Promise.all([
          apiFetch<unknown>('/api/companies/'),
          apiFetch<unknown>('/api/organizations/'),
          apiFetch<unknown>('/api/branches/'),
        ])
        if (cancelled) return
        setEmpresas(sortByNombre(parseListPayload<Company>(e)))
        setOrganizaciones(parseListPayload<Organization>(o))
        setSucursales(parseListPayload<Branch>(s))
        setError(null)
      } catch (err) {
        if (cancelled) return
        setEmpresas([])
        setOrganizaciones([])
        setSucursales([])
        setError(
          err instanceof ApiError ? err.message : 'Error al cargar la estructura.'
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const { orgsByEmpresa, sucursalesByOrg } = useMemo(() => {
    const orgsByEmpresa = new Map<string, Organization[]>()
    for (const o of organizaciones) {
      const list = orgsByEmpresa.get(o.company) ?? []
      list.push(o)
      orgsByEmpresa.set(o.company, list)
    }
    for (const [, list] of orgsByEmpresa) {
      list.sort((a, b) => a.name.localeCompare(b.name, 'es'))
    }
    const sucursalesByOrg = new Map<string, Branch[]>()
    for (const s of sucursales) {
      const list = sucursalesByOrg.get(s.organization) ?? []
      list.push(s)
      sucursalesByOrg.set(s.organization, list)
    }
    for (const [, list] of sucursalesByOrg) {
      list.sort((a, b) => a.name.localeCompare(b.name, 'es'))
    }
    return { orgsByEmpresa, sucursalesByOrg }
  }, [organizaciones, sucursales])

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm">
        <div className="p-4">
          {loading ? (
            <p className="px-2 py-10 text-center text-muted-foreground">
              Cargando…
            </p>
          ) : error ? (
            <p className="px-2 py-10 text-center text-destructive" role="alert">
              {error}
            </p>
          ) : empresas.length === 0 ? (
            <p className="px-2 py-10 text-center text-muted-foreground">
              No hay empresas visibles para tu usuario.
            </p>
          ) : (
            <ul className="space-y-2">
              {empresas.map((emp) => {
                const orgs = orgsByEmpresa.get(emp.id) ?? []
                return (
                  <li key={emp.id}>
                    <details
                      className="group rounded-lg border border-border/80 bg-muted/20 open:bg-muted/30"
                      open={empresas.length <= 3}
                    >
                      <summary
                        className={cn(
                          'flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-medium text-foreground',
                          'marker:content-none [&::-webkit-details-marker]:hidden'
                        )}
                      >
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                        <span className="min-w-0 truncate">
                          <span className="text-muted-foreground">Empresa</span>{' '}
                          <span className="text-foreground">{emp.name}</span>
                          <span className="ml-2 font-normal text-muted-foreground">
                            ({emp.slug})
                          </span>
                        </span>
                      </summary>
                      <div className="border-t border-border/60 px-3 pb-3 pl-9 pt-2">
                        {orgs.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Sin organizaciones.
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {orgs.map((org) => {
                              const sucs = sucursalesByOrg.get(org.id) ?? []
                              return (
                                <li key={org.id}>
                                  <details className="group rounded-md border border-border/60 bg-background open:shadow-sm">
                                    <summary
                                      className={cn(
                                        'flex cursor-pointer list-none items-center gap-2 px-2.5 py-2 text-sm',
                                        'marker:content-none [&::-webkit-details-marker]:hidden'
                                      )}
                                    >
                                      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                                      <span className="min-w-0 truncate">
                                        <span className="text-muted-foreground">
                                          Organización
                                        </span>{' '}
                                        <span className="font-medium text-foreground">
                                          {org.name}
                                        </span>
                                      </span>
                                    </summary>
                                    <div className="border-t border-border/50 px-2.5 pb-2 pl-8 pt-1.5">
                                      {sucs.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                          Sin sucursales.
                                        </p>
                                      ) : (
                                        <ul className="space-y-1">
                                          {sucs.map((s) => (
                                            <li
                                              key={s.id}
                                              className="flex items-center gap-2 text-sm"
                                            >
                                              <span className="text-muted-foreground">
                                                Sucursal
                                              </span>
                                              <span className="font-medium text-foreground">
                                                {s.name}
                                              </span>
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </div>
                                  </details>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>
                    </details>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
