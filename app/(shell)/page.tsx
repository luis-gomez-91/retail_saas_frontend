'use client'

import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useMe } from '@/components/me-provider'
import { ModuleIcon, RoleIcon } from '@/lib/ui/module-icon'
import type { MeMenuModule, MeModuleGroup, MeUser } from '@/lib/types/api'
import { cn } from '@/lib/utils'

type RootModuleGroup = {
  key: string
  label: string
  roleCode?: string
  roleIcon?: string
  modules: MeMenuModule[]
}

function fromProfiles(groups: MeModuleGroup[] | undefined): RootModuleGroup[] {
  if (!Array.isArray(groups) || groups.length === 0) return []
  return groups
    .map((group) => ({
      key: group.key,
      label: group.label,
      roleCode: group.role?.code ?? undefined,
      roleIcon: group.role?.icon ?? undefined,
      modules: (group.modules ?? []).filter((m) => Boolean(m.route)),
    }))
    .filter((group) => group.modules.length > 0)
}

function fromFlags(me: MeUser | null): RootModuleGroup[] {
  const modules = (me?.modules ?? []).filter((m) => Boolean(m.route))
  if (!modules.length) return []

  const superModules = modules.filter((m) => m.use_superuser)
  const adminModules = modules.filter((m) => m.use_admin && !m.use_superuser)
  const roleModules = modules.filter((m) => !m.use_superuser && !m.use_admin)

  const groups: RootModuleGroup[] = []
  if (me?.is_superuser && superModules.length) {
    groups.push({
      key: 'superuser',
      label: 'Superuser',
      roleCode: 'superuser',
      modules: superModules,
    })
  }
  if (me?.is_admin && adminModules.length) {
    groups.push({
      key: 'admin',
      label: 'Administrador',
      roleCode: 'admin',
      modules: adminModules,
    })
  }
  if (roleModules.length) {
    groups.push({
      key: 'roles',
      label: 'Roles asignados',
      modules: roleModules,
    })
  }
  if (!groups.length) {
    groups.push({
      key: 'default',
      label: 'Módulos asignados',
      modules,
    })
  }
  return groups
}

function uniqueByRoute(modules: MeMenuModule[]): MeMenuModule[] {
  const seen = new Set<string>()
  const out: MeMenuModule[] = []
  for (const mod of modules) {
    const key = mod.route
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(mod)
  }
  return out
}

export default function RootModulesPage() {
  const { me, loading } = useMe()
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  const groupedModules = useMemo(() => {
    const byProfile = fromProfiles(me?.modules_by_profile)
    if (byProfile.length > 0) {
      return byProfile.map((g) => ({ ...g, modules: uniqueByRoute(g.modules) }))
    }
    return fromFlags(me ?? null).map((g) => ({ ...g, modules: uniqueByRoute(g.modules) }))
  }, [me])

  useEffect(() => {
    if (!groupedModules.length) {
      setOpenGroups({})
      return
    }
    setOpenGroups((prev) => {
      const next: Record<string, boolean> = {}
      groupedModules.forEach((group, index) => {
        next[group.key] = prev[group.key] ?? index === 0
      })
      return next
    })
  }, [groupedModules])

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {loading ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4">
            <div className="h-5 w-44 animate-pulse rounded-md bg-muted" />
            <div className="mt-2 h-4 w-64 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="space-y-3 p-5">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="space-y-2">
                <div className="h-9 animate-pulse rounded-lg bg-muted" />
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="h-24 animate-pulse rounded-xl bg-muted/80" />
                  <div className="h-24 animate-pulse rounded-xl bg-muted/80" />
                  <div className="hidden h-24 animate-pulse rounded-xl bg-muted/80 xl:block" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : groupedModules.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          No tenés módulos asignados para mostrar en el inicio.
        </p>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
          <div className="divide-y divide-border">
            {groupedModules.map((group) => {
              const isOpen = Boolean(openGroups[group.key])
              return (
                <div key={group.key} className="p-3 sm:p-4">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenGroups((prev) => ({
                        ...prev,
                        [group.key]: !prev[group.key],
                      }))
                    }
                    className={cn(
                      'group flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                      'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      isOpen ? 'bg-muted/70' : 'hover:bg-muted/50'
                    )}
                    aria-expanded={isOpen}
                    aria-controls={`group-${group.key}`}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <RoleIcon
                        code={group.roleCode}
                        name={group.roleIcon ?? ''}
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                      <span className="truncate text-sm font-semibold uppercase tracking-wide text-foreground">
                        {group.label}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        {group.modules.length}
                      </span>
                      <ChevronDown
                        className={cn(
                          'size-4 text-muted-foreground transition-transform duration-200',
                          isOpen ? 'rotate-180' : ''
                        )}
                        aria-hidden
                      />
                    </span>
                  </button>

                  {isOpen ? (
                    <div id={`group-${group.key}`} className="pt-3">
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {group.modules.map((module) => (
                          <Link
                            key={`${group.key}-${module.id}`}
                            href={module.route}
                            className={cn(
                              'group rounded-xl border border-border bg-background p-3 transition-all',
                              'hover:border-nav-accent hover:bg-nav-accent-soft hover:shadow-sm',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <ModuleIcon
                                code={module.code}
                                name={module.icon}
                                className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-nav-accent"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">{module.name}</p>
                                <p className="truncate text-xs text-muted-foreground">{module.code}</p>
                                {module.description ? (
                                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                    {module.description}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
