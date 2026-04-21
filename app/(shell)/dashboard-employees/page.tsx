import Link from 'next/link'

const cards = [
  { label: 'Ventas', href: '/sales' },
  { label: 'Productos', href: '/products' },
  { label: 'Reportes', href: '/reports' },
  { label: 'Mi perfil', href: '/profile' },
]

export default function DashboardEmployeesPage() {
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
