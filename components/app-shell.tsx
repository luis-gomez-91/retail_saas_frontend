'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Building2,
  ChevronDown,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Paintbrush,
  Sun,
  User,
  X,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { clearTokens } from '@/lib/auth/storage'
import {
  getAllowedRoutes,
  isRouteAllowedPath,
  resolveHomeRoute,
} from '@/lib/auth/home-route'
import { useMe } from '@/components/me-provider'
import { ModuleIcon, RoleIcon } from '@/lib/ui/module-icon'
import type { MeMenuModule, MeModuleGroup, MeUser } from '@/lib/types/api'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const VISITED_MODULES_STORAGE_KEY = 'retail_saas_visited_modules'
const MAX_VISITED_MODULES = 10

type VisitedModule = {
  route: string
  name: string
  code: string
  icon: string
}

function initialsFromUsername(username: string): string {
  const parts = username.split(/[.\s_-]+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return username.slice(0, 2).toUpperCase()
}

function initialsFromMe(me: MeUser | null | undefined): string {
  const p = me?.person
  if (p) {
    const n = p.name?.trim()
    const ln = p.last_name?.trim()
    if (n && ln) return (n[0] + ln[0]).toUpperCase()
    if (n) return n.slice(0, 2).toUpperCase()
    if (ln) return ln.slice(0, 2).toUpperCase()
  }
  if (me?.username) return initialsFromUsername(me.username)
  return '·'
}

/** Línea principal: nombre + primer apellido; si no hay persona, el usuario. */
function avatarMenuHeading(me: MeUser | null | undefined): {
  primary: string
  showUsernameBelow: boolean
} {
  if (!me) return { primary: 'Usuario', showUsernameBelow: false }
  const p = me.person
  if (p) {
    const parts = [p.name?.trim(), p.last_name?.trim()].filter(Boolean)
    if (parts.length > 0) {
      return { primary: parts.join(' '), showUsernameBelow: true }
    }
  }
  return { primary: me.username, showUsernameBelow: false }
}

/**
 * Lista plana de módulos para fallback cuando `modules_by_profile` viene vacío.
 * Superusuario: solo entradas `use_superuser` (admin va en su grupo vía API si aplica).
 */
function modulosParaSidebar(
  modulos: MeMenuModule[] | undefined,
  isSuperuser: boolean | undefined
): MeMenuModule[] {
  const list = modulos ?? []
  if (isSuperuser) {
    return list.filter((m) => m.use_superuser)
  }
  return list
}

function gruposParaSidebar(me: {
  modules?: MeMenuModule[]
  modules_by_profile?: MeModuleGroup[]
  is_superuser?: boolean
} | null): MeModuleGroup[] {
  if (!me) return []

  // La API ya arma grupos (Superuser, Administrador, roles). Si solo tratábamos
  // `is_superuser` aquí, un superuser+admin perdía el desplegable de administrador.
  if (Array.isArray(me.modules_by_profile) && me.modules_by_profile.length > 0) {
    const filtered = me.modules_by_profile
      .map((group) => ({
        ...group,
        modules: group.modules.filter((m) => Boolean(m.route)),
      }))
      .filter((group) => group.modules.length > 0)
    if (filtered.length > 0) {
      return filtered
    }
  }

  const fallback = modulosParaSidebar(me.modules, me.is_superuser).filter((m) =>
    Boolean(m.route)
  )
  if (!fallback.length) return []
  const label = me.is_superuser ? 'Superuser' : 'Módulos'
  const key = me.is_superuser ? 'superuser' : 'default'
  return [{ key, label, modules: fallback }]
}

function SidebarNavPanel({
  gruposSidebar,
  openGroups,
  setOpenGroups,
  pathname,
  loading,
  activeCompany,
  multiCompany,
  onNavigate,
  headerRight,
  beforeFooter,
}: {
  gruposSidebar: MeModuleGroup[]
  openGroups: Record<string, boolean>
  setOpenGroups: Dispatch<SetStateAction<Record<string, boolean>>>
  pathname: string
  loading: boolean
  activeCompany: { id: string; name: string } | null
  multiCompany: boolean
  onNavigate?: () => void
  headerRight?: ReactNode
  beforeFooter?: ReactNode
}) {
  return (
    <>
      {headerRight ? (
        <div className="flex justify-end border-b border-border px-5 py-3">
          <div className="shrink-0">{headerRight}</div>
        </div>
      ) : null}

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        {loading ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            Cargando menú…
          </p>
        ) : null}

        {gruposSidebar.length ? (
          <div className="space-y-3">
            {gruposSidebar.map((group) => {
              const isOpen = Boolean(openGroups[group.key])
              const roleCode =
                group.role?.code ??
                (group.key === 'superuser'
                  ? 'superuser'
                  : group.key === 'admin'
                    ? 'admin'
                    : undefined)
              const roleIcon = group.role?.icon ?? ''
              return (
                <div key={group.key} className="space-y-1">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenGroups((prev) => ({
                        ...prev,
                        [group.key]: !prev[group.key],
                      }))
                    }
                    className={cn(
                      'group flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left transition-colors',
                      'text-[11px] uppercase tracking-[0.12em]',
                      isOpen ? 'font-semibold' : 'font-medium',
                      'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2 transition-all group-hover:font-semibold">
                      <RoleIcon
                        code={roleCode}
                        name={roleIcon}
                        className="size-3.5 shrink-0 text-muted-foreground"
                      />
                      <span className="truncate">{group.label}</span>
                    </span>
                    <ChevronDown
                      className={cn(
                        'size-3.5 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:opacity-100',
                        isOpen ? 'opacity-100' : '',
                        isOpen ? 'rotate-180' : ''
                      )}
                      aria-hidden
                    />
                  </button>

                  {isOpen ? (
                    <ul className="space-y-0.5 pl-1">
                      {group.modules.map((m) => {
                        if (!m.route) return null
                        const active = pathname === m.route
                        return (
                          <li key={`${group.key}-${m.id}`}>
                            <Link
                              href={m.route}
                              onClick={onNavigate}
                              className={cn(
                                'group flex items-center gap-2.5 rounded-md py-2 pl-3 pr-2 text-[13px] font-medium leading-none transition-colors',
                                active
                                  ? 'bg-nav-accent-soft text-nav-accent'
                                  : 'text-muted-foreground hover:bg-nav-accent-soft hover:text-nav-accent'
                              )}
                            >
                              <ModuleIcon
                                code={m.code}
                                name={m.icon}
                                className={cn(
                                  'size-4 shrink-0',
                                  active
                                    ? 'text-nav-accent'
                                    : 'text-muted-foreground transition-colors group-hover:text-nav-accent'
                                )}
                              />
                              <span className="truncate">{m.name}</span>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : !loading ? (
          <p className="rounded-md border border-dashed border-border bg-muted px-3 py-3 text-xs leading-relaxed text-muted-foreground">
            Sin módulos asignados para tu usuario en el plan actual.
          </p>
        ) : null}
      </nav>

      {beforeFooter}

      {activeCompany ? (
        <div className="border-t border-border px-5 py-4">
          <div
            className="flex min-w-0 items-start gap-2"
            title={
              multiCompany
                ? 'Para cambiar de empresa usá el menú de tu usuario (avatar).'
                : undefined
            }
          >
            <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Empresa activa
              </p>
              <p className="truncate text-sm font-medium leading-tight text-foreground">
                {activeCompany.name}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const NAV_HEIGHT_CLASS = 'h-16'
  const NAV_OFFSET_CLASS = 'top-16'
  const NAV_CONTENT_HEIGHT_CLASS = 'h-[calc(100dvh-4rem)]'

  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { me, loading, setActiveCompany } = useMe()
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [visitedModules, setVisitedModules] = useState<VisitedModule[]>([])

  const gruposSidebar = useMemo(() => gruposParaSidebar(me), [me])
  const allowedRoutes = useMemo(() => getAllowedRoutes(me), [me])
  const homeHref = useMemo(() => resolveHomeRoute(me), [me])
  const modulesByRoute = useMemo(() => {
    const map = new Map<string, MeMenuModule>()
    for (const group of gruposSidebar) {
      for (const mod of group.modules) {
        if (!mod.route) continue
        map.set(mod.route, mod)
      }
    }
    return map
  }, [gruposSidebar])
  const activeModule = useMemo(() => {
    const exact = modulesByRoute.get(pathname)
    if (exact) return exact
    let best: MeMenuModule | null = null
    for (const [route, mod] of modulesByRoute.entries()) {
      if (!route || route === '/') continue
      if (!pathname.startsWith(`${route}/`)) continue
      if (!best || route.length > best.route.length) {
        best = mod
      }
    }
    return best
  }, [modulesByRoute, pathname])

  useEffect(() => {
    if (!gruposSidebar.length) {
      setOpenGroups({})
      return
    }
    setOpenGroups((prev) => {
      const next: Record<string, boolean> = {}
      for (const [index, group] of gruposSidebar.entries()) {
        // Al primer render: abre el primer grupo y deja plegados los demás.
        next[group.key] = prev[group.key] ?? index === 0
      }
      return next
    })
  }, [gruposSidebar])

  useEffect(() => {
    if (loading) return
    if (isRouteAllowedPath(pathname, allowedRoutes)) return
    if (pathname === homeHref) return
    router.replace(homeHref)
  }, [allowedRoutes, homeHref, loading, pathname, router])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!mobileMenuOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [mobileMenuOpen])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(VISITED_MODULES_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      const valid = parsed.filter(
        (item): item is VisitedModule =>
          Boolean(item) &&
          typeof item.route === 'string' &&
          typeof item.name === 'string' &&
          typeof item.code === 'string' &&
          typeof item.icon === 'string'
      )
      setVisitedModules(valid.slice(-MAX_VISITED_MODULES))
    } catch {
      setVisitedModules([])
    }
  }, [])

  useEffect(() => {
    const currentModule = modulesByRoute.get(pathname)
    if (!currentModule?.route) return
    setVisitedModules((prev) => {
      const withoutCurrent = prev.filter((item) => item.route !== currentModule.route)
      const nextItem: VisitedModule = {
        route: currentModule.route,
        name: currentModule.name,
        code: currentModule.code,
        icon: currentModule.icon,
      }
      const next = [...withoutCurrent, nextItem].slice(-MAX_VISITED_MODULES)
      return next
    })
  }, [modulesByRoute, pathname])

  useEffect(() => {
    try {
      localStorage.setItem(VISITED_MODULES_STORAGE_KEY, JSON.stringify(visitedModules))
    } catch {
      /* noop */
    }
  }, [visitedModules])

  const activeCompany = useMemo(() => {
    if (!me?.accessible_companies?.length) return null
    const fallbackId = me.active_company?.id ?? me.accessible_companies[0].id
    return (
      me.accessible_companies.find((c) => c.id === fallbackId) ??
      me.accessible_companies[0]
    )
  }, [me])

  const activeCompanyId =
    activeCompany?.id ??
    me?.active_company?.id ??
    me?.accessible_companies?.[0]?.id ??
    ''

  const multiCompany =
    Boolean(me?.accessible_companies && me.accessible_companies.length > 1)

  const avatarHeading = useMemo(() => avatarMenuHeading(me), [me])

  function logout() {
    clearTokens()
    router.replace('/login')
  }

  return (
    <div className="relative h-screen overflow-hidden bg-background">
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-card px-4 md:px-8',
          NAV_HEIGHT_CLASS
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
          <Link
            href="/"
            className="flex shrink-0 items-center rounded-md outline-none ring-offset-card transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Ir al inicio"
          >
            <Image
              src="/logo.svg"
              alt="Retail Suite"
              width={180}
              height={48}
              priority
              className="h-8 w-auto md:h-9"
            />
          </Link>
          <div className="flex shrink-0 items-center md:hidden">
            <button
              type="button"
              className={cn(
                'inline-flex size-10 items-center justify-center rounded-lg border border-input bg-background',
                'text-foreground outline-none transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
              )}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-panel"
              aria-label="Abrir menú de navegación"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="size-5" aria-hidden />
            </button>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              'flex shrink-0 rounded-full outline-none',
              'ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
            )}
          >
            <Avatar className="size-9 cursor-pointer after:border-transparent">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {initialsFromMe(me)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 max-w-[min(calc(100vw-2rem),20rem)]"
            align="end"
            sideOffset={8}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium leading-snug text-foreground">
                    {avatarHeading.primary}
                  </span>
                  {avatarHeading.showUsernameBelow && me?.username ? (
                    <span className="text-xs leading-snug text-muted-foreground">
                      {me.username}
                    </span>
                  ) : null}
                  {me?.is_superuser ? (
                    <span className="text-xs text-muted-foreground">Superusuario</span>
                  ) : me?.is_staff ? (
                    <span className="text-xs text-muted-foreground">Staff</span>
                  ) : me?.is_admin ? (
                    <span className="text-xs text-muted-foreground">Administrador</span>
                  ) : null}
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {multiCompany && me?.accessible_companies ? (
              <>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="gap-2">
                    <Building2 className="size-4 shrink-0" />
                    Empresa activa
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent
                    className="max-h-[min(20rem,60vh)] min-w-[12rem] max-w-[min(20rem,calc(100vw-3rem))] overflow-y-auto"
                    alignOffset={-4}
                  >
                    <DropdownMenuRadioGroup
                      value={activeCompanyId}
                      onValueChange={(v) => setActiveCompany(v)}
                    >
                      {me.accessible_companies.map((c) => (
                        <DropdownMenuRadioItem key={c.id} value={c.id} className="min-w-0">
                          <span className="min-w-0 flex-1 truncate">{c.name}</span>
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
              </>
            ) : null}
            <DropdownMenuItem onClick={() => router.push('/profile')}>
              <User />
              Perfil
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Paintbrush />
                Cambiar tema
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-[9rem]">
                <DropdownMenuRadioGroup
                  value={theme ?? 'system'}
                  onValueChange={(v) => setTheme(v)}
                >
                  <DropdownMenuRadioItem value="light">
                    <Sun className="text-muted-foreground" />
                    Claro
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">
                    <Moon className="text-muted-foreground" />
                    Oscuro
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system">
                    <Monitor className="text-muted-foreground" />
                    Sistema
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={logout}>
              <LogOut />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <aside
        className={cn(
          'fixed left-0 z-20 hidden w-[17rem] shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex',
          NAV_OFFSET_CLASS,
          NAV_CONTENT_HEIGHT_CLASS
        )}
      >
        <SidebarNavPanel
          gruposSidebar={gruposSidebar}
          openGroups={openGroups}
          setOpenGroups={setOpenGroups}
          pathname={pathname}
          loading={loading}
          activeCompany={activeCompany}
          multiCompany={multiCompany}
        />
      </aside>

      {mobileMenuOpen ? (
        <>
          <div
            className={cn(
              'fixed inset-x-0 bottom-0 z-40 animate-in fade-in-0 duration-200 bg-black/45 md:hidden',
              NAV_OFFSET_CLASS
            )}
            aria-hidden
            onClick={() => setMobileMenuOpen(false)}
          />
          <div
            id="mobile-nav-panel"
            className={cn(
              'fixed left-0 z-50 flex w-[min(100%,17rem)] max-w-[min(100vw,20rem)] flex-col',
              'border-r border-sidebar-border bg-sidebar',
              'animate-in slide-in-from-left duration-200 md:hidden',
              NAV_OFFSET_CLASS,
              NAV_CONTENT_HEIGHT_CLASS
            )}
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
          >
            <SidebarNavPanel
              gruposSidebar={gruposSidebar}
              openGroups={openGroups}
              setOpenGroups={setOpenGroups}
              pathname={pathname}
              loading={loading}
              activeCompany={activeCompany}
              multiCompany={multiCompany}
              onNavigate={() => setMobileMenuOpen(false)}
              headerRight={
                <button
                  type="button"
                  className="rounded-md p-2 text-muted-foreground outline-none ring-offset-sidebar transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Cerrar menú"
                >
                  <X className="size-5" aria-hidden />
                </button>
              }
              beforeFooter={
                <div className="border-t border-border px-3 py-3">
                  <Link
                    href="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md py-2 pl-3 pr-2 text-[13px] font-medium transition-colors',
                      pathname === '/profile'
                        ? 'border-l-2 border-nav-accent bg-nav-accent-soft text-foreground'
                        : 'border-l-2 border-transparent text-muted-foreground hover:bg-nav-accent-soft hover:text-foreground'
                    )}
                  >
                    <User
                      className={cn(
                        'size-4 shrink-0',
                        pathname === '/profile'
                          ? 'text-nav-accent'
                          : 'text-muted-foreground'
                      )}
                      aria-hidden
                    />
                    Perfil
                  </Link>
                </div>
              }
            />
          </div>
        </>
      ) : null}

      <div className="flex h-full min-w-0 flex-1 flex-col pt-16 md:pl-[17rem]">
        <main className="min-h-0 flex-1 overflow-y-auto bg-background px-4 py-6 md:px-8">
          {visitedModules.length ? (
            <section className="mb-4 rounded-lg bg-muted/25 px-3 py-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {[...visitedModules].reverse().map((module) => {
                  const active = pathname === module.route
                  return (
                    <Link
                      key={`main-recent-${module.route}`}
                      href={module.route}
                      className={cn(
                        'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                        active
                          ? 'border-nav-accent/30 bg-nav-accent-soft text-nav-accent'
                          : 'border-border/60 bg-background text-muted-foreground hover:border-nav-accent/30 hover:text-foreground'
                      )}
                      aria-current={active ? 'page' : undefined}
                    >
                      <ModuleIcon code={module.code} name={module.icon} className="size-3.5 shrink-0" />
                      <span className="truncate">{module.name}</span>
                    </Link>
                  )
                })}
              </div>
            </section>
          ) : null}

          {activeModule ? (
            <section className="mb-4 rounded-xl border border-border bg-card px-4 py-3 text-card-foreground shadow-sm">
              <div className="flex items-start gap-3">
                <ModuleIcon
                  code={activeModule.code}
                  name={activeModule.icon}
                  className="mt-0.5 size-5 shrink-0 text-nav-accent"
                />
                <div className="min-w-0">
                  <h1 className="text-lg font-semibold leading-tight text-foreground">
                    {activeModule.name}
                  </h1>
                  {activeModule.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {activeModule.description}
                    </p>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  )
}
