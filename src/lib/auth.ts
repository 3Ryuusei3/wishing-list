import { createAuthClient } from '@neon/auth'
import { BetterAuthReactAdapter } from '@neon/auth/react/adapters'

// Same-origin auth proxy (server/app.ts → /api/auth/*) instead of the Neon Auth
// domain, so auth cookies are first-party everywhere (Safari/iOS included).
export const authClient = createAuthClient(`${window.location.origin}/api/auth`, {
  adapter: BetterAuthReactAdapter(),
})

type CachedJwt = { session: string; token: string; exp: number }
let cached: CachedJwt | null = null
let inflight: Promise<string | null> | null = null

function jwtExpiry(token: string) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : 0
  } catch {
    return 0
  }
}

async function fetchJwt(sessionKey: string) {
  // GET /api/auth/token (Neon Auth JWT plugin) through the same-origin proxy.
  // Plain fetch on purpose: the SDK's fetch hooks treat '/token' like get-session
  // and answer from their session cache, which carries no JWT.
  const res = await fetch('/api/auth/token', { credentials: 'include', headers: { accept: 'application/json' } })
  const token = res.ok ? ((await res.json()) as { token?: string }).token : undefined
  if (!token) return null
  cached = { session: sessionKey, token, exp: jwtExpiry(token) }
  return token
}

/**
 * Neon Auth JWT for our API (`Authorization: Bearer`), or null when signed out.
 * Cached per session until ~1 min before it expires (they last 15 min).
 */
export async function getToken(): Promise<string | null> {
  try {
    const { data } = await authClient.getSession()
    const session = data?.session as { id?: string; token?: string } | undefined
    if (!session) {
      cached = null
      return null
    }
    const key = session.id ?? session.token ?? ''
    if (cached && cached.session === key && cached.exp - 60_000 > Date.now()) return cached.token
    inflight ??= fetchJwt(key).finally(() => {
      inflight = null
    })
    return await inflight
  } catch {
    return null
  }
}
