// Shared API wire-date formatting (Stage 2B).
// QubWatch API convention is the naive 'YYYY-MM-DD HH:MM' string.
// SQLite rows already carry that exact string; PostgreSQL TIMESTAMPTZ
// arrives as a Date and is rendered in UTC so the same stored instant
// produces the identical representation on every machine.
export function formatWireDate(value) {
  if (value == null) return value
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    const pad = (n) => String(n).padStart(2, '0')
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())} ${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}`
  }
  return String(value)
}
