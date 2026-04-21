import Link from 'next/link'

const cards = [
  { label: 'Empresas y estructura', href: '/structures' },
  { label: 'Suscripciones', href: '/subscriptions' },
  { label: 'Roles por empresa', href: '/roles_company' },
  { label: 'Proveedores de auth', href: '/auth-providers' },
  { label: 'Auth por cuenta', href: '/billing-auth-providers' },
]

export default function DashboardAdminPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
            <p className="mt-2 text-lg font-semibold text-foreground">Ir al módulo</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
