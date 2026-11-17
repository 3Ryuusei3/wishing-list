import { Link, Navigate } from 'react-router'
import { FullPageSpinner } from '@/components/require-auth'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth'

const FEATURES = [
  { n: 'I', title: 'Pega un enlace', text: 'Tomamos el nombre, la foto y la descripción de la tienda.' },
  { n: 'II', title: 'Comparte la lista', text: 'Un enlace basta; nadie necesita cuenta para verla.' },
  { n: 'III', title: 'Sin regalos repetidos', text: 'Tus invitados marcan lo que compran. Tú no lo ves.' },
]

export function HomePage() {
  const { data, isPending } = authClient.useSession()
  if (isPending) return <FullPageSpinner />
  if (data?.user) return <Navigate to="/listas" replace />

  return (
    <div className="py-8 sm:py-16">
      <p className="kicker">Cumpleaños · bodas · fiestas · porque sí</p>
      <h1 className="mt-4 max-w-3xl font-heading text-5xl leading-[1.05] tracking-tight text-balance sm:text-6xl">
        Listas de deseos para <span className="text-wine italic">cualquier celebración</span>
      </h1>
      <span className="rule mt-8" />
      <p className="mt-6 max-w-lg text-lg text-pretty text-muted-foreground">
        Crea tu lista, compártela con quien quieras y acierta siempre con el regalo.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link to="/auth/sign-up">Crear mi lista</Link>
        </Button>
        <Button asChild size="lg" variant="ghost">
          <Link to="/auth/sign-in">Ya tengo cuenta</Link>
        </Button>
      </div>
      <div className="mt-20 grid gap-10 border-t pt-10 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title}>
            <p className="font-heading text-wine italic">{f.n}</p>
            <h3 className="mt-2 font-heading text-xl">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
