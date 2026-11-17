import { createAuthClient } from '@neon/auth'
import { BetterAuthReactAdapter } from '@neon/auth/react/adapters'

export const authClient = createAuthClient(import.meta.env.VITE_NEON_AUTH_URL, {
  adapter: BetterAuthReactAdapter(),
})

/** Current Neon Auth JWT (cached and refreshed by the SDK), or null when signed out. */
export async function getToken(): Promise<string | null> {
  try {
    const { data } = await authClient.getSession()
    return data?.session?.token ?? null
  } catch {
    return null
  }
}
