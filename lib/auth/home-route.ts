import type { MeMenuModule, MeModuleGroup, MeUser } from '@/lib/types/api'

const ALWAYS_ALLOWED_ROUTES = ['/', '/profile', '/perfil']

/** La API DRF expone `ruta`; el cliente normalizado usa `route`. */
function moduleRouteFromPayload(m: {
  route?: string
  ruta?: string
}): string {
  const raw = (m.route ?? m.ruta ?? '').trim()
  return raw
}

function normalizePath(path: string | undefined | null): string {
  const raw = String(path ?? '').trim()
  if (!raw) return ''
  const noHash = raw.split('#')[0] ?? raw
  const noQuery = noHash.split('?')[0] ?? noHash
  if (!noQuery.startsWith('/')) return `/${noQuery}`
  return noQuery
}

function isUsableRoute(path: string): boolean {
  const normalized = normalizePath(path)
  return normalized.length > 1
}

function modulesFromGroups(groups: MeModuleGroup[] | undefined): MeMenuModule[] {
  if (!Array.isArray(groups) || groups.length === 0) return []
  return groups.flatMap((group) => group.modules ?? [])
}

export function getAllowedRoutes(me: MeUser | null | undefined): string[] {
  if (!me) return [...ALWAYS_ALLOWED_ROUTES]
  const groupModules = modulesFromGroups(me.modules_by_profile)
  const source = groupModules.length > 0 ? groupModules : (me.modules ?? [])
  const routes = source
    .map((m) => normalizePath(moduleRouteFromPayload(m)))
    .filter(isUsableRoute)
  return Array.from(new Set([...ALWAYS_ALLOWED_ROUTES, ...routes]))
}

function preferredRoutesForUser(me: MeUser): string[] {
  const preferred: string[] = []
  if (me.is_superuser) {
    preferred.push('/dashboard-superuser', '/dashboards', '/dashboard', '/modules', '/geography')
  }
  if (me.is_admin) {
    preferred.push('/dashboard-admin', '/dashboards', '/dashboard', '/companies', '/subscriptions')
  }
  preferred.push('/dashboard-employees', '/dashboards', '/dashboard', '/sales', '/products', '/reports')
  preferred.push('/', '/profile')
  return preferred
}

export function resolveHomeRoute(me: MeUser | null | undefined): string {
  const allowed = getAllowedRoutes(me)
  if (!me) return '/'
  const allowedSet = new Set(allowed)
  const dashboardRoutes = allowed.filter((route) => route.startsWith('/dashboard'))
  for (const route of dashboardRoutes) {
    if (allowedSet.has(route)) return route
  }
  for (const route of preferredRoutesForUser(me)) {
    if (allowedSet.has(route)) return route
  }
  return allowed[0] ?? '/'
}

export function isRouteAllowedPath(pathname: string, allowedRoutes: string[]): boolean {
  const target = normalizePath(pathname)
  if (!target) return false
  const allowed = new Set(allowedRoutes.map(normalizePath))
  if (allowed.has(target)) return true
  for (const route of allowed) {
    if (route !== '/' && target.startsWith(`${route}/`)) return true
  }
  return false
}
