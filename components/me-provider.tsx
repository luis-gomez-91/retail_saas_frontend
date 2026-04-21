'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { apiFetch } from '@/lib/api/client'
import type { MeMenuModule, MeModuleGroup, MeUser } from '@/lib/types/api'

const STORAGE_KEY = 'retail_saas_active_company_id'

type MeState = {
  me: MeUser | null
  loading: boolean
  setActiveCompany: (companyId: string) => void
}

const MeContext = createContext<MeState | null>(null)

type ApiMeMenuModule = Partial<MeMenuModule> & {
  superuser_only?: boolean
  admin_only?: boolean
  ruta?: string
}

type ApiMeModuleGroup = Partial<MeModuleGroup> & {
  modules?: ApiMeMenuModule[]
}

function normalizeMenuModule(module: ApiMeMenuModule): MeMenuModule {
  return {
    id: module.id ?? 0,
    code: module.code ?? '',
    name: module.name ?? '',
    description: module.description ?? '',
    icon: module.icon ?? '',
    use_superuser: module.use_superuser ?? module.superuser_only ?? false,
    use_admin: module.use_admin ?? module.admin_only ?? false,
    route: module.route ?? module.ruta ?? '',
  }
}

function normalizeModuleGroup(group: ApiMeModuleGroup): MeModuleGroup {
  return {
    key: group.key ?? 'default',
    label: group.label ?? 'Módulos',
    modules: Array.isArray(group.modules) ? group.modules.map(normalizeMenuModule) : [],
    role: group.role ?? null,
  }
}

function readStoredCompanyId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function MeProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [hydrated, setHydrated] = useState(false)
  const [fetchCompanyId, setFetchCompanyId] = useState<string | null>(null)

  useEffect(() => {
    setFetchCompanyId(readStoredCompanyId())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const path =
          fetchCompanyId != null && fetchCompanyId !== ''
            ? `/api/users/me/?company=${encodeURIComponent(fetchCompanyId)}`
            : '/api/users/me/'
        const user = await apiFetch<MeUser>(path)
        if (!cancelled) {
          const modules = Array.isArray(user.modules)
            ? (user.modules as ApiMeMenuModule[]).map(normalizeMenuModule)
            : []
          const modulesByProfile = Array.isArray(user.modules_by_profile)
            ? (user.modules_by_profile as ApiMeModuleGroup[]).map(normalizeModuleGroup)
            : []
          const accessibleCompanies = Array.isArray(user.accessible_companies)
            ? user.accessible_companies
            : []

          setMe({
            ...user,
            modules,
            modules_by_profile: modulesByProfile,
            accessible_companies: accessibleCompanies,
          })
          if (user.active_company?.id) {
            try {
              localStorage.setItem(STORAGE_KEY, user.active_company.id)
            } catch {
              /* noop */
            }
          }
        }
      } catch {
        if (!cancelled) setMe(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [hydrated, fetchCompanyId])

  const setActiveCompany = useCallback((companyId: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, companyId)
    } catch {
      /* noop */
    }
    setFetchCompanyId(companyId)
  }, [])

  const value = useMemo(
    () => ({ me, loading, setActiveCompany }),
    [me, loading, setActiveCompany]
  )
  return <MeContext.Provider value={value}>{children}</MeContext.Provider>
}

export function useMe(): MeState {
  const ctx = useContext(MeContext)
  if (!ctx) {
    throw new Error('useMe debe usarse dentro de MeProvider')
  }
  return ctx
}
