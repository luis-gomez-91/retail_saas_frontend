'use client'

import type { ReactNode } from 'react'
import { Check, X } from 'lucide-react'
import {
  formatDisplayDateTime,
  looksLikeApiDateTimeString,
} from '@/lib/ui/format-datetime'

export function EntityTable({
  belowTitleContent,
  columns,
  rows,
  loading,
  error,
  headerActions,
  renderCell,
}: {
  belowTitleContent?: ReactNode
  columns: { key: string; label: string }[]
  rows: Record<string, string | number | boolean | null | undefined>[]
  loading: boolean
  error: string | null
  headerActions?: ReactNode
  renderCell?: (
    row: Record<string, string | number | boolean | null | undefined>,
    key: string,
    rowIndex: number
  ) => ReactNode
}) {
  const showHeader = Boolean(belowTitleContent || headerActions)

  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm">
      {showHeader ? (
        <div className="flex flex-col gap-3 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            {belowTitleContent ? <div>{belowTitleContent}</div> : null}
          </div>
          {headerActions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{headerActions}</div>
          ) : null}
        </div>
      ) : null}
      <div className="overflow-x-auto p-4">
        {loading ? (
          <p className="px-2 py-8 text-center text-muted-foreground">Cargando…</p>
        ) : error ? (
          <p className="px-2 py-8 text-center text-destructive">{error}</p>
        ) : rows.length === 0 ? (
          <p className="px-2 py-8 text-center text-muted-foreground">Sin registros.</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                {columns.map((c) => (
                  <th key={c.key} className="whitespace-nowrap px-3 py-2 font-medium">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={
                    (typeof row.id === 'string' || typeof row.id === 'number'
                      ? String(row.id)
                      : undefined) ?? i
                  }
                  className="border-b border-border last:border-0 hover:bg-muted"
                >
                  {columns.map((c) => (
                    <td key={c.key} className="px-3 py-2 text-foreground">
                      {renderCell
                        ? (renderCell(row, c.key, i) ?? formatCell(row[c.key]))
                        : formatCell(row[c.key])}
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
): ReactNode {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') {
    const label = value ? 'Sí' : 'No'
    return (
      <span
        className="inline-flex items-center justify-center"
        aria-label={label}
        title={label}
      >
        {value ? (
          <Check
            className="size-4 text-primary"
            strokeWidth={2.25}
            aria-hidden
          />
        ) : (
          <X
            className="size-4 text-muted-foreground"
            strokeWidth={2.25}
            aria-hidden
          />
        )}
      </span>
    )
  }
  if (typeof value === 'string' && looksLikeApiDateTimeString(value)) {
    return formatDisplayDateTime(value)
  }
  return String(value)
}
