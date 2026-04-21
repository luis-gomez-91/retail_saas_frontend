import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-card-foreground shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">Error 404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
          No encontramos esta pagina
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          La URL puede estar mal escrita o la pagina ya no existe. Puedes volver al panel o
          iniciar sesion nuevamente.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboards"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
          >
            Ir al panel
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors duration-200 hover:bg-muted"
          >
            Ir a login
          </Link>
        </div>
      </section>
    </main>
  )
}
