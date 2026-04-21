'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { apiFetch, parseListPayload, ApiError } from '@/lib/api/client'
import type {
  BillingAccount,
  Branch,
  Company,
  Organization,
  Subscription,
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
          apiFetch<unknown>('/api/companies/'),
          apiFetch<unknown>('/api/organizations/'),
          apiFetch<unknown>('/api/branches/'),
          apiFetch<unknown>('/api/subscriptions/'),
          apiFetch<unknown>('/api/billing-accounts/'),
        ])
        if (cancelled) return
        setStats({
          empresas: parseListPayload<Company>(empresas).length,
          organizaciones: parseListPayload<Organization>(orgs).length,
          sucursales: parseListPayload<Branch>(sucursales).length,
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
          label: 'Estructura (emp. · org. · suc.)',
          value: `${stats.empresas} · ${stats.organizaciones} · ${stats.sucursales}`,
          href: '/structures',
        },
        { label: 'Suscripciones', value: stats.suscripciones, href: '/subscriptions' },
        { label: 'Cuentas de facturación', value: stats.cuentas, href: '/billing' },
      ]
    : []

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {error ? (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {!stats && !error
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
            ))
          : cards.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm transition-shadow hover:border-border hover:shadow-md"
              >
                <p className="text-sm font-medium text-muted-foreground">{c.label}</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
                  {c.value}
                </p>
              </Link>
            ))}
      </div>
    </div>
  )
}
