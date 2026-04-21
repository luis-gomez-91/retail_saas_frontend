'use client'

import { useState, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { useMe } from '@/components/me-provider'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { canWriteStaffScopedApi } from '@/lib/auth/abilities'
import { cn } from '@/lib/utils'

/**
 * Botón + modal (shadcn Dialog) para altas reservadas a staff en la API.
 * El hijo recibe `close` para cerrar tras crear con éxito.
 */
export function StaffCreateDialog({
  title,
  description,
  triggerLabel,
  contentClassName,
  /** Contenedor del botón; por defecto `mb-6` para separar de la tabla. Usa p. ej. `shrink-0` en `EntityTable` `headerActions`. */
  triggerWrapperClassName = 'mb-6',
  children,
}: {
  title: string
  description?: string
  triggerLabel: string
  contentClassName?: string
  triggerWrapperClassName?: string
  children: (ctx: { close: () => void }) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const { me, loading } = useMe()

  if (loading || !canWriteStaffScopedApi(me)) return null

  function close() {
    setOpen(false)
  }

  return (
    <>
      <div className={triggerWrapperClassName}>
        <Button type="button" variant="default" onClick={() => setOpen(true)}>
          <Plus data-icon="inline-start" />
          {triggerLabel}
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton
          className={cn(
            'max-h-[min(90vh,640px)] overflow-y-auto sm:max-w-md',
            contentClassName
          )}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? (
              <DialogDescription>{description}</DialogDescription>
            ) : null}
          </DialogHeader>
          {children({ close })}
        </DialogContent>
      </Dialog>
    </>
  )
}
