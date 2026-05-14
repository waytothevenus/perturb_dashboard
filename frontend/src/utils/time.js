/**
 * Convert a backend log timestamp string (YYYY-MM-DD HH:MM:SS,mmm, assumed UTC)
 * to a human-readable Tokyo (JST, UTC+9) string.
 */
export function toTokyoTime(ts) {
  if (!ts) return ts
  // Python logging format: "2026-05-13 10:30:45,123" — treat as UTC
  const isoStr = ts.replace(',', '.').replace(' ', 'T') + 'Z'
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return ts
  return d.toLocaleString('en-GB', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }) + ' JST'
}

/**
 * Format a Date object as Tokyo time (for live "last update" display).
 */
export function nowTokyoTime(d) {
  if (!d) return ''
  return d.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }) + ' JST'
}
