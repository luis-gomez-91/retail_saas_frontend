import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/empresas', destination: '/companies', permanent: true },
      { source: '/organizaciones', destination: '/organizations', permanent: true },
      { source: '/sucursales', destination: '/branches', permanent: true },
      { source: '/modulos', destination: '/modules', permanent: true },
      { source: '/perfil', destination: '/profile', permanent: true },
      { source: '/suscripciones', destination: '/subscriptions', permanent: true },
      { source: '/facturacion', destination: '/billing', permanent: true },
      { source: '/rol_empresa', destination: '/company-roles', permanent: true },
      { source: '/personal', destination: '/staff', permanent: true },
      { source: '/planes_admin', destination: '/plans-admin', permanent: true },
      { source: '/personas', destination: '/people', permanent: true },
      { source: '/estructura', destination: '/structures', permanent: true },
      { source: '/structure', destination: '/structures', permanent: true },
      { source: '/dashboard', destination: '/dashboards', permanent: true },
      { source: '/reportes', destination: '/reports', permanent: true },
      { source: '/ventas', destination: '/sales', permanent: true },
      { source: '/productos', destination: '/products', permanent: true },
      { source: '/tipos-identificacion', destination: '/identification-types', permanent: true },
      { source: '/alta_personas', destination: '/staff', permanent: true },
      { source: '/planes', destination: '/plans-admin', permanent: true },
    ]
  },
}

export default nextConfig
