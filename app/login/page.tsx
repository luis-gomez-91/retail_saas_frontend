'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { ApiError, loginRequest } from '@/lib/api/client'
import { getAccessToken, setTokens } from '@/lib/auth/storage'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next') ?? '/dashboard'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (getAccessToken()) router.replace('/dashboard')
  }, [router])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const tokens = await loginRequest(username, password)
      setTokens(tokens.access, tokens.refresh)
      router.replace(nextPath.startsWith('/') ? nextPath : '/dashboard')
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudo iniciar sesión. Revisa usuario y contraseña.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Retail SaaS</h1>
        <p className="mt-2 text-sm text-slate-600">
          Inicia sesión con las credenciales del backend (JWT). Desarrollo:{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">admin</code>{' '}
          /{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">admin</code>{' '}
          tras <code className="text-xs">bootstrap_dev</code>.
        </p>

        <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
          <div>
            <label htmlFor="username" className="text-sm font-medium text-slate-700">
              Usuario
            </label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium text-slate-700">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {submitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Backend:{' '}
          <a
            className="text-blue-600 underline"
            href="https://github.com/luis-gomez-91/retail_saas_backend"
            target="_blank"
            rel="noreferrer"
          >
            retail_saas_backend
          </a>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">
          Cargando…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
