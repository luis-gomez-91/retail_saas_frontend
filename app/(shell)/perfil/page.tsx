'use client'

import { useEffect, useState } from 'react'
import { apiFetch, parseListPayload, ApiError } from '@/lib/api/client'
import type { MeUser, Person } from '@/lib/types/api'

export default function PerfilPage() {
  const [me, setMe] = useState<MeUser | null>(null)
  const [persons, setPersons] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [user, plist] = await Promise.all([
          apiFetch<MeUser>('/api/users/me/'),
          apiFetch<unknown>('/api/persons/'),
        ])
        if (!cancelled) {
          setMe(user)
          setPersons(parseListPayload<Person>(plist))
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setMe(null)
          setPersons([])
          setError(e instanceof ApiError ? e.message : 'Error al cargar perfil.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const person = persons.find((p) => p.user === me?.id) ?? persons[0]

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">
        Cargando perfil…
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        {error}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Usuario</h1>
        <p className="mt-1 text-sm text-slate-500">GET /api/users/me/</p>
        {me ? (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">ID</dt>
              <dd className="font-medium text-slate-900">{me.id}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Usuario</dt>
              <dd className="font-medium text-slate-900">{me.username}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Staff</dt>
              <dd className="text-slate-900">{me.is_staff ? 'Sí' : 'No'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Superusuario</dt>
              <dd className="text-slate-900">{me.is_superuser ? 'Sí' : 'No'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Alta</dt>
              <dd className="text-slate-900">{me.date_joined}</dd>
            </div>
          </dl>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Persona</h2>
        <p className="mt-1 text-sm text-slate-500">
          GET /api/persons/ — sin staff solo ves tu fila; puedes editar la tuya con PATCH según el
          backend.
        </p>
        {person ? (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Nombre</dt>
              <dd className="text-slate-900">{person.name}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Apellidos</dt>
              <dd className="text-slate-900">
                {[person.last_name, person.second_last_name].filter(Boolean).join(' ')}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Email personal</dt>
              <dd className="text-slate-900">{person.personal_email || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Teléfono</dt>
              <dd className="text-slate-900">{person.phone || '—'}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            No hay registro de persona asociado a tu usuario en el listado actual.
          </p>
        )}
      </div>
    </div>
  )
}
