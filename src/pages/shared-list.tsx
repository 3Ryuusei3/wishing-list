import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BellIcon, BellOffIcon, CalendarIcon, CheckIcon, GiftIcon, Loader2Icon, PencilIcon, Undo2Icon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { toast } from 'sonner'
import { ItemCard } from '@/components/item-card'
import { SortSelect } from '@/components/sort-select'
import { ItemsLayout, ViewToggle } from '@/components/view-toggle'
import { orderNumbers, sortItems, useSortMode } from '@/lib/sort'
import { useViewMode } from '@/lib/view'
import { FullPageSpinner } from '@/components/require-auth'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, formatDate, type List, type SharedItem } from '@/lib/api'
import { WishTabs, type WishTab } from '@/components/wish-tabs'
import { authClient } from '@/lib/auth'
import { initials } from '@/lib/utils'

type Shared = { list: List; items: SharedItem[]; isOwner: boolean; isFollowing: boolean; signedIn: boolean }

const NAME_KEY = 'wl-buyer-name'
const readName = () => {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

export function SharedListPage() {
  const { slug } = useParams()
  const location = useLocation()
  const qc = useQueryClient()
  const session = authClient.useSession()
  const userId = session.data?.user?.id
  const key = ['shared', slug, userId ?? 'anon']
  const { data, isPending, error } = useQuery({
    queryKey: key,
    queryFn: () => api<Shared>(`/shared/${slug}`),
    enabled: !session.isPending,
  })
  const [buying, setBuying] = useState<SharedItem | null>(null)
  const [buyerName, setBuyerName] = useState(readName)
  const [view, setView] = useViewMode()
  const [tab, setTab] = useState<WishTab>('wanted')
  const [sort, setSort] = useSortMode()

  const refresh = () => qc.invalidateQueries({ queryKey: ['shared', slug] })
  const onError = (e: Error) => (toast.error(e.message), refresh())

  const purchase = useMutation({
    mutationFn: ({ itemId, name }: { itemId: string; name: string }) =>
      api(`/shared/${slug}/items/${itemId}/purchase`, { method: 'POST', body: { buyerName: name || null } }),
    onSuccess: () => (refresh(), toast.success('Marcado como comprado')),
    onError,
  })
  const undo = useMutation({
    mutationFn: (itemId: string) => api(`/shared/${slug}/items/${itemId}/purchase`, { method: 'DELETE' }),
    onSuccess: () => (refresh(), toast.success('Desmarcado')),
    onError,
  })
  const follow = useMutation({
    mutationFn: (on: boolean) => api(`/shared/${slug}/follow`, { method: on ? 'POST' : 'DELETE' }),
    onSuccess: (_d, on) => {
      refresh()
      qc.invalidateQueries({ queryKey: ['following'] })
      toast.success(on ? 'Ahora sigues esta lista; la verás en tu perfil' : 'Has dejado de seguir la lista')
    },
    onError,
  })

  if (session.isPending || isPending) return <FullPageSpinner />
  if (error)
    return (
      <div className="py-16 text-center">
        <h1 className="font-heading text-3xl">Lista no encontrada</h1>
        <p className="text-muted-foreground">Puede que el enlace sea incorrecto o que la lista se haya eliminado.</p>
      </div>
    )

  const { list, items, isOwner, isFollowing } = data
  // Guests: "bought" = a guest bought it or the owner already has it.
  // Owner preview: only what the owner marked (guest purchases stay hidden).
  const isBought = (i: SharedItem) => i.ownerPurchased || (!isOwner && i.purchased)
  const wanted = items.filter((i) => !isBought(i))
  const bought = items.filter(isBought)
  const purchasedCount = bought.length
  const shown = tab === 'wanted' ? wanted : bought
  const numbers = orderNumbers(shown)
  const sorted = sortItems(shown, sort)

  const confirmPurchase = (e: FormEvent) => {
    e.preventDefault()
    if (!buying) return
    const name = buyerName.trim()
    try {
      localStorage.setItem(NAME_KEY, name)
    } catch {
      /* ignore */
    }
    purchase.mutate({ itemId: buying.id, name }, { onSettled: () => setBuying(null) })
  }

  return (
    <div className="space-y-6">
      <div className="border-b pb-8">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
          <span className="col-start-1 row-start-1 grid size-14 place-items-center rounded-sm border text-3xl sm:row-span-2">{list.emoji}</span>
          <div className="col-start-2 row-start-1 min-w-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Avatar className="size-6">
                {list.ownerImage && <AvatarImage src={list.ownerImage} alt="" />}
                <AvatarFallback className="text-[10px]">{initials(list.ownerName)}</AvatarFallback>
              </Avatar>
              Lista de {list.ownerName}
            </div>
            <h1 className="mt-2 font-heading text-4xl tracking-tight break-words sm:text-5xl">{list.title}</h1>
          </div>
          <div className="col-span-2 col-start-1 row-start-2 min-w-0 sm:col-span-1 sm:col-start-2">
            <span className="rule my-3" />
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {list.eventDate && (
                <span className="inline-flex items-center gap-1">
                  <CalendarIcon className="size-4" /> {formatDate(list.eventDate)}
                </span>
              )}
              <span>
                {items.length} {items.length === 1 ? 'regalo' : 'regalos'}
                {!isOwner && purchasedCount > 0 && ` · ${purchasedCount} ya ${purchasedCount === 1 ? 'comprado' : 'comprados'}`}
              </span>
            </div>
            {list.description && <p className="mt-3 max-w-2xl whitespace-pre-line text-muted-foreground">{list.description}</p>}
          </div>
          <div className="col-span-2 col-start-1 row-start-3 mt-4 flex justify-end gap-2 sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:mt-0">
            {isOwner ? (
              <Button asChild variant="outline">
                <Link to={`/listas/${list.id}`}>
                  <PencilIcon /> Editar mi lista
                </Link>
              </Button>
            ) : userId ? (
              <Button variant={isFollowing ? 'outline' : 'default'} disabled={follow.isPending} onClick={() => follow.mutate(!isFollowing)}>
                {isFollowing ? <BellOffIcon /> : <BellIcon />}
                {isFollowing ? 'Dejar de seguir' : 'Seguir lista'}
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link to={`/auth/sign-in?redirectTo=${encodeURIComponent(location.pathname)}`}>
                  <BellIcon /> Entra para seguirla
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {isOwner && (
        <p className="border-l-2 border-gold py-1 pl-4 font-heading text-muted-foreground italic">
          Así ven tu lista los invitados. Para mantener la sorpresa, no te mostramos qué se ha comprado.
        </p>
      )}

      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="mr-auto font-heading text-2xl">Regalos</h2>
          {shown.length > 1 && <SortSelect value={sort} onChange={setSort} customLabel={isOwner ? undefined : 'Orden del creador'} />}
          <ViewToggle value={view} onChange={setView} />
        </div>
      )}

      {items.length > 0 && <WishTabs value={tab} onChange={setTab} wanted={wanted.length} bought={bought.length} />}

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-muted-foreground">
          Esta lista todavía no tiene regalos.
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-muted-foreground">
          {tab === 'bought' ? 'Todavía no se ha comprado ningún regalo.' : '¡Ya está todo comprado!'}
        </div>
      ) : (
        <ItemsLayout mode={view}>
          {sorted.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              number={numbers.get(item.id)}
              numberDigits={String(shown.length).length}
              layout={view}
              dimmed={isBought(item) && !item.mine}
              status={
                !isOwner && item.purchased
                  ? item.mine
                    ? 'Lo compras tú'
                    : item.buyerName
                      ? `Lo compra ${item.buyerName}`
                      : 'Ya comprado'
                  : item.ownerPurchased
                    ? isOwner
                      ? 'Comprado'
                      : `${list.ownerName} ya lo tiene`
                    : undefined
              }
              actions={
                isOwner || (item.ownerPurchased && !item.purchased) ? null : item.purchased ? (
                  item.mine && (
                    <Button size="sm" variant="ghost" disabled={undo.isPending} onClick={() => undo.mutate(item.id)}>
                      <Undo2Icon /> Desmarcar
                    </Button>
                  )
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => setBuying(item)}>
                    <GiftIcon /> Lo compro
                  </Button>
                )
              }
            />
          ))}
        </ItemsLayout>
      )}

      <Dialog open={!!buying} onOpenChange={(o) => !o && setBuying(null)}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={confirmPurchase} className="space-y-4">
            <DialogHeader>
              <DialogTitle>¿Vas a regalar “{buying?.name}”?</DialogTitle>
              <DialogDescription>
                Lo marcaremos como comprado para que nadie más lo repita. {list.ownerName} no lo verá.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="buyer">Tu nombre (opcional)</Label>
              <Input id="buyer" maxLength={80} value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Así los demás sabrán quién lo regala" />
              <p className="text-xs text-muted-foreground">Podrás desmarcarlo desde este mismo navegador.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setBuying(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={purchase.isPending}>
                {purchase.isPending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />} Marcar como comprado
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
