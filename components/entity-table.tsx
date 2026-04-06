'use client'

export function EntityTable({
  title,
  description,
  columns,
  rows,
  loading,
  error,
}: {
  title: string
  description?: string
  columns: { key: string; label: string }[]
  rows: Record<string, string | number | boolean | null | undefined>[]
  loading: boolean
  error: string | null
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-4">
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        ) : null}
      </div>
      <div className="overflow-x-auto p-4">
        {loading ? (
          <p className="px-2 py-8 text-center text-slate-500">Cargando…</p>
        ) : error ? (
          <p className="px-2 py-8 text-center text-red-600">{error}</p>
        ) : rows.length === 0 ? (
          <p className="px-2 py-8 text-center text-slate-500">Sin registros.</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500">
                {columns.map((c) => (
                  <th key={c.key} className="whitespace-nowrap px-3 py-2 font-medium">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-slate-50 last:border-0">
                  {columns.map((c) => (
                    <td key={c.key} className="px-3 py-2 text-slate-800">
                      {formatCell(row[c.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function formatCell(
  value: string | number | boolean | null | undefined
): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  return String(value)
}
