'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { apiFetch, parseListPayload, ApiError } from '@/lib/api/client'
import type {
  BillingAccount,
  Empresa,
  Organizacion,
  Subscription,
  Sucursal,
} from '@/lib/types/api'

export default function DashboardPage() {
  const [stats, setStats] = useState<{
    empresas: number
    organizaciones: number
    sucursales: number
    suscripciones: number
    cuentas: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [empresas, orgs, sucursales, subs, cuentas] = await Promise.all([
          apiFetch<unknown>('/api/empresas/'),
          apiFetch<unknown>('/api/organizaciones/'),
          apiFetch<unknown>('/api/sucursales/'),
          apiFetch<unknown>('/api/subscriptions/'),
          apiFetch<unknown>('/api/billing-accounts/'),
        ])
        if (cancelled) return
        setStats({
          empresas: parseListPayload<Empresa>(empresas).length,
          organizaciones: parseListPayload<Organizacion>(orgs).length,
          sucursales: parseListPayload<Sucursal>(sucursales).length,
          suscripciones: parseListPayload<Subscription>(subs).length,
          cuentas: parseListPayload<BillingAccount>(cuentas).length,
        })
        setError(null)
      } catch (e) {
        if (cancelled) return
        setStats(null)
        setError(e instanceof ApiError ? e.message : 'No se pudieron cargar los datos.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const cards = stats
    ? [
        {
          label: 'Empresas',
          value: stats.empresas,
          href: '/empresas',
        },
        {
          label: 'Organizaciones',
          value: stats.organizaciones,
          href: '/organizaciones',
        },
        {
          label: 'Sucursales',
          value: stats.sucursales,
          href: '/sucursales',
        },
        {
          label: 'Suscripciones',
          value: stats.suscripciones,
          href: '/suscripciones',
        },
        {
          label: 'Cuentas de facturación',
          value: stats.cuentas,
          href: '/facturacion',
        },
      ]
    : []

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Resumen</h1>
        <p className="mt-1 text-slate-600">
          Conteos según tu usuario (sin <code className="text-sm">is_staff</code> los listados
          vienen filtrados por membresías a empresas, como en el backend).
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {!stats && !error
          ? Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-xl bg-slate-200/80"
              />
            ))
          : cards.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <p className="text-sm font-medium text-slate-500">{c.label}</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">
                  {c.value}
                </p>
              </Link>
            ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Documentación API</h2>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-600">
          <li>
            Esquema OpenAPI en el servidor:{' '}
            <code className="rounded bg-slate-100 px-1">/api/schema/</code>, Swagger:{' '}
            <code className="rounded bg-slate-100 px-1">/api/docs/</code>
          </li>
          <li>
            Convenciones y JWT descritos en el repo del backend (
            <code className="text-xs">docs/API.md</code>).
          </li>
        </ul>
      </div>
    </div>
  )
}
