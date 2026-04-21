import type { MeUser } from '@/lib/types/api'

/**
 * La API actual documenta escritura (POST/PUT/PATCH/DELETE) en la mayoría de
 * recursos solo para `is_staff` (salvo reglas puntuales, p. ej. Person propia).
 */
export function canWriteStaffScopedApi(me: MeUser | null): boolean {
  return Boolean(me?.is_staff || me?.is_superuser || me?.is_admin)
}

/** Alta de personas con rol (módulo `staff`): solo admin tenant o superusuario. */
export function canProvisionPersonas(me: MeUser | null): boolean {
  return Boolean(me?.is_superuser || me?.is_admin)
}
