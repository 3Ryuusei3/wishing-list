import type { Context } from 'hono'
import { createRemoteJWKSet, jwtVerify } from 'jose'

export type AuthUser = { id: string; email?: string; name?: string }

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined

function getJwks() {
  if (!jwks) {
    const base = process.env.NEON_AUTH_BASE_URL
    const url = process.env.NEON_AUTH_JWKS_URL || (base && `${base}/.well-known/jwks.json`)
    if (!url) throw new Error('NEON_AUTH_JWKS_URL is not set')
    jwks = createRemoteJWKSet(new URL(url))
  }
  return jwks
}

/** Verifies the Neon Auth JWT sent as `Authorization: Bearer`. Returns null if absent/invalid. */
export async function getUser(c: Context): Promise<AuthUser | null> {
  const header = c.req.header('authorization')
  if (!header?.startsWith('Bearer ')) return null
  try {
    const base = process.env.NEON_AUTH_BASE_URL
    // Neon Auth sets both iss and aud to the Auth origin.
    const origin = base ? new URL(base).origin : undefined
    const { payload } = await jwtVerify(header.slice(7), getJwks(), { issuer: origin, audience: origin })
    if (!payload.sub) return null
    return {
      id: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      name: typeof payload.name === 'string' ? payload.name : undefined,
    }
  } catch {
    return null
  }
}
