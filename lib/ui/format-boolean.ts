/** Texto para booleanos fuera de tablas (p. ej. perfil). Las tablas usan iconos en `EntityTable`. */
export function formatBooleanLabel(value: boolean): string {
  return value ? 'Activo' : 'Inactivo'
}
