import { useQuery } from '@tanstack/react-query'
import { LogOutIcon, MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useTheme, type Theme } from '@/lib/theme'
import { initials } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api, type List } from '@/lib/api'
import { authClient } from '@/lib/auth'
import { ListCard, ListGridSkeleton } from './lists'

export function ProfilePage() {
  const { data: session } = authClient.useSession()
  const user = session?.user
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const mine = useQuery({ queryKey: ['my-lists'], queryFn: () => api<{ lists: List[] }>('/me/lists') })
  const following = useQuery({ queryKey: ['following'], queryFn: () => api<{ lists: List[] }>('/me/following') })

  if (!user) return null

  return (
    <div className="space-y-8">
      <Card className="flex-row flex-wrap items-center gap-4 rounded-md p-6 shadow-none">
        <Avatar className="size-16">
          {user.image && <AvatarImage src={user.image} alt="" />}
          <AvatarFallback className="bg-secondary font-heading text-xl text-secondary-foreground">{initials(user.name || user.email)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-heading text-3xl">{user.name || 'Sin nombre'}</h1>
          <p className="truncate text-muted-foreground">{user.email}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {mine.data ? `${mine.data.lists.length} ${mine.data.lists.length === 1 ? 'lista propia' : 'listas propias'}` : '…'}
            {following.data && ` · sigues ${following.data.lists.length}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={theme} onValueChange={(v) => setTheme(v as Theme)}>
            <TabsList>
              <TabsTrigger value="light" aria-label="Tema claro">
                <SunIcon />
              </TabsTrigger>
              <TabsTrigger value="dark" aria-label="Tema oscuro">
                <MoonIcon />
              </TabsTrigger>
              <TabsTrigger value="system" aria-label="Tema del sistema">
                <MonitorIcon />
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            variant="outline"
            onClick={async () => {
              await authClient.signOut()
              navigate('/')
            }}
          >
            <LogOutIcon /> Cerrar sesión
          </Button>
        </div>
      </Card>

      <section className="space-y-4">
        <div>
          <h2 className="font-heading text-3xl">Listas que sigo</h2>
          <span className="rule my-3" />
          <p className="text-muted-foreground">Listas que otras personas han compartido contigo. Abre un enlace compartido y pulsa “Seguir lista”.</p>
        </div>
        {following.isPending ? (
          <ListGridSkeleton />
        ) : following.error ? (
          <p className="text-destructive">{following.error.message}</p>
        ) : following.data.lists.length === 0 ? (
          <div className="rounded-md border border-dashed p-10 text-center">
            <p className="font-heading text-xl">Todavía no sigues ninguna lista</p>
            <p className="text-sm text-muted-foreground">Cuando alguien te pase el enlace de su lista, síguela para tenerla siempre a mano.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {following.data.lists.map((l) => (
              <ListCard key={l.id} list={l} to={`/l/${l.shareSlug}`} footer={l.purchasedCount ? `${l.purchasedCount} comprados` : undefined} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
