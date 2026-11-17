import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftIcon, CalendarIcon, CircleCheckIcon, EyeIcon, PencilIcon, PlusIcon, Share2Icon, Trash2Icon, Undo2Icon, UsersIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { ItemCard } from '@/components/item-card'
import { SortSelect } from '@/components/sort-select'
import { SortableItems } from '@/components/sortable-items'
import { ItemsLayout, ViewToggle } from '@/components/view-toggle'
import { orderNumbers, sortItems, useSortMode } from '@/lib/sort'
import { useCoarsePointer } from '@/lib/use-coarse-pointer'
import { useViewMode } from '@/lib/view'
import { ItemDialog } from '@/components/item-dialog'
import { ListDialog } from '@/components/list-dialog'
import { FullPageSpinner } from '@/components/require-auth'
import { FloatingActions } from '@/components/floating-actions'
import { IconButton } from '@/components/icon-button'
import { WishTabs, type WishTab } from '@/components/wish-tabs'
import { ShareButton } from '@/components/share-button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { api, formatDate, type Item, type ItemInput, type List, type ListInput } from '@/lib/api'

type Detail = { list: List; items: Item[] }

export function ListDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const key = ['list', id]
  const { data, isPending, error } = useQuery({ queryKey: key, queryFn: () => api<Detail>(`/lists/${id}`) })

  const [editList, setEditList] = useState(false)
  const [deleteList, setDeleteList] = useState(false)
  const [itemDialog, setItemDialog] = useState<{ open: boolean; item?: Item }>({ open: false })
  const [deleteItem, setDeleteItem] = useState<Item | null>(null)
  const [view, setView] = useViewMode()
  const [sort, setSort] = useSortMode()
  const coarse = useCoarsePointer()
  const [toolbar, setToolbar] = useState<HTMLDivElement | null>(null)
  const [tab, setTab] = useState<WishTab>('wanted')

  const refresh = () => {
    qc.invalidateQueries({ queryKey: key })
    qc.invalidateQueries({ queryKey: ['my-lists'] })
  }
  const onError = (e: Error) => toast.error(e.message)

  const updateList = useMutation({
    mutationFn: (input: ListInput) => api(`/lists/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => (refresh(), toast.success('Lista guardada')),
    onError,
  })
  const removeList = useMutation({
    mutationFn: () => api(`/lists/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-lists'] })
      toast.success('Lista eliminada')
      navigate('/listas')
    },
    onError,
  })
  const saveItem = useMutation({
    mutationFn: ({ input, itemId }: { input: ItemInput; itemId?: string }) =>
      itemId
        ? api(`/items/${itemId}`, { method: 'PATCH', body: input })
        : api(`/lists/${id}/items`, { method: 'POST', body: input }),
    onSuccess: (_d, v) => (refresh(), toast.success(v.itemId ? 'Regalo actualizado' : 'Regalo añadido')),
    onError,
  })
  // Optimistic reorder: update the cache first, roll back if the server refuses.
  const reorder = useMutation({
    mutationFn: (next: Item[]) => api(`/lists/${id}/order`, { method: 'PUT', body: { itemIds: next.map((i) => i.id) } }),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<Detail>(key)
      if (prev) qc.setQueryData<Detail>(key, { ...prev, items: next.map((item, i) => ({ ...item, position: i })) })
      return { prev }
    },
    onError: (e, _next, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
      toast.error(e.message)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
  // Owner marks a gift as bought/received (or back to wished). Optimistic.
  const ownerPurchase = useMutation({
    mutationFn: ({ item, purchased }: { item: Item; purchased: boolean }) =>
      api(`/items/${item.id}/owner-purchase`, { method: 'PUT', body: { purchased } }),
    onMutate: async ({ item, purchased }) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<Detail>(key)
      if (prev)
        qc.setQueryData<Detail>(key, { ...prev, items: prev.items.map((i) => (i.id === item.id ? { ...i, ownerPurchased: purchased } : i)) })
      return { prev }
    },
    onSuccess: (_d, { item, purchased }) =>
      toast.success(purchased ? `“${item.name}” pasa a comprados` : `“${item.name}” vuelve a deseados`),
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
      toast.error(e.message)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
  const removeItem = useMutation({
    mutationFn: (itemId: string) => api(`/items/${itemId}`, { method: 'DELETE' }),
    onSuccess: () => (refresh(), toast.success('Regalo eliminado')),
    onError,
  })

  if (isPending) return <FullPageSpinner />
  if (error)
    return (
      <div className="py-16 text-center">
        <p className="text-lg">{error.message}</p>
        <Button asChild variant="link">
          <Link to="/listas">Volver a mis listas</Link>
        </Button>
      </div>
    )

  const { list, items } = data
  const wanted = items.filter((i) => !i.ownerPurchased)
  const bought = items.filter((i) => i.ownerPurchased)
  const shown = tab === 'wanted' ? wanted : bought
  // Numbers follow the owner's order within the current tab.
  const numbers = orderNumbers(shown)
  const card = (item: Item, handle?: ReactNode) => (
    <ItemCard
      item={item}
      number={numbers.get(item.id)}
      numberDigits={String(shown.length).length}
      handle={handle}
      layout={view}
      status={item.ownerPurchased ? 'Comprado' : undefined}
      actions={
        <>
          {item.ownerPurchased ? (
            <IconButton label="Volver a deseados" variant="ghost" className="size-8" onClick={() => ownerPurchase.mutate({ item, purchased: false })}>
              <Undo2Icon />
            </IconButton>
          ) : (
            <IconButton label="Marcar como comprado" variant="ghost" className="size-8" onClick={() => ownerPurchase.mutate({ item, purchased: true })}>
              <CircleCheckIcon />
            </IconButton>
          )}
          <Button size="icon" variant="ghost" className="size-8" aria-label="Editar regalo" onClick={() => setItemDialog({ open: true, item })}>
            <PencilIcon />
          </Button>
          <Button size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-destructive" aria-label="Eliminar regalo" onClick={() => setDeleteItem(item)}>
            <Trash2Icon />
          </Button>
        </>
      }
    />
  )

  return (
    <div className="space-y-6 pb-24">
      <Link to="/listas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Mis listas
      </Link>

      {/* Phone: [icon][title] / details full width / actions right. sm+: details under the title, actions top-right. */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        <span className="col-start-1 row-start-1 grid size-14 place-items-center rounded-sm border text-3xl sm:row-span-2">{list.emoji}</span>
        <h1 className="col-start-2 row-start-1 self-center font-heading text-4xl tracking-tight break-words sm:self-start">{list.title}</h1>
        <div className="col-span-2 col-start-1 row-start-2 min-w-0 sm:col-span-1 sm:col-start-2">
          <span className="rule my-3" />
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {list.eventDate && (
              <span className="inline-flex items-center gap-1">
                <CalendarIcon className="size-4" /> {formatDate(list.eventDate)}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <UsersIcon className="size-4" /> {list.followers ?? 0} {list.followers === 1 ? 'seguidor' : 'seguidores'}
            </span>
          </div>
          {list.description && <p className="mt-2 max-w-2xl whitespace-pre-line text-muted-foreground">{list.description}</p>}
        </div>
        <div className="col-span-2 col-start-1 row-start-3 mt-4 flex items-center justify-end gap-2 sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:mt-0">
          <ShareButton list={list} tooltip="Compartir">
            <Button size="icon" aria-label="Compartir">
              <Share2Icon />
            </Button>
          </ShareButton>
          <IconButton label="Editar lista" onClick={() => setEditList(true)}>
            <PencilIcon />
          </IconButton>
          <IconButton label="Ver como invitado" onClick={() => navigate(`/l/${list.shareSlug}`)}>
            <EyeIcon />
          </IconButton>
          <IconButton label="Eliminar lista" className="text-muted-foreground hover:border-destructive/40 hover:text-destructive" onClick={() => setDeleteList(true)}>
            <Trash2Icon />
          </IconButton>
        </div>
      </div>

      <div ref={setToolbar} className="flex flex-wrap items-center gap-3">
        <h2 className="mr-auto font-heading text-2xl">
          Regalos <span className="text-muted-foreground">({items.length})</span>
        </h2>
        {items.length > 0 && (
          <div className="order-last flex w-full items-center gap-2 sm:order-none sm:w-auto">
            {shown.length > 1 && <SortSelect value={sort} onChange={setSort} className="flex-1 sm:flex-none" />}
            <ViewToggle value={view} onChange={setView} />
          </div>
        )}
        <Button onClick={() => setItemDialog({ open: true })}>
          <PlusIcon /> Añadir regalo
        </Button>
      </div>

      {items.length > 0 && <WishTabs value={tab} onChange={setTab} wanted={wanted.length} bought={bought.length} />}

      {items.length === 0 ? (
        <button
          onClick={() => setItemDialog({ open: true })}
          className="w-full rounded-md border border-dashed p-10 text-center transition hover:border-foreground/30"
        >
          <p className="font-heading text-2xl">Añade tu primer regalo</p>
          <p className="text-sm text-muted-foreground">Pega el enlace de cualquier tienda y nosotros hacemos el resto.</p>
        </button>
      ) : shown.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-muted-foreground">
          {tab === 'bought'
            ? 'Aún no has marcado ningún regalo como comprado. Usa ✓ en un regalo cuando ya lo tengas.'
            : '¡Ya tienes todo lo de tu lista! Añade más regalos cuando quieras.'}
        </div>
      ) : (
        tab === 'wanted' && sort === 'custom' ? (
          // Reordering happens among wished gifts; bought ones keep their place at the end.
          <SortableItems items={wanted} mode={view} onReorder={(next) => reorder.mutate([...next, ...bought])} renderItem={card} />
        ) : (
          <ItemsLayout mode={view}>
            {sortItems(shown, sort).map((item) => (
              <div key={item.id} className="h-full">{card(item)}</div>
            ))}
          </ItemsLayout>
        )
      )}

      <p className="text-center text-xs text-muted-foreground">
        {tab === 'wanted' && wanted.length > 1 && sort === 'custom' && (coarse ? 'Mantén pulsado un regalo para moverlo. ' : 'Arrastra ⋮⋮ para cambiar el orden. ')}
        {tab === 'wanted' && wanted.length > 1 && sort !== 'custom' && 'Para reordenar, elige “Orden de la lista”. '}
        Para mantener la sorpresa, no verás lo que compren tus invitados; aquí solo aparece lo que marques tú.
      </p>

      <FloatingActions anchor={toolbar} list={list} onAdd={() => setItemDialog({ open: true })} />

      <ListDialog open={editList} onOpenChange={setEditList} list={list} onSubmit={(input) => updateList.mutateAsync(input)} />
      <ItemDialog
        open={itemDialog.open}
        onOpenChange={(open) => setItemDialog((s) => ({ ...s, open }))}
        item={itemDialog.item}
        onSubmit={(input) => saveItem.mutateAsync({ input, itemId: itemDialog.item?.id })}
      />

      <AlertDialog open={deleteList} onOpenChange={setDeleteList}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar “{list.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrarán la lista y todos sus regalos. El enlace compartido dejará de funcionar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => removeList.mutate()}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar “{deleteItem?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleteItem && removeItem.mutate(deleteItem.id)}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
