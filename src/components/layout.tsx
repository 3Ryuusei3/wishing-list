import { ListIcon, LogOutIcon, UserIcon } from 'lucide-react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { authClient } from '@/lib/auth'
import { cn, initials } from '@/lib/utils'
import { ModeToggle } from './mode-toggle'

export function Logo() {
  return (
    <Link to="/" className="font-heading text-2xl tracking-tight">
      Ziru
    </Link>
  )
}

function UserMenu() {
  const { data, isPending } = authClient.useSession()
  const navigate = useNavigate()
  if (isPending) return <div className="size-9 animate-pulse rounded-full bg-muted" />
  if (!data?.user)
    return (
      <Button asChild size="sm">
        <Link to="/auth/sign-in">Entrar</Link>
      </Button>
    )
  const user = data.user
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" aria-label="Menú de usuario">
          <Avatar className="size-9">
            {user.image && <AvatarImage src={user.image} alt="" />}
            <AvatarFallback className="bg-secondary text-secondary-foreground">{initials(user.name || user.email)}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">
          <div className="font-medium">{user.name}</div>
          <div className="truncate text-xs font-normal text-muted-foreground">{user.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/listas')}>
          <ListIcon /> Mis listas
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/perfil')}>
          <UserIcon /> Perfil
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await authClient.signOut()
            navigate('/')
          }}
        >
          <LogOutIcon /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Layout() {
  const { data } = authClient.useSession()
  const navClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'border-b px-1 py-1 text-sm transition-colors hover:text-foreground',
      isActive ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground',
    )
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4">
          <Logo />
          {data?.user && (
            <nav className="hidden items-center gap-5 pl-4 sm:flex">
              <NavLink to="/listas" className={navClass}>
                Mis listas
              </NavLink>
              <NavLink to="/perfil" className={navClass}>
                Perfil
              </NavLink>
            </nav>
          )}
          <div className="ml-auto flex items-center gap-2">
            <ModeToggle />
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <Outlet />
      </main>
      <footer className="border-t pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <p className="mx-auto max-w-5xl px-4 font-heading text-sm text-muted-foreground italic">Ziru · listas de regalos para compartir</p>
      </footer>
    </div>
  )
}
