import { Loader2Icon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { List, ListInput } from '@/lib/api'
import { cn } from '@/lib/utils'
import { EmojiPickerButton } from './emoji-picker'

const EMOJIS = ['🎁', '🎂', '🎄', '🎉', '💍', '👶', '🎓', '🏠', '💝', '🌟', '🎈', '🥳']

type Props = {
  open: boolean
  onOpenChange: (o: boolean) => void
  list?: List
  onSubmit: (input: ListInput) => Promise<unknown>
}

export function ListDialog({ open, onOpenChange, list, onSubmit }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* DialogContent unmounts when closed, so the form starts fresh from `list` on every open. */}
        <ListForm list={list} onSubmit={onSubmit} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function ListForm({ list, onSubmit, onClose }: Pick<Props, 'list' | 'onSubmit'> & { onClose: () => void }) {
  const [title, setTitle] = useState(list?.title ?? '')
  const [description, setDescription] = useState(list?.description ?? '')
  const [emoji, setEmoji] = useState(list?.emoji ?? '🎁')
  const [eventDate, setEventDate] = useState(list?.eventDate?.slice(0, 10) ?? '')
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSubmit({ title, description: description || null, emoji, eventDate: eventDate || null })
      onClose()
    } catch {
      /* the caller shows the error toast */
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{list ? 'Editar lista' : 'Nueva lista'}</DialogTitle>
        <DialogDescription>Ponle un nombre y, si quieres, una fecha especial.</DialogDescription>
      </DialogHeader>
      <div className="space-y-1.5">
        <Label>Icono</Label>
        <div className="flex flex-wrap gap-1.5">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(e)}
              aria-label={`Icono ${e}`}
              aria-pressed={emoji === e}
              className={cn(
                'grid size-10 place-items-center rounded-lg border text-xl transition hover:bg-muted',
                emoji === e && 'border-primary bg-primary/10 ring-2 ring-primary/30',
              )}
            >
              {e}
            </button>
          ))}
          <EmojiPickerButton value={emoji} onChange={setEmoji} active={!EMOJIS.includes(emoji)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="list-title">Título</Label>
        <Input id="list-title" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mi cumpleaños" autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="list-desc">Descripción (opcional)</Label>
        <Textarea id="list-desc" maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tallas, colores favoritos, lo que quieras contar…" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="list-date">Fecha del evento (opcional)</Label>
        <Input id="list-date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving || !title.trim()}>
          {saving && <Loader2Icon className="animate-spin" />}
          {list ? 'Guardar' : 'Crear lista'}
        </Button>
      </DialogFooter>
    </form>
  )
}
