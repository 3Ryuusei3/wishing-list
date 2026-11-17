import { ArrowUpIcon, PlusIcon, Share2Icon } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { ShareButton } from '@/components/share-button'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { List } from '@/lib/api'
import { cn } from '@/lib/utils'

/** True once `el` has scrolled above the top of the viewport. */
function useScrolledPast(el: HTMLElement | null) {
  const [past, setPast] = useState(false)
  useEffect(() => {
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setPast(!entry.isIntersecting && entry.boundingClientRect.top < 0))
    io.observe(el)
    return () => io.disconnect()
  }, [el])
  return past
}

function Fab({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * Floating "back to top / share / add" buttons, shown only when the page's own
 * toolbar (passed as `anchor`) has scrolled out of view.
 */
export function FloatingActions({ anchor, list, onAdd }: { anchor: HTMLElement | null; list: List; onAdd: () => void }) {
  const visible = useScrolledPast(anchor)
  const round = 'size-11 rounded-full shadow-md'
  if (!visible) return null
  return (
    <div
      data-slot="floating-actions"
      className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex animate-in flex-col items-center gap-2 duration-200 fade-in slide-in-from-bottom-3 sm:right-6 sm:bottom-6"
    >
      <Fab label="Subir arriba">
        <Button
          variant="outline"
          size="icon"
          className={cn(round, 'bg-card')}
          aria-label="Subir arriba"
         
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <ArrowUpIcon />
        </Button>
      </Fab>
      <ShareButton list={list} tooltip="Compartir">
        <Button variant="outline" size="icon" className={cn(round, 'bg-card')} aria-label="Compartir">
          <Share2Icon />
        </Button>
      </ShareButton>
      <Fab label="Añadir regalo">
        <Button size="icon" className={cn(round, 'size-13')} aria-label="Añadir regalo" onClick={onAdd}>
          <PlusIcon className="size-5" />
        </Button>
      </Fab>
    </div>
  )
}
