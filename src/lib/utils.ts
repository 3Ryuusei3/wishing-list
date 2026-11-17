export { cn } from "cn"

/** Up to two uppercase initials from a name or email. */
export function initials(name?: string | null) {
  return (name || '?')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
