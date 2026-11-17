import { CheckIcon, CopyIcon, Share2Icon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { shareUrl, type List } from '@/lib/api'

/**
 * Share dialog. Pass `children` to use a custom trigger (e.g. an icon button) and
 * `tooltip` to show a label on hover for icon-only triggers.
 */
export function ShareButton({ list, children, tooltip }: { list: List; children?: ReactNode; tooltip?: string }) {
  const [copied, setCopied] = useState(false)
  const url = shareUrl(list.shareSlug)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Enlace copiado')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('No se pudo copiar; selecciónalo a mano')
    }
  }

  const nativeShare = async () => {
    try {
      await navigator.share({ title: list.title, text: `Mi lista de deseos en Ziru: ${list.title} ${list.emoji}`, url })
    } catch {
      /* cancelled */
    }
  }

  return (
    <Dialog>
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>{children}</DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="left">{tooltip}</TooltipContent>
        </Tooltip>
      ) : (
        <DialogTrigger asChild>
          {children ?? (
            <Button>
              <Share2Icon /> Compartir
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Compartir “{list.title}”</DialogTitle>
          <DialogDescription>
            Cualquiera con el enlace puede ver la lista y marcar regalos como comprados, sin necesidad de cuenta. Tú no verás
            qué se ha comprado, para no estropear la sorpresa.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Enlace de la lista" />
          <Button variant="secondary" onClick={copy} aria-label="Copiar enlace">
            {copied ? <CheckIcon /> : <CopyIcon />}
          </Button>
        </div>
        {'share' in navigator && (
          <Button variant="outline" onClick={nativeShare}>
            <Share2Icon /> Enviar por otra app
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
