export interface TokenPair {
  access: string
  refresh: string
}

/** Entrada de menú según /api/users/me/ (`modulos`). */
export interface MeMenuModule {
  id: number
  code: string
  name: string
  description: string
  icon: string
  use_superuser: boolean
  use_admin: boolean
  route: string
}

export interface MeModuleGroupRoleMeta {
  id: string | null
  code: string
  name: string
  icon: string
  company_id: string | null
  company_name: string | null
}

export interface MeModuleGroup {
  key: string
  label: string
  modules: MeMenuModule[]
  role?: MeModuleGroupRoleMeta | null
}

/** Empresa donde la persona tiene empleo activo (selector de contexto). */
export interface MeAccessibleCompany {
  id: string
  name: string
}

/** Ficha mínima en `/api/users/me/` → `person` (MePersonSerializer). */
export interface MePersonBrief {
  id: number
  name: string
  last_name: string
  second_last_name?: string
  personal_email?: string
  work_email?: string
  identification_type?: string | null
  identification_number?: string
  country?: string | null
  province?: string | null
  city?: string | null
}

export interface MeUser {
  id: number
  username: string
  is_staff: boolean
  is_superuser: boolean
  is_admin: boolean
  date_joined: string
  last_login: string | null
  modules: MeMenuModule[]
  modules_by_profile: MeModuleGroup[]
  /** Datos de persona vinculada; ausente si no hay fila Person. */
  person?: MePersonBrief | null
  /** Empleos activos; si hay más de uno, el front puede cambiar contexto con `?company=`. */
  accessible_companies?: MeAccessibleCompany[]
  /** Empresa resuelta para el menú (coincide con `?company=` o la primera por nombre). */
  active_company?: MeAccessibleCompany | null
}

/** GET /api/identification-types/ */
export interface IdentificationType {
  id: string
  code: string
  name: string
}

/** Catálogo `/api/auth-providers/` (OAuth además del login con contraseña). */
export interface AuthProvider {
  id: string
  code: string
  name: string
  is_active: boolean
  sort_order: number
}

export interface Person {
  id: number
  user: number
  /** Solo lectura en listados API. */
  user_username?: string
  name: string
  last_name: string
  second_last_name: string
  personal_email: string
  work_email?: string
  identification_type?: string | null
  identification_number?: string
  phone: string
  companies_label?: string
  companies_etiqueta?: string
  roles_label?: string
  roles_etiqueta?: string
  /** IDs de `AuthProvider` permitidos para login OAuth (además de contraseña). */
  auth_provider_ids?: string[]
  created_at: string
  updated_at: string
}

export interface Company {
  id: string
  billing_account: string
  name: string
  slug: string
  created_at: string
  updated_at: string
}

export interface Organization {
  id: string
  company: string
  name: string
  created_at: string
  updated_at: string
}

export interface Branch {
  id: string
  organization: string
  name: string
  created_at: string
  updated_at: string
}

/** País (UUID). GET/POST /api/countries/ */
export interface GeoCountry {
  id: string
  name: string
  iso_code: string | null
}

/** Provincia (UUID). GET /api/provinces/?country= */
export interface GeoProvince {
  id: string
  country: string
  country_name?: string
  name: string
}

/** Ciudad (UUID). GET /api/cities/?province= / ?country= */
export interface GeoCity {
  id: string
  province: string
  province_name?: string
  country_id?: string
  name: string
}

export interface BillingAccount {
  id: string
  name: string
  /** Person titular (UUID); puede ser null en datos viejos. */
  owner: string | null
  created_at: string
}

export interface Subscription {
  id: string
  billing_account: string
  plan: string
  status: string
  current_period_end: string | null
  external_subscription_id: string | null
  created_at: string
  updated_at: string
}

export interface BillingAccountAuthProvider {
  id: string
  billing_account: string
  billing_account_name?: string
  provider: string
  provider_code?: string
  provider_name?: string
  is_enabled: boolean
  created_at: string
}

export interface SubscriptionStatus {
  id: number
  code: string
  name: string
  active: boolean
  order: number
}

export interface Plan {
  id: string
  code: string
  name: string
  description: string
  display_order: number
  max_companies: number | null
  max_organizations: number | null
  max_branches: number | null
  max_points_of_sale: number | null
  max_employees: number | null
  monthly_price: string | null
  yearly_price: string | null
  currency: string
  support_email: boolean
  support_chat: boolean
  support_dedicated: boolean
  sap_integration: boolean
  is_popular: boolean
  module_ids?: string[]
  ids_modules?: string[]
}

/** Catálogo RBAC: módulo funcional (DRF: /api/modules/). */
export interface Module {
  id: string
  code: string
  name: string
  description: string
  icon: string
  use_superuser: boolean
  use_admin: boolean
}

export interface PlanModule {
  id: string
  plan: string
  module: string
}

/** Plantilla RBAC (`Role`); escritura de módulos con `ids_modules` en `/api/roles/`. */
export interface Role {
  id: string
  code: string
  name: string
  icon: string
  modules: string[]
}

/** Vínculo empresa (o global) ↔ plantilla; CRUD en `/api/roles_company/`. */
export interface CompanyRole {
  id: string
  company: string | null
  company_label?: string
  company_etiqueta?: string
  role: string
  code: string
  name: string
  icon: string
  modules: string[]
}
