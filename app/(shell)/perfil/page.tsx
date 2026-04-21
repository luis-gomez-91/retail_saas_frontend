'use client'

import { useEffect, useState } from 'react'
import { useMe } from '@/components/me-provider'
import { apiFetch, parseListPayload, ApiError } from '@/lib/api/client'
import type { Person } from '@/lib/types/api'
import { formatBooleanLabel } from '@/lib/ui/format-boolean'
import { formatDisplayDateTime } from '@/lib/ui/format-datetime'

export default function PerfilPage() {
  const { me, loading: meLoading } = useMe()
  const [persons, setPersons] = useState<Person[]>([])
  const [loadingPersons, setLoadingPersons] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (meLoading) return
    let cancelled = false
    ;(async () => {
      try {
        const plist = await apiFetch<unknown>('/api/persons/')
        if (!cancelled) {
          setPersons(parseListPayload<Person>(plist))
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setPersons([])
          setError(e instanceof ApiError ? e.message : 'Error al cargar perfil.')
        }
      } finally {
        if (!cancelled) setLoadingPersons(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [meLoading])

  const loading = meLoading || loadingPersons
  const person = persons.find((p) => p.user === me?.id) ?? persons[0]

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-8 text-muted-foreground shadow-sm">
        Cargando perfil…
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="mx-auto max-w-2xl rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive"
        role="alert"
      >
        {error}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">Usuario</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Datos de acceso a la aplicación.
        </p>
        {me ? (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">ID</dt>
              <dd className="font-medium text-foreground">{me.id}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Usuario</dt>
              <dd className="font-medium text-foreground">{me.username}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Staff</dt>
              <dd className="text-foreground">{formatBooleanLabel(me.is_staff)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Superusuario</dt>
              <dd className="text-foreground">{formatBooleanLabel(me.is_superuser)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Administrador (operador)</dt>
              <dd className="text-foreground">{formatBooleanLabel(me.is_admin)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Alta</dt>
              <dd className="text-foreground">
                {formatDisplayDateTime(me.date_joined)}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            No se pudo cargar el usuario actual.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h2 className="text-xl font-semibold text-foreground">Persona</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tus datos personales asociados a la cuenta.
        </p>
        {person ? (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Nombre</dt>
              <dd className="text-foreground">{person.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Apellidos</dt>
              <dd className="text-foreground">
                {[person.last_name, person.second_last_name].filter(Boolean).join(' ')}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Email personal</dt>
              <dd className="text-foreground">{person.personal_email || '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Teléfono</dt>
              <dd className="text-foreground">{person.phone || '—'}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            No hay registro de persona asociado a tu usuario en el listado actual.
          </p>
        )}
      </div>
    </div>
  )
}
