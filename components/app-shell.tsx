'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { clearTokens } from '@/lib/auth/storage'
import { apiFetch } from '@/lib/api/client'
import type { MeUser } from '@/lib/types/api'

const nav = [
  { href: '/dashboard', label: 'Inicio' },
  { href: '/empresas', label: 'Empresas' },
  { href: '/organizaciones', label: 'Organizaciones' },
  { href: '/sucursales', label: 'Sucursales' },
  { href: '/facturacion', label: 'Facturación' },
  { href: '/suscripciones', label: 'Suscripciones' },
  { href: '/planes', label: 'Planes' },
  { href: '/perfil', label: 'Perfil' },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [me, setMe] = useState<MeUser | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const user = await apiFetch<MeUser>('/api/users/me/')
        if (!cancelled) setMe(user)
      } catch {
        if (!cancelled) setMe(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pathname])

  function logout() {
    clearTokens()
    router.replace('/login')
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white md:block">
        <div className="border-b border-slate-100 px-4 py-5">
          <Link href="/dashboard" className="text-lg font-semibold text-slate-900">
            Retail SaaS
          </Link>
          <p className="mt-1 text-xs text-slate-500">Panel · Next.js + DRF</p>
        </div>
        <nav className="flex flex-col gap-0.5 p-2">
          {nav.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:px-8">
          <div className="flex flex-1 items-center gap-4 md:hidden">
            <select
              className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              value={pathname}
              onChange={(e) => router.push(e.target.value)}
              aria-label="Navegación"
            >
              {nav.map((item) => (
                <option key={item.href} value={item.href}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="hidden text-sm text-slate-600 md:block">
            API documentada en{' '}
            <a
              className="text-blue-600 underline"
              href="https://github.com/luis-gomez-91/retail_saas_backend/blob/main/docs/API.md"
              target="_blank"
              rel="noreferrer"
            >
              docs/API.md
            </a>
          </div>
          <div className="flex items-center gap-3">
            {me ? (
              <span className="hidden text-sm text-slate-800 sm:inline">
                <span className="font-medium">{me.username}</span>
                {me.is_staff ? (
                  <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                    staff
                  </span>
                ) : null}
              </span>
            ) : null}
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Salir
            </button>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  )
}
