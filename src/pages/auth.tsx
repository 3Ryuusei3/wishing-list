import { Loader2Icon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { FullPageSpinner } from '@/components/require-auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { authClient } from '@/lib/auth'

/** Only allow same-origin relative redirects. */
function safeRedirect(v: string | null) {
  if (!v || !v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\')) return '/listas'
  return v
}

function errorMessage(err: { message?: string; code?: string; status?: number } | null | undefined) {
  const code = err?.code ?? ''
  if (code === 'INVALID_EMAIL_OR_PASSWORD' || err?.status === 401) return 'Email o contraseña incorrectos'
  if (code === 'USER_ALREADY_EXISTS' || code.includes('ALREADY_EXISTS')) return 'Ya existe una cuenta con ese email'
  if (code === 'PASSWORD_TOO_SHORT') return 'La contraseña debe tener al menos 8 caracteres'
  if (code === 'INVALID_EMAIL') return 'El email no es válido'
  return err?.message || 'Algo ha salido mal, inténtalo de nuevo'
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  )
}

export function AuthPage() {
  const { mode } = useParams()
  const isSignUp = mode === 'sign-up'
  const [params] = useSearchParams()
  const redirectTo = safeRedirect(params.get('redirectTo'))
  const navigate = useNavigate()
  const { data, isPending } = authClient.useSession()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState<'email' | 'google' | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (mode !== 'sign-in' && mode !== 'sign-up') return <Navigate to="/auth/sign-in" replace />
  if (isPending) return <FullPageSpinner />
  if (data?.user) return <Navigate to={redirectTo} replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading('email')
    try {
      const res = isSignUp
        ? await authClient.signUp.email({ name: name.trim() || email.split('@')[0], email, password })
        : await authClient.signIn.email({ email, password })
      if (res.error) {
        setError(errorMessage(res.error))
        return
      }
      toast.success(isSignUp ? 'Cuenta creada' : 'Sesión iniciada')
      navigate(redirectTo, { replace: true })
    } catch (err: any) {
      setError(errorMessage(err?.body ?? err))
    } finally {
      setLoading(null)
    }
  }

  const onGoogle = async () => {
    setError(null)
    setLoading('google')
    try {
      const res = await authClient.signIn.social({
        provider: 'google',
        callbackURL: `${window.location.origin}${redirectTo}`,
      })
      if (res?.error) setError(errorMessage(res.error))
    } catch (err: any) {
      setError(errorMessage(err?.body ?? err))
    } finally {
      setLoading(null)
    }
  }

  const otherLink = `/auth/${isSignUp ? 'sign-in' : 'sign-up'}${params.toString() ? `?${params}` : ''}`

  return (
    <div className="mx-auto max-w-sm py-6">
      <Card className="rounded-md shadow-none">
        <CardHeader className="text-center">
          <CardTitle className="font-heading text-3xl font-normal">{isSignUp ? 'Crea tu cuenta' : 'Entra en tu cuenta'}</CardTitle>
          <CardDescription>
            {isSignUp ? 'Empieza a crear listas de deseos para compartir' : 'Accede a tus listas de deseos'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full" onClick={onGoogle} disabled={loading !== null}>
            {loading === 'google' ? <Loader2Icon className="animate-spin" /> : <GoogleIcon />}
            Continuar con Google
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Separator className="flex-1" /> o con tu email <Separator className="flex-1" />
          </div>
          <form onSubmit={onSubmit} className="space-y-3">
            {isSignUp && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Ana" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
              />
            </div>
            {error && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading !== null}>
              {loading === 'email' && <Loader2Icon className="animate-spin" />}
              {isSignUp ? 'Crear cuenta' : 'Entrar'}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            {isSignUp ? '¿Ya tienes cuenta? ' : '¿No tienes cuenta? '}
            <Link to={otherLink} className="text-wine underline underline-offset-4">
              {isSignUp ? 'Entra' : 'Regístrate'}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
