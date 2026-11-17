import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { Layout } from '@/components/layout'
import { RequireAuth } from '@/components/require-auth'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ApiError } from '@/lib/api'
import { AuthPage } from '@/pages/auth'
import { HomePage } from '@/pages/home'
import { ListDetailPage } from '@/pages/list-detail'
import { ListsPage } from '@/pages/lists'
import { ProfilePage } from '@/pages/profile'
import { SharedListPage } from '@/pages/shared-list'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
    },
  },
})

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<HomePage />} />
                <Route path="auth/:mode" element={<AuthPage />} />
                <Route path="l/:slug" element={<SharedListPage />} />
                <Route path="listas" element={<RequireAuth><ListsPage /></RequireAuth>} />
                <Route path="listas/:id" element={<RequireAuth><ListDetailPage /></RequireAuth>} />
                <Route path="perfil" element={<RequireAuth><ProfilePage /></RequireAuth>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
          <Toaster position="top-center" />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
