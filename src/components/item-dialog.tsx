import { ImageIcon, LinkIcon, Loader2Icon, SparklesIcon, UploadIcon, XIcon } from 'lucide-react'
import { useRef, useState, type ClipboardEvent, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { ApiError, api, resizeImage, type Item, type ItemInput, type LinkMetadata, type Priority } from '@/lib/api'

const isHttpUrl = (v: string) => /^https?:\/\/\S+\.\S+/i.test(v.trim())

type Props = {
  open: boolean
  onOpenChange: (o: boolean) => void
  item?: Item
  onSubmit: (input: ItemInput) => Promise<unknown>
}

export function ItemDialog({ open, onOpenChange, item, onSubmit }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        {/* DialogContent unmounts when closed, so the form starts fresh from `item` on every open. */}
        <ItemForm item={item} onSubmit={onSubmit} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function ItemForm({ item, onSubmit, onClose }: Pick<Props, 'item' | 'onSubmit'> & { onClose: () => void }) {
  const [url, setUrl] = useState(item?.url ?? '')
  const [name, setName] = useState(item?.name ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [price, setPrice] = useState(item?.price != null ? String(item.price) : '')
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? '')
  const [priority, setPriority] = useState<string>(item?.priority ? String(item.priority) : 'none')
  const [size, setSize] = useState(item?.size ?? '')
  const [color, setColor] = useState(item?.color ?? '')
  const [saving, setSaving] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [imageMode, setImageMode] = useState<'url' | null>(null)
  const [blockedHost, setBlockedHost] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const lastFetched = useRef(item?.url ?? '')
  const fileRef = useRef<HTMLInputElement>(null)

  /** Fill empty fields from the page's Open Graph / JSON-LD metadata. */
  const autofill = async (target = url, force = false) => {
    const u = target.trim()
    if (!isHttpUrl(u) || (!force && lastFetched.current === u)) return
    lastFetched.current = u
    setBlockedHost(null)
    setFetching(true)
    try {
      const { metadata } = await api<{ metadata: LinkMetadata }>('/metadata', { method: 'POST', body: { url: u } })
      let filled = 0
      const fill = <T,>(value: T | undefined | null, isEmpty: boolean, set: (v: T) => void) => {
        if (value == null || value === '' || !(force || isEmpty)) return
        set(value)
        filled++
      }
      fill(metadata.title, !name.trim(), setName)
      fill(metadata.description, !description.trim(), setDescription)
      fill(metadata.image, !imageUrl, setImageUrl)
      fill(metadata.price != null ? String(metadata.price) : null, !price, setPrice)
      if (filled) toast.success('Datos rellenados desde el enlace')
      else toast.info('No encontramos datos en esa página; rellénalos a mano')
    } catch (e: any) {
      if (e instanceof ApiError && e.code === 'blocked') {
        setBlockedHost(new URL(u).hostname.replace(/^www\./, ''))
        const suggested = typeof e.data.suggestedName === 'string' ? e.data.suggestedName : null
        const useSuggestion = suggested && (force || !name.trim())
        if (useSuggestion) setName(suggested)
        toast.warning(
          `${e.message}. ${useSuggestion ? 'Hemos sacado el nombre del enlace; revísalo' : 'Rellena el nombre a mano'} y pega la foto (más abajo te contamos cómo).`,
          { duration: 8000 },
        )
      } else toast.error(e.message ?? 'No se pudo leer el enlace')
    } finally {
      setFetching(false)
    }
  }

  const onFile = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('El archivo no es una imagen')
    setUploading(true)
    try {
      const dataUrl = await resizeImage(file)
      const { url: uploaded } = await api<{ url: string }>('/images', { method: 'POST', body: { dataUrl } })
      setImageUrl(uploaded)
      setImageMode(null)
    } catch (e: any) {
      toast.error(e.message ?? 'No se pudo subir la imagen')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const p = price.trim() ? Number(price.replace(',', '.')) : null
    if (p != null && (!Number.isFinite(p) || p < 0)) return toast.error('El precio no es válido')
    setSaving(true)
    try {
      await onSubmit({
        name,
        description: description || null,
        url: url.trim() || null,
        price: p,
        imageUrl: imageUrl || null,
        priority: priority === 'none' ? null : (Number(priority) as Priority),
        size: size.trim() || null,
        color: color.trim() || null,
      })
      onClose()
    } catch {
      /* the caller shows the error toast */
    } finally {
      setSaving(false)
    }
  }

  /** Paste an image copied from any web page or app (Ctrl/Cmd+V anywhere in the form). */
  const onPaste = (e: ClipboardEvent<HTMLFormElement>) => {
    const file = [...e.clipboardData.files].find((f) => f.type.startsWith('image/'))
    if (!file) return // normal text paste
    e.preventDefault()
    onFile(file)
  }

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  const pasteKey = isMac ? '⌘V' : 'Ctrl+V'

  return (
    <form onSubmit={submit} onPaste={onPaste} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{item ? 'Editar regalo' : 'Añadir regalo'}</DialogTitle>
        <DialogDescription>Pega un enlace y rellenamos lo que podamos por ti.</DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label htmlFor="item-url">Enlace (opcional)</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <LinkIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="item-url"
              type="url"
              inputMode="url"
              className="pl-9"
              placeholder="https://tienda.com/producto"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={() => autofill()}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData('text')
                if (isHttpUrl(pasted)) setTimeout(() => autofill(pasted.trim()), 0)
              }}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={!isHttpUrl(url) || fetching}
            onClick={() => autofill(url, true)}
            title="Rellenar desde el enlace"
          >
            {fetching ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
            <span className="hidden sm:inline">Autocompletar</span>
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="item-name">Nombre *</Label>
        <Input id="item-name" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} placeholder="Auriculares inalámbricos" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="item-price">Precio aprox. (€)</Label>
          <Input id="item-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="49,99" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="item-size">Talla</Label>
          <Input id="item-size" maxLength={40} value={size} onChange={(e) => setSize(e.target.value)} placeholder="M, 42…" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="item-color">Color</Label>
          <Input id="item-color" maxLength={40} value={color} onChange={(e) => setColor(e.target.value)} placeholder="Azul marino…" />
        </div>
        <div className="space-y-1.5">
          <Label>Prioridad</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin prioridad</SelectItem>
              <SelectItem value="1">Alta</SelectItem>
              <SelectItem value="2">Media</SelectItem>
              <SelectItem value="3">Baja</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="item-desc">Descripción</Label>
        <Textarea id="item-desc" maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Modelo, detalles…" />
      </div>

      <div
        className={cn('-m-2 space-y-1.5 rounded-xl p-2 transition-colors', dragging && 'bg-primary/10 ring-2 ring-primary/40 ring-dashed')}
        onDragOver={(e) => {
          if (![...e.dataTransfer.types].includes('Files')) return
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          onFile([...e.dataTransfer.files].find((f) => f.type.startsWith('image/')))
        }}
      >
        <Label>Foto</Label>
        {imageUrl ? (
          <div className="relative w-fit">
            <img src={imageUrl} alt="" className="h-32 min-w-32 max-w-full rounded-lg border bg-muted object-contain" />
            <Button type="button" size="icon" variant="secondary" className="absolute -top-2 -right-2 size-7 rounded-full shadow" onClick={() => setImageUrl('')} aria-label="Quitar foto">
              <XIcon />
            </Button>
          </div>
        ) : imageMode === 'url' ? (
          <div className="flex gap-2">
            <Input autoFocus type="url" placeholder="https://…/foto.jpg" onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                const v = e.currentTarget.value.trim()
                if (isHttpUrl(v)) setImageUrl(v)
              }
            }} onBlur={(e) => isHttpUrl(e.target.value) && setImageUrl(e.target.value.trim())} />
            <Button type="button" variant="ghost" onClick={() => setImageMode(null)}>Cancelar</Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2Icon className="animate-spin" /> : <UploadIcon />} Subir foto
            </Button>
            <Button type="button" variant="outline" onClick={() => setImageMode('url')}>
              <ImageIcon /> Usar enlace de imagen
            </Button>
          </div>
        )}
        {!imageUrl &&
          (blockedHost ? (
            <p className="border-l-2 border-gold py-1 pl-3 text-xs text-muted-foreground">
              En {blockedHost}, haz clic derecho sobre la foto del producto → <strong>Copiar imagen</strong>, y pulsa{' '}
              <kbd className="rounded border bg-background px-1 font-sans">{pasteKey}</kbd> aquí.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              También puedes pegar una imagen copiada ({pasteKey}) o arrastrarla aquí.
            </p>
          ))}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving || uploading || !name.trim()}>
          {saving && <Loader2Icon className="animate-spin" />}
          {item ? 'Guardar' : 'Añadir'}
        </Button>
      </DialogFooter>
    </form>
  )
}
