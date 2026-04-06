export interface TokenPair {
  access: string
  refresh: string
}

export interface MeUser {
  id: number
  username: string
  is_staff: boolean
  is_superuser: boolean
  date_joined: string
  last_login: string | null
}

export interface Person {
  id: number
  user: number
  name: string
  last_name: string
  second_last_name: string
  personal_email: string
  phone: string
  created_at: string
  updated_at: string
}

export interface Empresa {
  id: number
  billing_account: number
  name: string
  slug: string
  created_at: string
  updated_at: string
}

export interface Organizacion {
  id: number
  empresa: number
  name: string
  created_at: string
  updated_at: string
}

export interface Sucursal {
  id: number
  organizacion: number
  name: string
  created_at: string
  updated_at: string
}

export interface BillingAccount {
  id: number
  name: string
  created_at: string
}

export interface Subscription {
  id: number
  billing_account: number
  plan: number
  status: number
  current_period_end: string | null
  external_subscription_id: string | null
  created_at: string
  updated_at: string
}

export interface Plan {
  id: number
  code: string
  name: string
  is_public: boolean
  display_order: number
  max_empresas: number | null
  max_organizaciones: number | null
  max_sucursales: number | null
  module_ids: number[]
}
