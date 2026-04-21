import Link from 'next/link'

const cards = [
  { label: 'Módulos del sistema', href: '/modules' },
  { label: 'Tipos de identificación', href: '/identification-types' },
  { label: 'Geografía', href: '/geography' },
  { label: 'Planes', href: '/plans-admin' },
]

export default function DashboardSuperuserPage() {
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
