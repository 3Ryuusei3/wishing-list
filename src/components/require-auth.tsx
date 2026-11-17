import { Loader2Icon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { authClient } from '@/lib/auth'

export function FullPageSpinner() {
  return (
    <div className="grid min-h-[40vh] place-items-center text-muted-foreground">
      <Loader2Icon className="size-6 animate-spin" />
    </div>
  )
}

/** Client-side guard: Vite has no server middleware, so check the session here. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { data, isPending } = authClient.useSession()
  const location = useLocation()
  if (isPending) return <FullPageSpinner />
  if (!data?.user) {
    const redirectTo = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/auth/sign-in?redirectTo=${redirectTo}`} replace />
  }
  return children
}
