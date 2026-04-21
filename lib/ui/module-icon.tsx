import type { LucideIcon } from 'lucide-react'
import { Box, Circle, Shield } from 'lucide-react'
import * as Icons from 'lucide-react'

/**
 * Icono Lucide (nombre de export) por `code` de módulo (`Module.code`).
 * Primera opción de cada lista acordada (box, credit-card, shield, …).
 */
export const MODULE_ICON_BY_CODE: Record<string, string> = {
  'dashboard-superuser': 'ShieldCheck',
  'dashboard-admin': 'LayoutPanelTop',
  'dashboard-employees': 'Gauge',
  'identification-types': 'IdCard',
  geography: 'Globe2',
  modules: 'Box',
  plans: 'CreditCard',
  roles: 'Shield',
  companies: 'Building',
  branches: 'Store',
  organizations: 'Network',
  structure: 'FolderTree',
  subscriptions: 'Repeat',
  staff: 'UserPlus',
  'auth-providers': 'KeyRound',
  'billing-auth-providers': 'KeySquare',
  'auth-providers-catalog': 'KeyRound',
  'company-roles': 'Building2',
}

/**
 * Icono Lucide (nombre de export) por `Role.code`.
 * Incluye perfiles sintéticos (`superuser`, `admin`) usados en `/api/users/me/`.
 */
export const ROLE_ICON_BY_CODE: Record<string, string> = {
  superuser: 'ShieldCheck',
  admin: 'KeyRound',
  'admin-empresa': 'Building2',
  supervisor: 'Shield',
  vendedor: 'BadgeDollarSign',
  cajero: 'HandCoins',
}

type ModuleIconProps = {
  /** Clave desde API (`icono`), usada si no hay entrada en `MODULE_ICON_BY_CODIGO`. */
  name: string
  /** `Module.code` — si coincide, prevalece el icono del mapa. */
  code?: string
  className?: string
}

function resolveIconName(name: string, code?: string): string {
  if (code && MODULE_ICON_BY_CODE[code]) {
    return MODULE_ICON_BY_CODE[code]
  }
  return name?.trim() ?? ''
}

function resolveRoleIconName(name: string, code?: string): string {
  if (code && ROLE_ICON_BY_CODE[code]) {
    return ROLE_ICON_BY_CODE[code]
  }
  return name?.trim() ?? ''
}

/**
 * Renderiza un icono Lucide a partir de `code` (mapa) o de la clave del backend (`name`).
 */
export function ModuleIcon({ name, code, className }: ModuleIconProps) {
  const key = resolveIconName(name, code)
  if (!key) {
    return <Circle className={className} aria-hidden />
  }
  const Icon = (Icons as unknown as Record<string, LucideIcon | undefined>)[key]
  if (!Icon) {
    return <Box className={className} aria-hidden />
  }
  return <Icon className={className} aria-hidden />
}

type RoleIconProps = {
  name: string
  code?: string
  className?: string
}

/**
 * Renderiza un icono Lucide a partir de `Role.code` (mapa) o `role.icon` (backend).
 */
export function RoleIcon({ name, code, className }: RoleIconProps) {
  const key = resolveRoleIconName(name, code)
  if (!key) {
    return <Shield className={className} aria-hidden />
  }
  const Icon = (Icons as unknown as Record<string, LucideIcon | undefined>)[key]
  if (!Icon) {
    return <Shield className={className} aria-hidden />
  }
  return <Icon className={className} aria-hidden />
}
