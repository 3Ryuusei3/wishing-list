import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarIcon, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ListDialog } from '@/components/list-dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api, formatDate, type List, type ListInput } from '@/lib/api'

export function ListCard({ list, to, footer }: { list: List; to: string; footer?: string }) {
  return (
    <Link to={to} className="group rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
      <Card className="h-full gap-3 rounded-md p-5 shadow-none transition group-hover:border-foreground/25">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-sm border text-xl">{list.emoji}</span>
          <div className="min-w-0">
            <h3 className="truncate font-heading text-xl">{list.title}</h3>
            {list.ownerName && <p className="truncate text-sm text-muted-foreground">de {list.ownerName}</p>}
          </div>
        </div>
        {list.description && <p className="line-clamp-2 text-sm text-muted-foreground">{list.description}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>
            {list.itemCount ?? 0} {list.itemCount === 1 ? 'regalo' : 'regalos'}
          </span>
          {list.eventDate && (
            <span className="inline-flex items-center gap-1">
              <CalendarIcon className="size-3.5" /> {formatDate(list.eventDate)}
            </span>
          )}
          {footer && <span>{footer}</span>}
        </div>
      </Card>
    </Link>
  )
}

export function ListGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-40 rounded-xl" />
      ))}
    </div>
  )
}

export function ListsPage() {
  const [open, setOpen] = useState(false)
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data, isPending, error } = useQuery({
    queryKey: ['my-lists'],
    queryFn: () => api<{ lists: List[] }>('/me/lists'),
  })
  const create = useMutation({
    mutationFn: (input: ListInput) => api<{ list: List }>('/lists', { method: 'POST', body: input }),
    onSuccess: ({ list }) => {
      qc.invalidateQueries({ queryKey: ['my-lists'] })
      toast.success('Lista creada. Ya puedes añadir regalos.')
      navigate(`/listas/${list.id}`)
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-4xl tracking-tight">Mis listas</h1>
          <span className="rule mt-3" />
          <p className="mt-3 text-muted-foreground">Crea, edita y comparte tus listas de deseos.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <PlusIcon /> Nueva lista
        </Button>
      </div>

      {isPending ? (
        <ListGridSkeleton />
      ) : error ? (
        <p className="text-destructive">{error.message}</p>
      ) : data.lists.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center">
          <h2 className="font-heading text-2xl">Aún no tienes listas</h2>
          <p className="mt-1 text-muted-foreground">Empieza con tu próximo cumpleaños, una boda o lo que quieras celebrar.</p>
          <Button className="mt-5" onClick={() => setOpen(true)}>
            <PlusIcon /> Crear mi primera lista
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.lists.map((l) => (
            <ListCard key={l.id} list={l} to={`/listas/${l.id}`} />
          ))}
        </div>
      )}

      <ListDialog open={open} onOpenChange={setOpen} onSubmit={(input) => create.mutateAsync(input)} />
    </div>
  )
}
